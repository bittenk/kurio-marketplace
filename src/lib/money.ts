import Decimal from 'decimal.js'

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP })

/**
 * ETH sempre trafega como string decimal (ex.: "1.19").
 * Nunca usar `number` para valores monetários.
 */
export type EthString = string

const DECIMAL_RE = /^-?\d+(\.\d+)?$/
const MAX_DECIMALS = 18 // precisão de 1 wei

export function isEthString(value: unknown): value is EthString {
  return typeof value === 'string' && DECIMAL_RE.test(value)
}

function toDecimal(value: EthString): Decimal {
  if (!isEthString(value)) {
    throw new Error(`Valor ETH inválido: ${String(value)}`)
  }
  return new Decimal(value)
}

function toEthString(d: Decimal): EthString {
  return d.toDecimalPlaces(MAX_DECIMALS, Decimal.ROUND_HALF_UP).toFixed()
}

/** Quantidades são sempre inteiras e não negativas. */
export function assertQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new Error(`Quantidade inválida: ${quantity}`)
  }
}

export const ZERO_ETH: EthString = '0'

export function addEth(a: EthString, b: EthString): EthString {
  return toEthString(toDecimal(a).plus(toDecimal(b)))
}

export function subEth(a: EthString, b: EthString): EthString {
  return toEthString(toDecimal(a).minus(toDecimal(b)))
}

export function mulEth(price: EthString, quantity: number): EthString {
  assertQuantity(quantity)
  return toEthString(toDecimal(price).times(quantity))
}

export function sumEth(values: EthString[]): EthString {
  return toEthString(values.reduce((acc, v) => acc.plus(toDecimal(v)), new Decimal(0)))
}

/** Percentual de um valor: pctEth("26.83", "10") -> "2.683". */
export function pctEth(value: EthString, percent: string): EthString {
  return toEthString(toDecimal(value).times(toDecimal(percent)).div(100))
}

/** Retorna -1, 0 ou 1. */
export function compareEth(a: EthString, b: EthString): -1 | 0 | 1 {
  return toDecimal(a).comparedTo(toDecimal(b)) as -1 | 0 | 1
}

export function isSameEth(a: EthString, b: EthString): boolean {
  return compareEth(a, b) === 0
}

/**
 * Formata para exibição como no layout: até 3 casas, mínimo de 2.
 * "1.19" -> "1.19 ETH" | "26.846" -> "26.846 ETH" | "0.016" -> "0.016 ETH"
 */
export function formatEth(value: EthString, options: { suffix?: boolean } = {}): string {
  const { suffix = true } = options
  let text = toDecimal(value).toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toFixed(3)
  while (text.endsWith('0') && text.split('.')[1].length > 2) {
    text = text.slice(0, -1)
  }
  return suffix ? `${text} ETH` : text
}
