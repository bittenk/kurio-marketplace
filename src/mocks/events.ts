import type { Nft, ServerEvent } from '@/lib/contracts'
import { nextId } from './db/db'
import type { DbState, OrderRecord } from './db/types'

type Listener = (event: ServerEvent) => void
const listeners = new Set<Listener>()

/** O servidor Socket.IO simulado assina aqui e repassa aos clientes. */
export function subscribeServerEvents(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function publishServerEvent(event: ServerEvent): void {
  listeners.forEach((listener) => listener(event))
}

export function buildNftUpdatedEvent(db: DbState, nft: Nft): ServerEvent {
  return {
    type: 'nft.updated',
    eventId: nextId(db, 'evt'),
    occurredAt: new Date().toISOString(),
    nftId: nft.id,
    version: nft.version,
    priceEth: nft.priceEth,
    previousPriceEth: nft.previousPriceEth,
    editions: nft.editions.map(({ id, available }) => ({ id, available })),
  }
}

export function buildOrderUpdatedEvent(db: DbState, order: OrderRecord): ServerEvent {
  return {
    type: 'order.updated',
    eventId: nextId(db, 'evt'),
    occurredAt: new Date().toISOString(),
    orderId: order.id,
    userId: order.userId,
    version: order.version,
    status: order.status,
    transactionId: order.transactionId,
    rejectionReason: order.rejectionReason,
  }
}
