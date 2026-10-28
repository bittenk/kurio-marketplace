import type { Coupon } from '../db/types'

export const COUPONS: Coupon[] = [
  { code: 'KURIO10', type: 'percent', value: '10' },
  { code: 'MINT005', type: 'fixed', value: '0.05' },
  { code: 'EXPIRADO20', type: 'percent', value: '20', expiresAt: '2026-01-01T00:00:00.000Z' },
]
