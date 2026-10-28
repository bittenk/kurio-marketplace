import { delay, http } from 'msw'
import type { CheckoutQuote, CreateOrderRequest, Network, OrderConflictDetails, OrderLine, WalletProvider } from '@/lib/contracts'
import { addEth } from '@/lib/money'
import { getActiveScenario } from '../scenarios/index'
import { mutateDb, nextId } from '../db/db'
import type { OrderRecord } from '../db/types'
import { buildCart, computeIssues, getCartRecord, snapshotOf } from '../domain/cart'
import { touchNft } from '../domain/nfts'
import { scheduleSettlement, settleOrder, toOrder, ORDER_SETTLE_MS } from '../domain/orders'
import {
  API, hashString, isEmail, jsonError, nonEmpty, ok, param, readJson, route, validationError,
  type Ctx, type FieldErrors,
} from '../http'

const QUOTE_TTL_MS = 5 * 60 * 1000
const NETWORKS: Network[] = ['ethereum', 'polygon', 'solana']
const PROVIDERS: WalletProvider[] = ['metamask', 'walletconnect', 'coinbase']

function buildQuote(ctx: Ctx, save: boolean): CheckoutQuote {
  const record = getCartRecord(ctx.db, `user:${ctx.user!.id}`)
  const cart = buildCart(ctx.db, record)
  const issues = computeIssues(ctx.db, record, cart)
  if (save) record.lastQuote = snapshotOf(cart)
  return { cart, issues, quoteVersion: cart.quoteVersion, expiresAt: new Date(Date.now() + QUOTE_TTL_MS).toISOString() }
}

/** Dispara, uma única vez por carrinho, a falha configurada no cenário ativo. */
function fireCheckoutScenario(ctx: Ctx): void {
  const scenario = getActiveScenario()
  const record = getCartRecord(ctx.db, `user:${ctx.user!.id}`)
  if (record.scenarioFired || record.items.length === 0) return
  if (!scenario.priceChangeAtCheckout && !scenario.soldOutAtCheckout) return

  const first = record.items[0]
  const nft = ctx.db.nfts.find((n) => n.id === first.nftId)
  if (!nft) return
  record.scenarioFired = true

  if (scenario.priceChangeAtCheckout) {
    nft.previousPriceEth = nft.priceEth
    nft.priceEth = addEth(nft.priceEth, '0.05')
    touchNft(ctx.db, nft)
  }
  if (scenario.soldOutAtCheckout) {
    const edition = nft.editions.find((e) => e.id === first.editionId)
    if (edition) edition.available = 0
    touchNft(ctx.db, nft)
  }
}

