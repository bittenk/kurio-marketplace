import type { Nft } from '@/lib/contracts'
import type { EthString } from '@/lib/money'
import { mutateDb } from '../db/db'
import type { DbState } from '../db/types'
import { buildNftUpdatedEvent, publishServerEvent } from '../events'

/** Incrementa a versão e avisa os clientes conectados. */
export function touchNft(db: DbState, nft: Nft): void {
  nft.version += 1
  publishServerEvent(buildNftUpdatedEvent(db, nft))
}

export function updateNftPrice(nftId: string, priceEth: EthString): void {
  mutateDb((db) => {
    const nft = db.nfts.find((n) => n.id === nftId)
    if (!nft) return
    nft.previousPriceEth = nft.priceEth
    nft.priceEth = priceEth
    touchNft(db, nft)
  })
}

export function setEditionAvailable(nftId: string, editionId: string, available: number): void {
  mutateDb((db) => {
    const nft = db.nfts.find((n) => n.id === nftId)
    const edition = nft?.editions.find((e) => e.id === editionId)
    if (!nft || !edition) return
    edition.available = Math.max(0, Math.min(edition.supply, Math.floor(available)))
    touchNft(db, nft)
  })
}
