import type { EthString } from '@/lib/money'
import type { Nft, Order, User, Wallet } from '@/lib/contracts'

export interface UserRecord extends User {
  /** SHA-256 de `kurio::<senha>`. Senhas nunca ficam em claro. */
  passwordHash: string
}

export interface SessionRecord {
  userId: string
  expiresAt: string
}

export interface CartLineRecord {
  nftId: string
  editionId: string
  quantity: number
}

/** O que o usuário viu na última cotação (para detectar mudanças). */
export interface QuoteSnapshot {
  quoteVersion: string
  /** Preço unitário por `nftId:editionId`. */
  prices: Record<string, string>
  feeEth: string
}

export interface CartRecord {
  items: CartLineRecord[]
  couponCode?: string
  lastQuote?: QuoteSnapshot
  /** Evita disparar o mesmo cenário de falha várias vezes no mesmo carrinho. */
  scenarioFired?: boolean
}

export interface Coupon {
  code: string
  type: 'percent' | 'fixed'
  /** Percentual (ex.: "10") ou valor fixo em ETH (ex.: "0.05"). */
  value: EthString
  expiresAt?: string
}

export interface OrderRecord extends Order {
  userId: string
  idempotencyKey: string
  /** Hash do corpo: mesma chave com conteúdo diferente gera conflito. */
  requestHash: string
  /** Quando o pagamento simulado é resolvido (sobrevive a refresh). */
  resolveAt: string
}

export interface DbState {
  schemaVersion: number
  /** Contador usado para gerar ids e eventos de forma determinística. */
  seq: number
  users: UserRecord[]
  sessions: Record<string, SessionRecord>
  nfts: Nft[]
  coupons: Coupon[]
  favorites: Record<string, string[]>
  /** Chave: `user:<id>` ou `guest:<id>`. */
  carts: Record<string, CartRecord>
  wallets: Record<string, Wallet[]>
  /** userId -> walletId conectada (simulação). */
  connectedWallets: Record<string, string>
  orders: OrderRecord[]
}
