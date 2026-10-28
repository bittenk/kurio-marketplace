import { HttpResponse } from 'msw'
import type { ApiErrorBody, ServerEvent } from '@/lib/contracts'
import { getDb, resetDb } from './db/db'
import { publishServerEvent } from './events'
import { clearOrderTimers } from './domain/orders'
import { dropSocketConnections } from './socket'
import { setEditionAvailable, updateNftPrice } from './domain/nfts'
import { setActiveScenario, type ScenarioId } from './scenarios/index'
import { resetNetworkState } from './scenarios/network'

export interface FailureRule {
  method: string
  /** Aceita parâmetros: "/api/favorites/:id". */
  path: string
  status?: number
  body?: ApiErrorBody
  /** Simula queda de conexão em vez de resposta HTTP. */
  networkError?: boolean
  delayMs?: number
  /** Quantas vezes a falha é aplicada (padrão 1). */
  times?: number
}

const rules: (FailureRule & { regex: RegExp; remaining: number })[] = []

function toRegex(path: string): RegExp {
  const pattern = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/:[A-Za-z]+/g, '[^/]+')
  return new RegExp(`^${pattern}$`)
}

export function queueFailure(rule: FailureRule): void {
  rules.push({ ...rule, regex: toRegex(rule.path), remaining: rule.times ?? 1 })
}

export function clearFailures(): void {
  rules.length = 0
}

export function consumeFailure(
  method: string,
  pathname: string,
): { response: Response; delayMs?: number } | null {
  const rule = rules.find(
    (r) => r.remaining > 0 && r.method.toUpperCase() === method.toUpperCase() && r.regex.test(pathname),
  )
  if (!rule) return null
  rule.remaining -= 1
  if (rule.networkError) return { response: HttpResponse.error(), delayMs: rule.delayMs }
  const body: ApiErrorBody = rule.body ?? { code: 'TRANSIENT', message: 'Falha simulada.' }
  return { response: HttpResponse.json(body, { status: rule.status ?? 503 }), delayMs: rule.delayMs }
}

export function resetMocks(): void {
  clearOrderTimers()
  clearFailures()
  resetNetworkState()
  resetDb()
}

export interface MockControls {
  reset: () => void
  setScenario: (id: ScenarioId) => void
  queueFailure: (rule: FailureRule) => void
  clearFailures: () => void
  /** Muda o preço e dispara `nft.updated` pelo Socket.IO. */
  changeNftPrice: (nftId: string, priceEth: string) => void
  /** Muda a disponibilidade e dispara `nft.updated`. */
  setEditionAvailability: (nftId: string, editionId: string, available: number) => void
  /** Derruba as conexões Socket.IO (o cliente deve reconectar e reconciliar). */
  dropConnections: () => void
  /** Publica um evento arbitrário (duplicado, antigo...) no servidor Socket.IO. */
  publishEvent: (event: ServerEvent) => void
  getState: () => unknown
}

export function installMockControls(): void {
  const controls: MockControls = {
    reset: resetMocks,
    setScenario: setActiveScenario,
    queueFailure,
    clearFailures,
    changeNftPrice: updateNftPrice,
    setEditionAvailability: setEditionAvailable,
    dropConnections: dropSocketConnections,
    publishEvent: publishServerEvent,
    getState: () => structuredClone(getDb()),
  }
  ;(window as unknown as { __kurioMocks: MockControls }).__kurioMocks = controls
}
