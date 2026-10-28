import { http } from 'msw'
import type { AddCartItemRequest, ApplyCouponRequest, UpdateCartItemRequest } from '@/lib/contracts'
import { buildCart, evaluateCoupon, getCartRecord, ownerKey } from '../domain/cart'
import { API, jsonError, nonEmpty, ok, param, readJson, route, validationError, type Ctx } from '../http'

function cartFor(ctx: Ctx) {
  const key = ownerKey(ctx.user, ctx.request.headers.get('x-guest-id'))
  return key ? getCartRecord(ctx.db, key) : null
}

const NO_OWNER = () =>
  validationError({ guestId: 'Envie o header X-Guest-Id ou autentique-se.' }, 'Carrinho sem dono.')

function findEdition(ctx: Ctx, nftId: string, editionId: string) {
  const nft = ctx.db.nfts.find((n) => n.id === nftId)
  const edition = nft?.editions.find((e) => e.id === editionId)
  return { nft, edition }
}

const isQty = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1

export const cartHandlers = [
  http.get(`${API}/cart`, route({ auth: 'optional' }, (ctx) => {
    const record = cartFor(ctx)
    return record ? ok(buildCart(ctx.db, record)) : NO_OWNER()
  })),

  http.post(`${API}/cart/items`, route({ auth: 'optional' }, async (ctx) => {
    const record = cartFor(ctx)
    if (!record) return NO_OWNER()
    const body = await readJson<AddCartItemRequest>(ctx.request)
    if (!nonEmpty(body.nftId) || !nonEmpty(body.editionId)) {
      return validationError({ nftId: 'Informe o NFT e a edição.' })
    }
    if (!isQty(body.quantity)) return validationError({ quantity: 'A quantidade deve ser um inteiro maior que zero.' })

    const { nft, edition } = findEdition(ctx, body.nftId, body.editionId)
    if (!nft || !edition) return jsonError('NOT_FOUND', 'NFT ou edição não encontrados.')

    const existing = record.items.find((i) => i.nftId === nft.id && i.editionId === edition.id)
    const wanted = (existing?.quantity ?? 0) + body.quantity
    if (wanted > edition.available) {
      return jsonError('CONFLICT', 'Quantidade acima da disponibilidade desta edição.', {
        fieldErrors: { quantity: `Disponível: ${edition.available}.` },
        details: { reason: 'INSUFFICIENT_AVAILABILITY', available: edition.available },
      })
    }
    if (existing) existing.quantity = wanted
    else record.items.push({ nftId: nft.id, editionId: edition.id, quantity: body.quantity })
    return ok(buildCart(ctx.db, record), 201)
  })),

  http.patch(`${API}/cart/items/:nftId/:editionId`, route({ auth: 'optional' }, async (ctx) => {
    const record = cartFor(ctx)
    if (!record) return NO_OWNER()
    const body = await readJson<UpdateCartItemRequest>(ctx.request)
    if (!isQty(body.quantity)) return validationError({ quantity: 'A quantidade deve ser um inteiro maior que zero.' })

    const line = record.items.find((i) => i.nftId === param(ctx, 'nftId') && i.editionId === param(ctx, 'editionId'))
    if (!line) return jsonError('NOT_FOUND', 'Item não está no carrinho.')
    const { edition } = findEdition(ctx, line.nftId, line.editionId)
    if (!edition) return jsonError('NOT_FOUND', 'Edição não encontrada.')
    if (body.quantity > edition.available) {
      return jsonError('CONFLICT', 'Quantidade acima da disponibilidade desta edição.', {
        fieldErrors: { quantity: `Disponível: ${edition.available}.` },
        details: { reason: 'INSUFFICIENT_AVAILABILITY', available: edition.available },
      })
    }
    line.quantity = body.quantity
    return ok(buildCart(ctx.db, record))
  })),

  http.delete(`${API}/cart/items/:nftId/:editionId`, route({ auth: 'optional' }, (ctx) => {
    const record = cartFor(ctx)
    if (!record) return NO_OWNER()
    const nftId = param(ctx, 'nftId')
    const editionId = param(ctx, 'editionId')
    record.items = record.items.filter((i) => !(i.nftId === nftId && i.editionId === editionId))
    if (record.items.length === 0) delete record.couponCode
    return ok(buildCart(ctx.db, record))
  })),

  http.put(`${API}/cart/coupon`, route({ auth: 'optional' }, async (ctx) => {
    const record = cartFor(ctx)
    if (!record) return NO_OWNER()
    const body = await readJson<ApplyCouponRequest>(ctx.request)
    if (!nonEmpty(body.code)) return validationError({ code: 'Digite o código promocional.' })

    const result = evaluateCoupon(ctx.db, body.code)
    if (!result.ok) {
      const message = result.reason === 'expired' ? 'Este cupom expirou.' : 'Cupom inválido.'
      return jsonError('VALIDATION_ERROR', message, { fieldErrors: { code: message }, details: { reason: result.reason } })
    }
    record.couponCode = result.coupon.code
    return ok(buildCart(ctx.db, record))
  })),

  http.delete(`${API}/cart/coupon`, route({ auth: 'optional' }, (ctx) => {
    const record = cartFor(ctx)
    if (!record) return NO_OWNER()
    delete record.couponCode
    return ok(buildCart(ctx.db, record))
  })),
]
