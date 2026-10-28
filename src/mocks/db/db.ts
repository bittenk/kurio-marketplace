import { buildSeed, SCHEMA_VERSION } from './seed'
import type { DbState } from './types'

const STORAGE_KEY = 'kurio:mock-db'

let state: DbState | null = null

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

function load(): DbState {
  const raw = storage()?.getItem(STORAGE_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as DbState
      if (parsed.schemaVersion === SCHEMA_VERSION) return parsed
    } catch {
      /* dado corrompido: cai no seed */
    }
  }
  return buildSeed()
}

export function persistDb(): void {
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* cota cheia ou storage indisponível: segue só em memória */
  }
}

export function getDb(): DbState {
  state ??= load()
  return state
}

/** Toda escrita passa por aqui para garantir persistência após atualizar a página. */
export function mutateDb<T>(fn: (db: DbState) => T): T {
  const result = fn(getDb())
  persistDb()
  return result
}

/** Restaura integralmente o cenário conhecido e limpa o que estava persistido. */
export function resetDb(): void {
  state = buildSeed()
  storage()?.removeItem(STORAGE_KEY)
  persistDb()
}

/** Ids determinísticos: order-0001, evt-0007... */
export function nextId(db: DbState, prefix: string): string {
  db.seq += 1
  return `${prefix}-${String(db.seq).padStart(4, '0')}`
}
