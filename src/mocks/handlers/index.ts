import { accountHandlers } from './account'
import { authHandlers } from './auth'
import { cartHandlers } from './cart'
import { nftHandlers } from './nfts'
import { orderHandlers } from './orders'
import { socketHandlers } from '../socket'

export const handlers = [
  ...authHandlers,
  ...nftHandlers,
  ...cartHandlers,
  ...orderHandlers,
  ...accountHandlers,
  ...socketHandlers,
]
