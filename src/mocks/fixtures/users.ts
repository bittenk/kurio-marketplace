import type { Wallet } from '@/lib/contracts'
import type { UserRecord } from '../db/types'

/**
 * Credenciais fictícias (documentar no README):
 *  - ana@kurio.test   / Kurio@123
 *  - bruno@kurio.test / Kurio@456
 */
export const USERS: UserRecord[] = [
  {
    id: 'user-ana',
    displayName: 'Ana Colecionadora',
    username: 'ana.collector',
    email: 'ana@kurio.test',
    ensName: 'ana',
    walletNickname: 'ana-main',
    passwordHash: '60b4f57b928d8cfd5995d87ed8fee505fec3c8292a828dc10e7a27e33fd49f4c',
  },
  {
    id: 'user-bruno',
    displayName: 'Bruno Cunhador',
    username: 'bruno.mint',
    email: 'bruno@kurio.test',
    ensName: 'bruno',
    walletNickname: 'bruno-main',
    passwordHash: '95dbf83a5429f6a3f508a20f0ca9e7a99bd01032c264f3c504d540b1bd8aa49d',
  },
]

export const WALLETS: Record<string, Wallet[]> = {
  'user-ana': [
    {
      id: 'wallet-ana-main',
      label: 'Principal',
      address: '0xA91F4c2B7d5e8a3F0b6D9c1E2a7B4f3D5c8EE82C',
      network: 'ethereum',
      provider: 'metamask',
      isPrimary: true,
    },
    {
      id: 'wallet-ana-reserve',
      label: 'Reserva',
      address: 'nova.kurio.eth',
      network: 'polygon',
      provider: 'walletconnect',
      isPrimary: false,
    },
  ],
  'user-bruno': [
    {
      id: 'wallet-bruno-main',
      label: 'Principal',
      address: '0x7B3d9F1a2C4e6A8b0D5f7E9c1B3a5D7f9E1c3A5b',
      network: 'ethereum',
      provider: 'coinbase',
      isPrimary: true,
    },
  ],
}
