import { http } from 'msw'
import type { Facets, ListNftsParams, Network, Nft, NftSort, NftTab, Page } from '@/lib/contracts'
import { compareEth, isEthString } from '@/lib/money'
import { CATEGORIES } from '../fixtures/nfts'
import { API, jsonError, noContent, ok, param, route, validationError, type FieldErrors } from '../http'

const NETWORKS: Network[] = ['ethereum', 'polygon', 'solana']
const SORTS: NftSort[] = ['recent', 'price_asc', 'price_desc', 'popular']
const TABS: NftTab[] = ['all', 'new', 'trending']
const NEW_WINDOW_MS = 14 * 86_400_000
const TRENDING_MIN = 60

const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/** Aceita `a=1&a=2` e `a=1,2`. */
function multi(url: URL, key: string): string[] {
  return url.searchParams.getAll(key).flatMap((v) => v.split(',')).map((v) => v.trim()).filter(Boolean)
}

function intParam(url: URL, key: string, fallback: number, errors: FieldErrors, min = 1, max = 100): number {
  const raw = url.searchParams.get(key)
  if (raw === null || raw === '') return fallback
  const n = Number(raw)
  if (!Number.isInteger(n) || n < min || n > max) {
    errors[key] = `Valor inválido para ${key}.`
    return fallback
  }
  return n
}

export const nftHandlers = [
  http.get(`${API}/nfts`, route({ auth: 'none' }, ({ url, db }) => {
    const errors: FieldErrors = {}
    const q = url.searchParams.get('q')?.trim() ?? ''
    const categories = multi(url, 'category')
    const networks = multi(url, 'network') as Network[]
    const minPrice = url.searchParams.get('minPrice') ?? undefined
    const maxPrice = url.searchParams.get('maxPrice') ?? undefined
    const tab = (url.searchParams.get('tab') ?? 'all') as NftTab
    const sort = (url.searchParams.get('sort') ?? 'recent') as NftSort

    if (minPrice && !isEthString(minPrice)) errors.minPrice = 'Preço mínimo inválido.'
    if (maxPrice && !isEthString(maxPrice)) errors.maxPrice = 'Preço máximo inválido.'
    if (!TABS.includes(tab)) errors.tab = 'Aba inválida.'
    if (!SORTS.includes(sort)) errors.sort = 'Ordenação inválida.'
    if (networks.some((n) => !NETWORKS.includes(n))) errors.network = 'Rede inválida.'
    const page = intParam(url, 'page', 1, errors, 1, 10_000)
    const pageSize = intParam(url, 'pageSize', 12, errors, 1, 48)
    if (Object.keys(errors).length) return validationError(errors)

    const newest = Math.max(...db.nfts.map((n) => Date.parse(n.listedAt)))
    const needle = normalize(q)

    let items: Nft[] = db.nfts.filter((n) => {
      if (needle && !normalize(`${n.name} ${n.tokenId} ${n.collectionName}`).includes(needle)) return false
      if (categories.length && !categories.includes(n.category)) return false
      if (networks.length && !networks.includes(n.network)) return false
      if (minPrice && compareEth(n.priceEth, minPrice) < 0) return false
      if (maxPrice && compareEth(n.priceEth, maxPrice) > 0) return false
      if (tab === 'new' && newest - Date.parse(n.listedAt) > NEW_WINDOW_MS) return false
      if (tab === 'trending' && n.popularity < TRENDING_MIN) return false
      return true
    })

    items = [...items].sort((a, b) => {
      let diff = 0
      if (sort === 'price_asc') diff = compareEth(a.priceEth, b.priceEth)
      else if (sort === 'price_desc') diff = compareEth(b.priceEth, a.priceEth)
      else if (sort === 'popular') diff = b.popularity - a.popularity
      else diff = Date.parse(b.listedAt) - Date.parse(a.listedAt)
      return diff || a.id.localeCompare(b.id)
    })

    const total = items.length
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const start = (page - 1) * pageSize
    const result: Page<Nft> = { items: items.slice(start, start + pageSize), page, pageSize, total, totalPages }
    return ok(result)
  })),

  http.get(`${API}/nfts/:id`, route({ auth: 'none' }, (ctx) => {
    const nft = ctx.db.nfts.find((n) => n.id === param(ctx, 'id'))
    return nft ? ok<Nft>(nft) : jsonError('NOT_FOUND', 'NFT não encontrado.')
  })),

  http.get(`${API}/facets`, route({ auth: 'none' }, ({ db }) => {
    const prices = db.nfts.map((n) => n.priceEth).sort(compareEth)
    const facets: Facets = {
      categories: CATEGORIES.map((c) => ({ ...c, count: db.nfts.filter((n) => n.category === c.id).length })),
      networks: NETWORKS.map((id) => ({ id, count: db.nfts.filter((n) => n.network === id).length })),
      priceRange: { minEth: prices[0], maxEth: prices[prices.length - 1] },
    }
    return ok(facets)
  })),

  // ---- favoritos (exigem autenticação) ----
  http.get(`${API}/favorites`, route({ auth: 'required' }, ({ db, user }) =>
    ok({ nftIds: db.favorites[user!.id] ?? [] }))),

  http.put(`${API}/favorites/:nftId`, route({ auth: 'required' }, (ctx) => {
    const id = param(ctx, 'nftId')
    if (!ctx.db.nfts.some((n) => n.id === id)) return jsonError('NOT_FOUND', 'NFT não encontrado.')
    const list = (ctx.db.favorites[ctx.user!.id] ??= [])
    if (!list.includes(id)) list.push(id)
    return ok({ nftIds: list })
  })),

  http.delete(`${API}/favorites/:nftId`, route({ auth: 'required' }, (ctx) => {
    const id = param(ctx, 'nftId')
    ctx.db.favorites[ctx.user!.id] = (ctx.db.favorites[ctx.user!.id] ?? []).filter((x) => x !== id)
    return noContent()
  })),
]

export type { ListNftsParams }
