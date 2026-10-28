import type { CategorySummary, Network, Nft, NftEdition } from '@/lib/contracts'
import { addEth, mulEth } from '@/lib/money'

/** Exporte estas 8 imagens do Figma para public/assets/nfts/<slug>.png */
const IMAGE_EXT = 'png'

export const CATEGORIES: Omit<CategorySummary, 'count'>[] = [
  { id: 'arte-digital', name: 'Arte digital' },
  { id: 'fotografia', name: 'Fotografia' },
  { id: 'musica', name: 'Música' },
  { id: 'arte-3d', name: 'Arte 3D' },
  { id: 'colecionaveis', name: 'Colecionáveis' },
  { id: 'generativa', name: 'Generativa' },
  { id: 'jogos', name: 'Jogos' },
  { id: 'assinaturas', name: 'Assinaturas' },
  { id: 'utilidade', name: 'Utilidade' },
]

const COLLECTIONS = [
  { id: 'kurio-apes', name: 'Kurio Apes' },
  { id: 'kurio-nomads', name: 'Kurio Nomads' },
  { id: 'kurio-beats', name: 'Kurio Beats' },
]

interface BaseNft {
  slug: string
  name: string
  priceEth: string
  previousPriceEth?: string
  token: number
  attributes: string[]
}

/** Os 8 primeiros reproduzem os cards do Figma (nome, token e preço). */
const BASES: BaseNft[] = [
  { slug: 'emerald-ape', name: 'Emerald Ape', priceEth: '1.19', token: 42, attributes: ['Óculos', 'Esmeralda', 'Raro'] },
  { slug: 'sage-nomad', name: 'Sage Nomad', priceEth: '1.69', token: 9, attributes: ['Chapéu', 'Sálvia', 'Comum'] },
  { slug: 'neon-vessel', name: 'Neon Vessel', priceEth: '1.99', previousPriceEth: '2.29', token: 552, attributes: ['Gola alta', 'Neon', 'Raro'] },
  { slug: 'cosmic-bloom', name: 'Cosmic Bloom', priceEth: '1.29', token: 118, attributes: ['Chapéu', 'Lilás', 'Comum'] },
  { slug: 'violet-nomad', name: 'Violet Nomad', priceEth: '1.39', token: 314, attributes: ['Moletom', 'Violeta', 'Comum'] },
  { slug: 'ivory-baron', name: 'Ivory Baron', priceEth: '1.79', token: 88, attributes: ['Blazer', 'Marfim', 'Raro'] },
  { slug: 'golden-beat', name: 'Golden Beat', priceEth: '0.99', token: 207, attributes: ['Fones', 'Dourado', 'Comum'] },
  { slug: 'golden-signal', name: 'Golden Signal', priceEth: '0.39', token: 160, attributes: ['Fones', 'Sinal', 'Comum'] },
]

const NETWORKS: Network[] = ['ethereum', 'polygon', 'solana']
const TOTAL = 48
const BASE_DATE = Date.parse('2026-10-20T12:00:00.000Z')
const DAY_MS = 86_400_000

const pad = (n: number, size = 3) => String(n).padStart(size, '0')

function buildEditions(index: number): NftEdition[] {
  return [
    { id: `ed-1-1`, label: '1/1', supply: 1, available: index % 4 === 3 ? 0 : 1 },
    { id: `ed-1-10`, label: '1/10', supply: 10, available: (index * 3) % 11 },
    { id: `ed-1-50`, label: '1/50', supply: 50, available: 10 + ((index * 7) % 41) },
  ]
}

export function buildNfts(): Nft[] {
  return Array.from({ length: TOTAL }, (_, i) => {
    const base = BASES[i % BASES.length]
    const token = i < BASES.length ? base.token : 200 + i * 13
    const collection = COLLECTIONS[(i % BASES.length) % COLLECTIONS.length]
    const isFirst = i === 0
    const priceEth = i < BASES.length ? base.priceEth : addEth(base.priceEth, mulEth('0.07', i % 5))
    const rare = base.attributes.includes('Raro') || i % 7 === 0

    return {
      id: `nft-${pad(i + 1)}`,
      name: `${base.name} #${pad(token)}`,
      tokenId: `#${pad(token, 4)}`,
      collectionId: collection.id,
      collectionName: collection.name,
      category: CATEGORIES[i % CATEGORIES.length].id,
      priceEth,
      previousPriceEth: i < BASES.length ? base.previousPriceEth : undefined,
      imageUrl: `/assets/nfts/${base.slug}.${IMAGE_EXT}`,
      gallery: Array.from({ length: 4 }, () => `/assets/nfts/${base.slug}.${IMAGE_EXT}`),
      network: NETWORKS[i % NETWORKS.length],
      rarity: rare ? 'rare' : 'common',
      rating: isFirst ? 4.8 : Number((4 + (i % 10) / 10).toFixed(1)),
      reviewsCount: isFirst ? 19 : 5 + ((i * 3) % 40),
      description: `${base.name} #${pad(token)} é uma obra digital finalizada à mão da coleção ${collection.name}, verificada na Ethereum, com arte desbloqueável e acesso para colecionadores.`,
      attributes: base.attributes,
      editions: buildEditions(i),
      listedAt: new Date(BASE_DATE - i * DAY_MS).toISOString(),
      popularity: (i * 37) % 100,
      version: 1,
    }
  })
}
