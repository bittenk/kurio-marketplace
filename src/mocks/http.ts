import { delay, HttpResponse, type HttpResponseResolver, type PathParams } from 'msw'
import type { ApiErrorBody, ApiErrorCode } from '@/lib/contracts'
import { consumeFailure } from './control'
import { getDb, persistDb } from './db/db'
import type { DbState, UserRecord } from './db/types'
import { applyNetworkConditions, shouldExpireSession } from './scenarios/network'

/** `*` casa com qualquer origem, então funciona no navegador e no Node. */
export const API = '*/api'

const STATUS: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 422,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TRANSIENT: 503,
}

export type FieldErrors = Record<string, string>

export function jsonError(
  code: ApiErrorCode,
  message: string,
  extra: Pick<ApiErrorBody, 'fieldErrors' | 'details'> = {},
): Response {
  const body: ApiErrorBody = { code, message, ...extra }
  return HttpResponse.json(body, { status: STATUS[code] })
}

export function validationError(fieldErrors: FieldErrors, message = 'Revise os campos destacados.') {
  return jsonError('VALIDATION_ERROR', message, { fieldErrors })
}

export function ok<T>(data: T, status = 200): Response {
  return HttpResponse.json(data as never, { status })
}

export function noContent(): Response {
  return new HttpResponse(null, { status: 204 })
}

export async function readJson<T>(request: Request): Promise<Partial<T>> {
  try {
    const data = (await request.json()) as unknown
    return data && typeof data === 'object' ? (data as Partial<T>) : {}
  } catch {
    return {}
  }
}

export interface Ctx {
  request: Request
  url: URL
  params: PathParams
  db: DbState
  user: UserRecord | null
  token: string | null
}

export function param(ctx: Ctx, name: string): string {
  const value = ctx.params[name]
  return Array.isArray(value) ? String(value[0]) : String(value)
}

function bearer(request: Request): string | null {
  const header = request.headers.get('authorization')
  const match = header?.match(/^Bearer\s+(.+)$/i)
  return match ? match[1] : null
}

type AuthMode = 'required' | 'optional' | 'none'

/**
 * Envolve cada handler com: condições de rede do cenário, falhas injetadas,
 * autenticação/expiração de sessão e persistência do banco.
 */
export function route(
  options: { auth: AuthMode },
  fn: (ctx: Ctx) => Response | Promise<Response>,
): HttpResponseResolver {
  return async ({ request, params }) => {
    const network = await applyNetworkConditions()
    if (network) return network

    const url = new URL(request.url)
    const injected = consumeFailure(request.method, url.pathname)
    if (injected) {
      if (injected.delayMs) await delay(injected.delayMs)
      return injected.response
    }

    const db = getDb()
    const token = bearer(request)
    let user: UserRecord | null = null

    if (token && options.auth !== 'none') {
      const session = db.sessions[token]
      if (session && Date.parse(session.expiresAt) > Date.now()) {
        if (shouldExpireSession()) {
          delete db.sessions[token]
          persistDb()
          return jsonError('UNAUTHENTICATED', 'Sua sessão expirou. Entre novamente.', {
            details: { reason: 'SESSION_EXPIRED' },
          })
        }
        user = db.users.find((u) => u.id === session.userId) ?? null
      } else if (session) {
        delete db.sessions[token]
        persistDb()
      }
    }

    if (options.auth === 'required' && !user) {
      return jsonError('UNAUTHENTICATED', 'Faça login para continuar.', {
        details: { reason: token ? 'SESSION_EXPIRED' : 'MISSING_TOKEN' },
      })
    }

    const response = await fn({ request, url, params, db, user, token })
    persistDb()
    return response
  }
}

/* ---------------- validações ---------------- */

export const isEmail = (v: unknown): v is string =>
  typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())

export function passwordError(v: unknown): string | null {
  if (typeof v !== 'string' || v.length < 8) return 'A senha deve ter ao menos 8 caracteres.'
  if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) return 'Use letras e números na senha.'
  return null
}

export const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0

/** Hash simples e estável (não criptográfico) para versões e idempotência. */
export function hashString(input: string): string {
  let h = 5381
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) | 0
  return (h >>> 0).toString(16).padStart(8, '0')
}

export function publicUser(user: UserRecord) {
  const { passwordHash: _omit, ...rest } = user
  void _omit
  return rest
}
