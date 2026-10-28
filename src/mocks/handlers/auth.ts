import { http } from 'msw'
import type { AuthResponse, LoginRequest, RegisterRequest, Session } from '@/lib/contracts'
import { nextId } from '../db/db'
import { hashPassword } from '../db/crypto'
import type { DbState, UserRecord } from '../db/types'
import { mergeGuestCart } from '../domain/cart'
import {
  API, isEmail, jsonError, noContent, nonEmpty, ok, passwordError, publicUser, readJson, route,
  validationError, type FieldErrors,
} from '../http'

const SESSION_TTL_MS = 12 * 60 * 60 * 1000

function openSession(db: DbState, user: UserRecord): AuthResponse {
  const token = nextId(db, 'sess')
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString()
  db.sessions[token] = { userId: user.id, expiresAt }
  const session: Session = { user: publicUser(user), expiresAt }
  return { token, session }
}

export const authHandlers = [
  http.post(`${API}/auth/register`, route({ auth: 'none' }, async ({ request, db }) => {
    const body = await readJson<RegisterRequest>(request)
    const errors: FieldErrors = {}
    if (!nonEmpty(body.displayName)) errors.displayName = 'Informe seu nome de exibição.'
    if (!nonEmpty(body.username) || body.username.trim().length < 3) errors.username = 'O usuário deve ter ao menos 3 caracteres.'
    if (!isEmail(body.email)) errors.email = 'Informe um e-mail válido.'
    const pwError = passwordError(body.password)
    if (pwError) errors.password = pwError
    if (Object.keys(errors).length) return validationError(errors)

    const email = body.email!.trim().toLowerCase()
    const username = body.username!.trim()
    const conflicts: FieldErrors = {}
    if (db.users.some((u) => u.email.toLowerCase() === email)) conflicts.email = 'Este e-mail já está cadastrado.'
    if (db.users.some((u) => u.username.toLowerCase() === username.toLowerCase())) conflicts.username = 'Este usuário já está em uso.'
    if (Object.keys(conflicts).length) {
      return jsonError('CONFLICT', 'Já existe uma conta com esses dados.', { fieldErrors: conflicts })
    }

    const user: UserRecord = {
      id: nextId(db, 'user'),
      displayName: body.displayName!.trim(),
      username,
      email,
      passwordHash: await hashPassword(body.password!),
    }
    db.users.push(user)
    db.wallets[user.id] = []
    mergeGuestCart(db, body.guestId, user.id)
    return ok(openSession(db, user), 201)
  })),

  http.post(`${API}/auth/login`, route({ auth: 'none' }, async ({ request, db }) => {
    const body = await readJson<LoginRequest>(request)
    const errors: FieldErrors = {}
    if (!isEmail(body.email)) errors.email = 'Informe um e-mail válido.'
    if (!nonEmpty(body.password)) errors.password = 'Informe sua senha.'
    if (Object.keys(errors).length) return validationError(errors)

    const user = db.users.find((u) => u.email.toLowerCase() === body.email!.trim().toLowerCase())
    const valid = user && user.passwordHash === (await hashPassword(body.password!))
    if (!user || !valid) {
      return jsonError('VALIDATION_ERROR', 'E-mail ou senha incorretos.', {
        fieldErrors: { password: 'E-mail ou senha incorretos.' },
      })
    }
    mergeGuestCart(db, body.guestId, user.id)
    return ok(openSession(db, user))
  })),

  http.get(`${API}/auth/session`, route({ auth: 'required' }, ({ db, token }) => {
    const session = db.sessions[token!]
    const user = db.users.find((u) => u.id === session.userId)!
    return ok<Session>({ user: publicUser(user), expiresAt: session.expiresAt })
  })),

  http.post(`${API}/auth/logout`, route({ auth: 'optional' }, ({ db, token }) => {
    if (token) delete db.sessions[token]
    return noContent()
  })),
]
