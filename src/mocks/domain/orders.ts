import type { Order } from '@/lib/contracts'
import { getActiveScenario } from '../scenarios/index'
import { getDb, mutateDb } from '../db/db'
import type { DbState, OrderRecord } from '../db/types'
import { buildOrderUpdatedEvent, publishServerEvent } from '../events'
import { hashString } from '../http'
import { touchNft } from './nfts'

/** Tempo até o pagamento simulado ser resolvido. */
export const ORDER_SETTLE_MS = 2500

const timers = new Map<string, ReturnType<typeof setTimeout>>()

export function clearOrderTimers(): void {
  timers.forEach((t) => clearTimeout(t))
  timers.clear()
}

export function toOrder(record: OrderRecord): Order {
  const { userId: _u, idempotencyKey: _k, requestHash: _h, resolveAt: _r, ...order } = record
  void _u
  void _k
  void _h
  void _r
  return order
}

function fakeTxHash(orderId: string): string {
  const seed = hashString(orderId)
  return '0x' + Array.from({ length: 8 }, (_, i) => hashString(seed + i)).join('')
}

/** Idempotente: só age se o pedido ainda estiver pendente (e vencido, salvo `force`). */
export function settleOrder(db: DbState, order: OrderRecord, force = false): void {
  if (order.status !== 'pending') return
  if (!force && Date.now() < Date.parse(order.resolveAt)) return

  if (getActiveScenario().paymentOutcome === 'rejected') {
    order.status = 'rejected'
    order.rejectionReason = 'Pagamento recusado pela carteira.'
  } else {
    order.status = 'confirmed'
    order.transactionId = fakeTxHash(order.id)

    const cart = db.carts[`user:${order.userId}`]
    for (const line of order.lines) {
      const nft = db.nfts.find((n) => n.id === line.nftId)
      const edition = nft?.editions.find((e) => e.label === line.editionLabel)
      if (nft && edition) {
        edition.available = Math.max(0, edition.available - line.quantity)
        touchNft(db, nft)
      }
      // remove do carrinho apenas o que foi comprado
      const cartLine = cart?.items.find((i) => i.nftId === line.nftId && i.editionId === edition?.id)
      if (cart && cartLine) {
        cartLine.quantity -= line.quantity
        if (cartLine.quantity <= 0) cart.items = cart.items.filter((i) => i !== cartLine)
      }
    }
    if (cart && cart.items.length === 0) {
      delete cart.couponCode
      delete cart.lastQuote
      delete cart.scenarioFired
    }
  }

  order.version += 1
  publishServerEvent(buildOrderUpdatedEvent(db, order))
}

export function scheduleSettlement(orderId: string, delayMs = ORDER_SETTLE_MS): void {
  timers.get(orderId) && clearTimeout(timers.get(orderId))
  timers.set(
    orderId,
    setTimeout(() => {
      timers.delete(orderId)
      mutateDb((db) => {
        const order = db.orders.find((o) => o.id === orderId)
        if (order) settleOrder(db, order)
      })
    }, delayMs),
  )
}

/** Chamar ao iniciar os mocks: retoma pedidos pendentes após um refresh. */
export function bootstrapPendingOrders(): void {
  for (const order of getDb().orders) {
    if (order.status === 'pending') {
      scheduleSettlement(order.id, Math.max(0, Date.parse(order.resolveAt) - Date.now()))
    }
  }
}
