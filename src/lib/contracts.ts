import type { EthString } from './money'

/* ------------------------------------------------------------------ */
/* Erros                                                               */
/* ------------------------------------------------------------------ */

export type ApiErrorCode =
  | 'VALIDATION_ERROR' // 422 - campos inválidos
  | 'UNAUTHENTICATED' // 401 - sessão inválida ou expirada
  | 'FORBIDDEN' // 403 - sem permissão
  | 'NOT_FOUND' // 404 - recurso inexistente
  | 'CONFLICT' // 409 - disponibilidade, e-mail já usado, idempotência
  | 'TRANSIENT' // 5xx / timeout - pode tentar de novo

export interface ApiErrorBody {
  code: ApiErrorCode
  message: string
  fieldErrors?: Record<string, string>
  details?: Record<string, unknown>
}

/* ------------------------------------------------------------------ */
/* Sessão e conta                                                      */
/* ------------------------------------------------------------------ */

export interface User {
  id: string
  displayName: string
  username: string
  email: string
  ensName?: string
  walletNickname?: string
  avatarUrl?: string
}

export interface Session {
  user: User
  expiresAt: string // ISO
}

export interface LoginRequest {
  email: string
  password: string
  /** Carrinho de visitante a ser mesclado ao autenticar. */
  guestId?: string
}

export interface RegisterRequest {
  displayName: string
  username: string
  email: string
  password: string
  guestId?: string
}

/** O token vai no header `Authorization: Bearer <token>`. */
export interface AuthResponse {
  token: string
  session: Session
}

