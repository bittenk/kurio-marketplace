import { COUPONS } from '../fixtures/coupons'
import { buildNfts } from '../fixtures/nfts'
import { USERS, WALLETS } from '../fixtures/users'
import type { DbState } from './types'

export const SCHEMA_VERSION = 1

/** Estado inicial conhecido e determinístico. Sempre devolve cópias novas. */
export function buildSeed(): DbState {
  return {
    schemaVersion: SCHEMA_VERSION,
    seq: 0,
    users: structuredClone(USERS),
    sessions: {},
    nfts: buildNfts(),
    coupons: structuredClone(COUPONS),
    favorites: {},
    carts: {},
    wallets: structuredClone(WALLETS),
    connectedWallets: {},
    orders: [],
  }
}
