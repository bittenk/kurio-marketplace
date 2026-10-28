import { http } from 'msw'
import type {
  ChangePasswordRequest, CreateWalletRequest, Network, UpdateProfileRequest, UpdateWalletRequest, Wallet, WalletProvider,
} from '@/lib/contracts'
import { nextId } from '../db/db'
import { hashPassword } from '../db/crypto'
import type { DbState } from '../db/types'
import {
  API, isEmail, jsonError, noContent, nonEmpty, ok, param, passwordError, publicUser, readJson, route,
  validationError, type Ctx, type FieldErrors,
} from '../http'

const MAX_AVATAR_CHARS = 700_000 // ~500 KB em base64
const NETWORKS: Network[] = ['ethereum', 'polygon', 'solana']
const PROVIDERS: WalletProvider[] = ['metamask', 'walletconnect', 'coinbase']
const ADDRESS_RE = /^(0x[0-9a-fA-F]{40}|[a-z0-9-]+(\.[a-z0-9-]+)*\.eth)$/i

const walletsOf = (db: DbState, userId: string): Wallet[] => (db.wallets[userId] ??= [])
const withConnection = (db: DbState, userId: string, w: Wallet): Wallet => ({
  ...w,
  connected: db.connectedWallets[userId] === w.id,
})

function validateWallet(body: Partial<CreateWalletRequest>, partial: boolean): FieldErrors {
  const errors: FieldErrors = {}
  const has = (k: keyof CreateWalletRequest) => !partial || body[k] !== undefined
  if (has('label') && !nonEmpty(body.label)) errors.label = 'Dê um nome à carteira.'
  if (has('address') && !(typeof body.address === 'string' && ADDRESS_RE.test(body.address.trim()))) {
    errors.address = 'Use um endereço 0x válido (42 caracteres) ou um nome .eth.'
  }
  if (has('network') && !(body.network && NETWORKS.includes(body.network))) errors.network = 'Selecione uma rede.'
  if (has('provider') && !(body.provider && PROVIDERS.includes(body.provider))) errors.provider = 'Selecione o provedor.'
  return errors
}

function ownWallet(ctx: Ctx): Wallet | undefined {
  return walletsOf(ctx.db, ctx.user!.id).find((w) => w.id === param(ctx, 'id'))
}

function makePrimary(list: Wallet[], id: string) {
  list.forEach((w) => { w.isPrimary = w.id === id })
}