export interface UpdateProfileRequest {
  displayName?: string
  username?: string
  email?: string
  ensName?: string
  walletNickname?: string
  avatarUrl?: string | null
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

/* ------------------------------------------------------------------ */
/* NFTs                                                                */
/* ------------------------------------------------------------------ */

export type Network = 'ethereum' | 'polygon' | 'solana'
export type NftSort = 'recent' | 'price_asc' | 'price_desc' | 'popular'
export type NftTab = 'all' | 'new' | 'trending'

export interface NftEdition {
  id: string
  label: string // "1/1", "1/10", "1/50"
  supply: number
  available: number
}

export interface Nft {
  id: string
  name: string // "Emerald Ape #042"
  tokenId: string // "#0042"
  collectionId: string // "Mais desta coleção"
  collectionName: string // "Kurio Apes"
  /** Categoria da barra lateral (Arte digital, Fotografia...). */
  category: string
  priceEth: EthString
  previousPriceEth?: EthString
  imageUrl: string
  gallery: string[]
  network: Network
  rarity?: 'rare' | 'common'
  rating: number
  reviewsCount: number
  description: string
  attributes: string[]
  editions: NftEdition[]
  listedAt: string // ISO - aba "Novos lançamentos" e ordenação por recentes
  popularity: number // 0-100 - aba "Em alta"
  /** Incrementa a cada mudança de preço/disponibilidade. */
  version: number
}

export interface ListNftsParams {
  q?: string
  category?: string[]
  network?: Network[]
  minPrice?: EthString
  maxPrice?: EthString
  tab?: NftTab
  sort?: NftSort
  page?: number
  pageSize?: number
}

export interface Page<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface CategorySummary {
  id: string
  name: string
  count: number
}

export interface Facets {
  categories: CategorySummary[]
  networks: { id: Network; count: number }[]
  priceRange: { minEth: EthString; maxEth: EthString }
}

/* ------------------------------------------------------------------ */
/* Favoritos                                                           */
/* ------------------------------------------------------------------ */

export interface FavoritesResponse {
  nftIds: string[]
}

/* ------------------------------------------------------------------ */
/* Carrinho e cotação                                                  */
/* ------------------------------------------------------------------ */

export interface CartItem {
  nftId: string
  editionId: string
  quantity: number
  /** Preço unitário vigente quando o carrinho foi calculado. */
  unitPriceEth: EthString
  lineTotalEth: EthString
  available: number
}

export interface CartTotals {
  subtotalEth: EthString
  discountEth: EthString
  networkFeeEth: EthString
  totalEth: EthString
}

export interface Cart {
  items: CartItem[]
  couponCode?: string
  totals: CartTotals
  /** Muda a cada alteração; usada para detectar cotação desatualizada. */
  quoteVersion: string
}

export interface AddCartItemRequest {
  nftId: string
  editionId: string
  quantity: number
}

export interface UpdateCartItemRequest {
  quantity: number
}

export interface ApplyCouponRequest {
  code: string
}

export type CheckoutIssueType =
  | 'PRICE_CHANGED'
  | 'OUT_OF_STOCK'
  | 'COUPON_INVALID'
  | 'FEE_CHANGED'

export interface CheckoutIssue {
  type: CheckoutIssueType
  nftId?: string
  message: string
}

export interface CheckoutQuote {
  cart: Cart
  issues: CheckoutIssue[]
  /** Precisa ser reenviada na criação do pedido. */
  quoteVersion: string
  expiresAt: string
}

/* ------------------------------------------------------------------ */
/* Carteiras                                                           */
/* ------------------------------------------------------------------ */

export type WalletProvider = 'metamask' | 'walletconnect' | 'coinbase'

export interface Wallet {
  id: string
  label: string // "Principal", "Reserva"
  address: string // 0xA91F...E82C ou ENS
  network: Network
  provider: WalletProvider
  isPrimary: boolean
  /** Preenchido pela API: simulação de conexão. */
  connected?: boolean
}

export type CreateWalletRequest = Omit<Wallet, 'id' | 'connected'>
export type UpdateWalletRequest = Partial<Omit<Wallet, 'id' | 'connected'>>

/* ------------------------------------------------------------------ */
/* Pedidos                                                             */
/* ------------------------------------------------------------------ */

export type OrderStatus = 'pending' | 'confirmed' | 'rejected'

export interface OrderLine {
  nftId: string
  name: string
  tokenId: string
  imageUrl: string
  editionLabel: string
  quantity: number
  unitPriceEth: EthString
  lineTotalEth: EthString
}

export interface CreateOrderRequest {
  walletId: string
  network: Network
  provider: WalletProvider
  collector: {
    displayName: string
    username: string
    email: string
    walletAddress: string
    note?: string
  }
  quoteVersion: string
}

/** 409 ao criar pedido com cotação desatualizada ou item indisponível. */
export interface OrderConflictDetails {
  issues: CheckoutIssue[]
  quote: CheckoutQuote
}

/** Header obrigatório na criação: `Idempotency-Key`. */
export interface Order {
  id: string
  status: OrderStatus
  /** Snapshot imutável: alterações no catálogo não mudam o recibo. */
  lines: OrderLine[]
  totals: CartTotals
  transactionId?: string
  walletProvider: WalletProvider
  createdAt: string
  rejectionReason?: string
  version: number
}

/* ------------------------------------------------------------------ */
/* Eventos Socket.IO                                                   */
/* ------------------------------------------------------------------ */

interface BaseEvent {
  /** Identidade estável: permite descartar duplicatas. */
  eventId: string
  occurredAt: string
}

export interface NftUpdatedEvent extends BaseEvent {
  type: 'nft.updated'
  nftId: string
  version: number
  priceEth: EthString
  previousPriceEth?: EthString
  editions: Pick<NftEdition, 'id' | 'available'>[]
}

export interface OrderUpdatedEvent extends BaseEvent {
  type: 'order.updated'
  orderId: string
  /** Eventos de sessões anteriores devem ser ignorados. */
  userId: string
  version: number
  status: OrderStatus
  transactionId?: string
  rejectionReason?: string
}

export type ServerEvent = NftUpdatedEvent | OrderUpdatedEvent
