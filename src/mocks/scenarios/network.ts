import { delay, HttpResponse } from 'msw'
import type { ApiErrorBody } from '@/lib/contracts'
import { getActiveScenario } from './index'

/** PRNG determinístico: mesma sequência de latências a cada execução. */
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SEED = 1337
let random = mulberry32(SEED)
let requestCount = 0
let authedCount = 0
let sessionExpiryFired = false

export function resetNetworkState(): void {
  random = mulberry32(SEED)
  requestCount = 0
  authedCount = 0
  sessionExpiryFired = false
}

function errorBody(code: ApiErrorBody['code'], message: string): ApiErrorBody {
  return { code, message }
}

/**
 * Aplica latência, queda de conexão e erros 5xx do cenário ativo.
 * Se devolver uma resposta, o handler deve retorná-la sem processar nada.
 */
export async function applyNetworkConditions(): Promise<Response | undefined> {
  const scenario = getActiveScenario()
  requestCount += 1

  if (scenario.connection === 'offline') {
    return HttpResponse.error()
  }

  const { minMs, maxMs } = scenario.latency
  let wait = minMs + random() * (maxMs - minMs)
  if (scenario.outOfOrder) {
    // Dentro de cada ciclo de 4 requisições, as mais novas são mais rápidas.
    const step = (maxMs - minMs) / 4
    wait = maxMs - ((requestCount - 1) % 4) * step
  }
  await delay(Math.round(wait))

  const errors = scenario.serverErrors
  if (errors && requestCount % errors.everyNth === 0) {
    return HttpResponse.json(errorBody('TRANSIENT', 'Serviço temporariamente indisponível.'), {
      status: errors.status,
    })
  }
  return undefined
}

/** Chame em rotas autenticadas. Retorna true uma vez, quando a sessão deve expirar. */
export function shouldExpireSession(): boolean {
  const limit = getActiveScenario().sessionExpiresAfterRequests
  if (limit === null || sessionExpiryFired) return false
  authedCount += 1
  if (authedCount > limit) {
    sessionExpiryFired = true
    return true
  }
  return false
}
