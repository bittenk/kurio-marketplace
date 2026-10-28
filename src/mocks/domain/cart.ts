import type { Cart, CartItem, CheckoutIssue } from '@/lib/contracts'
import { addEth, compareEth, mulEth, pctEth, subEth, sumEth, ZERO_ETH, type EthString } from '@/lib/money'
import { hashString } from '../http'
import { getActiveScenario } from '../scenarios/index'
import type { CartRecord, Coupon, DbState, QuoteSnapshot, UserRecord } from '../db/types'

export const NETWORK_FEE: EthString = '0.016'

export function ownerKey(user: UserRecord | null, guestId: string | null): string | null {
  if (user) return `user:${user.id}`
  return guestId ? `guest:${guestId}` : null
}

export function getCartRecord(db: DbState, key: string): CartRecord {
  db.carts[key] ??= { items: [] }
  return db.carts[key]
}

export type CouponResult = { ok: true; coupon: Coupon } | { ok: false; reason: 'invalid' | 'expired' }

export function evaluateCoupon(db: DbState, code: string): CouponResult {
  const coupon = db.coupons.find((c) => c.code.toLowerCase() === code.trim().toLowerCase())
  if (!coupon) return { ok: false, reason: 'invalid' }
  const expired =
    getActiveScenario().couponAlwaysExpired || (coupon.expiresAt && Date.parse(coupon.expiresAt) < Date.now())
  return expired ? { ok: false, reason: 'expired' } : { ok: true, coupon }
}

export const lineKey = (nftId: string, editionId: string) => `${nftId}:${editionId}`

export function buildCart(db: DbState, record: CartRecord): Cart {
  const items: CartItem[] = []
  for (const line of record.items) {
    const nft = db.nfts.find((n) => n.id === line.nftId)
    const edition = nft?.editions.find((e) => e.id === line.editionId)
    if (!nft || !edition) continue
    items.push({
      nftId: nft.id,
      editionId: edition.id,
      quantity: line.quantity,
      unitPriceEth: nft.priceEth,
      lineTotalEth: mulEth(nft.priceEth, line.quantity),
      available: edition.available,
    })
  }

  const subtotalEth = sumEth(items.map((i) => i.lineTotalEth))
  let discountEth: EthString = ZERO_ETH
  let couponCode: string | undefined

  if (record.couponCode) {
    const result = evaluateCoupon(db, record.couponCode)
    if (result.ok) {
      couponCode = result.coupon.code
      const raw =
        result.coupon.type === 'percent'
          ? pctEth(subtotalEth, result.coupon.value)
          : result.coupon.value
      discountEth = compareEth(raw, subtotalEth) > 0 ? subtotalEth : raw
    }
  }

  const networkFeeEth = items.length > 0 ? NETWORK_FEE : ZERO_ETH
  const totalEth = addEth(subEth(subtotalEth, discountEth), networkFeeEth)
  const totals = { subtotalEth, discountEth, networkFeeEth, totalEth }

  const quoteVersion =
    'q-' +
    hashString(
      JSON.stringify({
        lines: items.map((i) => [i.nftId, i.editionId, i.quantity, i.unitPriceEth, i.available >= i.quantity]),
        couponCode: couponCode ?? null,
        totals,
      }),
    )

  return { items, couponCode, totals, quoteVersion }
}

export function snapshotOf(cart: Cart): QuoteSnapshot {
  return {
    quoteVersion: cart.quoteVersion,
    prices: Object.fromEntries(cart.items.map((i) => [lineKey(i.nftId, i.editionId), i.unitPriceEth])),
    feeEth: cart.totals.networkFeeEth,
  }
}

/** Compara o que o usuário viu com o estado atual e descreve as mudanças. */
export function computeIssues(db: DbState, record: CartRecord, cart: Cart): CheckoutIssue[] {
  const issues: CheckoutIssue[] = []
  const previous = record.lastQuote
  const nameOf = (id: string) => db.nfts.find((n) => n.id === id)?.name ?? id

  for (const item of cart.items) {
    const before = previous?.prices[lineKey(item.nftId, item.editionId)]
    if (before && before !== item.unitPriceEth) {
      issues.push({
        type: 'PRICE_CHANGED',
        nftId: item.nftId,
        message: `O preço de ${nameOf(item.nftId)} mudou de ${before} para ${item.unitPriceEth} ETH.`,
      })
    }
    if (item.quantity > item.available) {
      issues.push({
        type: 'OUT_OF_STOCK',
        nftId: item.nftId,
        message:
          item.available === 0
            ? `${nameOf(item.nftId)} esgotou.`
            : `${nameOf(item.nftId)} tem apenas ${item.available} unidade(s) disponível(is).`,
      })
    }
  }

  if (previous && previous.feeEth !== cart.totals.networkFeeEth) {
    issues.push({ type: 'FEE_CHANGED', message: 'A taxa de rede foi atualizada.' })
  }

  if (record.couponCode && !cart.couponCode) {
    issues.push({ type: 'COUPON_INVALID', message: `O cupom ${record.couponCode} não é mais válido.` })
  }

  return issues
}

/** Mescla o carrinho de visitante no do usuário ao autenticar. */
export function mergeGuestCart(db: DbState, guestId: string | undefined, userId: string): void {
  if (!guestId) return
  const guestKey = `guest:${guestId}`
  const guest = db.carts[guestKey]
  if (!guest) return

  const target = getCartRecord(db, `user:${userId}`)
  for (const line of guest.items) {
    const nft = db.nfts.find((n) => n.id === line.nftId)
    const edition = nft?.editions.find((e) => e.id === line.editionId)
    if (!edition) continue
    const existing = target.items.find((i) => i.nftId === line.nftId && i.editionId === line.editionId)
    const wanted = (existing?.quantity ?? 0) + line.quantity
    const quantity = Math.max(1, Math.min(wanted, edition.available || 1))
    if (existing) existing.quantity = quantity
    else target.items.push({ ...line, quantity })
  }
  if (!target.couponCode && guest.couponCode) target.couponCode = guest.couponCode
  delete db.carts[guestKey]
}