export const orderHandlers = [
  http.post(`${API}/checkout/quote`, route({ auth: 'required' }, (ctx) => ok(buildQuote(ctx, true)))),

  http.post(`${API}/orders`, route({ auth: 'required' }, async (ctx) => {
    const user = ctx.user!
    const idempotencyKey = ctx.request.headers.get('idempotency-key')
    if (!idempotencyKey) {
      return validationError({ 'Idempotency-Key': 'O header Idempotency-Key é obrigatório.' })
    }
    const body = await readJson<CreateOrderRequest>(ctx.request)
    const requestHash = hashString(JSON.stringify(body))

    // 1) Idempotência: mesma chave + mesmo corpo recupera o mesmo pedido.
    const existing = ctx.db.orders.find((o) => o.userId === user.id && o.idempotencyKey === idempotencyKey)
    if (existing) {
      if (existing.requestHash !== requestHash) {
        return jsonError('CONFLICT', 'Esta chave de idempotência já foi usada com outro conteúdo.', {
          details: { reason: 'IDEMPOTENCY_KEY_REUSED' },
        })
      }
      settleOrder(ctx.db, existing)
      return ok(toOrder(existing), 200)
    }

    // 2) Validação do formulário
    const errors: FieldErrors = {}
    const collector = body.collector
    if (!nonEmpty(collector?.displayName)) errors['collector.displayName'] = 'Informe o nome de exibição.'
    if (!nonEmpty(collector?.username)) errors['collector.username'] = 'Informe o nome de usuário.'
    if (!isEmail(collector?.email)) errors['collector.email'] = 'Informe um e-mail válido.'
    if (!nonEmpty(collector?.walletAddress)) errors['collector.walletAddress'] = 'Informe o endereço da carteira.'
    if (!body.network || !NETWORKS.includes(body.network)) errors.network = 'Selecione uma rede.'
    if (!body.provider || !PROVIDERS.includes(body.provider)) errors.provider = 'Selecione a carteira.'
    const wallet = (ctx.db.wallets[user.id] ?? []).find((w) => w.id === body.walletId)
    if (!wallet) errors.walletId = 'Selecione uma carteira cadastrada.'
    else if (body.network && wallet.network !== body.network) errors.network = 'A carteira selecionada usa outra rede.'
    if (Object.keys(errors).length) return validationError(errors)

    if (ctx.db.connectedWallets[user.id] !== wallet!.id) {
      return jsonError('CONFLICT', 'Conecte a carteira antes de finalizar.', { details: { reason: 'WALLET_NOT_CONNECTED' } })
    }

    // 3) Revalidação de preço, disponibilidade, cupom e taxas
    const record = getCartRecord(ctx.db, `user:${user.id}`)
    if (record.items.length === 0) return validationError({ cart: 'Seu carrinho está vazio.' })

    fireCheckoutScenario(ctx)

    const cart = buildCart(ctx.db, record)
    const issues = computeIssues(ctx.db, record, cart)
    const stale = body.quoteVersion !== cart.quoteVersion
    if (issues.length > 0 || stale) {
      const finalIssues = issues.length
        ? issues
        : [{ type: 'PRICE_CHANGED' as const, message: 'O resumo do pedido mudou. Revise antes de confirmar.' }]
      const quote = buildQuote(ctx, true)
      const details: OrderConflictDetails = { issues: finalIssues, quote }
      return jsonError('CONFLICT', 'O pedido precisa ser revisado novamente.', {
        details: { reason: 'QUOTE_CHANGED', ...details },
      })
    }

    // 4) Cria o pedido pendente com snapshot imutável
    const lines: OrderLine[] = cart.items.map((item) => {
      const nft = ctx.db.nfts.find((n) => n.id === item.nftId)!
      const edition = nft.editions.find((e) => e.id === item.editionId)!
      return {
        nftId: nft.id,
        name: nft.name,
        tokenId: nft.tokenId,
        imageUrl: nft.imageUrl,
        editionLabel: edition.label,
        quantity: item.quantity,
        unitPriceEth: item.unitPriceEth,
        lineTotalEth: item.lineTotalEth,
      }
    })

    const order: OrderRecord = {
      id: nextId(ctx.db, 'order'),
      status: 'pending',
      lines,
      totals: structuredClone(cart.totals),
      walletProvider: body.provider!,
      createdAt: new Date().toISOString(),
      version: 1,
      userId: user.id,
      idempotencyKey,
      requestHash,
      resolveAt: new Date(Date.now() + ORDER_SETTLE_MS).toISOString(),
    }
    ctx.db.orders.push(order)
    scheduleSettlement(order.id)

    // Cenário: o pedido foi criado, mas a resposta nunca chega.
    if (getActiveScenario().orderTimeoutAfterCreate) {
      mutateDb(() => undefined)
      await delay('infinite')
    }
    return ok(toOrder(order), 201)
  })),

  http.get(`${API}/orders`, route({ auth: 'required' }, ({ db, user }) => {
    const mine = db.orders.filter((o) => o.userId === user!.id)
    mine.forEach((o) => settleOrder(db, o))
    return ok(mine.map(toOrder).reverse())
  })),

  http.get(`${API}/orders/:id`, route({ auth: 'required' }, (ctx) => {
    const order = ctx.db.orders.find((o) => o.id === param(ctx, 'id'))
    if (!order) return jsonError('NOT_FOUND', 'Pedido não encontrado.')
    if (order.userId !== ctx.user!.id) return jsonError('FORBIDDEN', 'Você não tem acesso a este pedido.')
    settleOrder(ctx.db, order)
    return ok(toOrder(order))
  })),
]