export const accountHandlers = [
  // ---- perfil ----
  http.get(`${API}/profile`, route({ auth: 'required' }, ({ user }) => ok(publicUser(user!)))),

  http.patch(`${API}/profile`, route({ auth: 'required' }, async (ctx) => {
    const body = await readJson<UpdateProfileRequest>(ctx.request)
    const errors: FieldErrors = {}
    if (body.displayName !== undefined && !nonEmpty(body.displayName)) errors.displayName = 'Informe seu nome de exibição.'
    if (body.username !== undefined && (!nonEmpty(body.username) || body.username.trim().length < 3)) {
      errors.username = 'O usuário deve ter ao menos 3 caracteres.'
    }
    if (body.email !== undefined && !isEmail(body.email)) errors.email = 'Informe um e-mail válido.'
    if (body.ensName && !/^[a-z0-9-]+$/i.test(body.ensName)) errors.ensName = 'Use apenas letras, números e hífen.'
    if (typeof body.avatarUrl === 'string' && body.avatarUrl.length > MAX_AVATAR_CHARS) {
      errors.avatarUrl = 'A imagem é grande demais (máx. 500 KB).'
    }
    if (Object.keys(errors).length) return validationError(errors)

    const me = ctx.user!
    const conflicts: FieldErrors = {}
    const others = ctx.db.users.filter((u) => u.id !== me.id)
    if (body.email && others.some((u) => u.email.toLowerCase() === body.email!.trim().toLowerCase())) {
      conflicts.email = 'Este e-mail já está cadastrado.'
    }
    if (body.username && others.some((u) => u.username.toLowerCase() === body.username!.trim().toLowerCase())) {
      conflicts.username = 'Este usuário já está em uso.'
    }
    if (Object.keys(conflicts).length) {
      return jsonError('CONFLICT', 'Já existe uma conta com esses dados.', { fieldErrors: conflicts })
    }

    if (body.displayName !== undefined) me.displayName = body.displayName.trim()
    if (body.username !== undefined) me.username = body.username.trim()
    if (body.email !== undefined) me.email = body.email.trim().toLowerCase()
    if (body.ensName !== undefined) me.ensName = body.ensName || undefined
    if (body.walletNickname !== undefined) me.walletNickname = body.walletNickname || undefined
    if (body.avatarUrl !== undefined) me.avatarUrl = body.avatarUrl ?? undefined
    return ok(publicUser(me))
  })),

  http.put(`${API}/profile/password`, route({ auth: 'required' }, async (ctx) => {
    const body = await readJson<ChangePasswordRequest>(ctx.request)
    const errors: FieldErrors = {}
    if (!nonEmpty(body.currentPassword)) errors.currentPassword = 'Informe a senha atual.'
    const pwError = passwordError(body.newPassword)
    if (pwError) errors.newPassword = pwError
    if (Object.keys(errors).length) return validationError(errors)

    const me = ctx.user!
    if (me.passwordHash !== (await hashPassword(body.currentPassword!))) {
      return validationError({ currentPassword: 'Senha atual incorreta.' })
    }
    if (body.currentPassword === body.newPassword) {
      return validationError({ newPassword: 'A nova senha deve ser diferente da atual.' })
    }
    me.passwordHash = await hashPassword(body.newPassword!)
    return noContent()
  })),

  // ---- carteiras ----
  http.get(`${API}/wallets`, route({ auth: 'required' }, ({ db, user }) =>
    ok(walletsOf(db, user!.id).map((w) => withConnection(db, user!.id, w))))),

  http.post(`${API}/wallets`, route({ auth: 'required' }, async (ctx) => {
    const body = await readJson<CreateWalletRequest>(ctx.request)
    const errors = validateWallet(body, false)
    if (Object.keys(errors).length) return validationError(errors)

    const list = walletsOf(ctx.db, ctx.user!.id)
    const address = body.address!.trim()
    if (list.some((w) => w.address.toLowerCase() === address.toLowerCase())) {
      return jsonError('CONFLICT', 'Esta carteira já está cadastrada.', { fieldErrors: { address: 'Endereço já cadastrado.' } })
    }
    const wallet: Wallet = {
      id: nextId(ctx.db, 'wallet'),
      label: body.label!.trim(),
      address,
      network: body.network!,
      provider: body.provider!,
      isPrimary: list.length === 0 || body.isPrimary === true,
    }
    list.push(wallet)
    if (wallet.isPrimary) makePrimary(list, wallet.id)
    return ok(withConnection(ctx.db, ctx.user!.id, wallet), 201)
  })),

  http.patch(`${API}/wallets/:id`, route({ auth: 'required' }, async (ctx) => {
    const wallet = ownWallet(ctx)
    if (!wallet) return jsonError('NOT_FOUND', 'Carteira não encontrada.')
    const body = await readJson<UpdateWalletRequest>(ctx.request)
    const errors = validateWallet(body, true)
    if (Object.keys(errors).length) return validationError(errors)

    const list = walletsOf(ctx.db, ctx.user!.id)
    if (body.address && list.some((w) => w.id !== wallet.id && w.address.toLowerCase() === body.address!.trim().toLowerCase())) {
      return jsonError('CONFLICT', 'Esta carteira já está cadastrada.', { fieldErrors: { address: 'Endereço já cadastrado.' } })
    }
    if (body.label !== undefined) wallet.label = body.label.trim()
    if (body.address !== undefined) wallet.address = body.address.trim()
    if (body.network !== undefined) wallet.network = body.network
    if (body.provider !== undefined) wallet.provider = body.provider
    if (body.isPrimary === true) makePrimary(list, wallet.id)
    if (body.isPrimary === false && wallet.isPrimary) {
      return validationError({ isPrimary: 'Defina outra carteira como principal em vez de remover esta.' })
    }
    return ok(withConnection(ctx.db, ctx.user!.id, wallet))
  })),

  // ---- simulação de conexão ----
  http.post(`${API}/wallets/:id/connect`, route({ auth: 'required' }, (ctx) => {
    const wallet = ownWallet(ctx)
    if (!wallet) return jsonError('NOT_FOUND', 'Carteira não encontrada.')
    ctx.db.connectedWallets[ctx.user!.id] = wallet.id
    return ok(withConnection(ctx.db, ctx.user!.id, wallet))
  })),

  http.post(`${API}/wallets/:id/disconnect`, route({ auth: 'required' }, (ctx) => {
    const wallet = ownWallet(ctx)
    if (!wallet) return jsonError('NOT_FOUND', 'Carteira não encontrada.')
    if (ctx.db.connectedWallets[ctx.user!.id] === wallet.id) delete ctx.db.connectedWallets[ctx.user!.id]
    return noContent()
  })),
]
