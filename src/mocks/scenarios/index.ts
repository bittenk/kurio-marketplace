export type ScenarioId =
  | 'default'
  | 'slow'
  | 'variable-latency'
  | 'offline'
  | 'server-errors'
  | 'session-expired'
  | 'coupon-expired'
  | 'price-changed'
  | 'sold-out'
  | 'order-timeout'
  | 'payment-rejected'

export interface ScenarioConfig {
  id: ScenarioId
  label: string
  description: string
  latency: { minMs: number; maxMs: number }
  /** Requisições posteriores respondem antes das anteriores. */
  outOfOrder: boolean
  connection: 'online' | 'offline'
  /** Toda N-ésima requisição falha com o status indicado. */
  serverErrors: { everyNth: number; status: 500 | 502 | 503 } | null
  /** A sessão expira depois de N requisições autenticadas. */
  sessionExpiresAfterRequests: number | null
  couponAlwaysExpired: boolean
  priceChangeAtCheckout: boolean
  soldOutAtCheckout: boolean
  /** O pedido é criado, mas a resposta nunca chega (timeout). */
  orderTimeoutAfterCreate: boolean
  paymentOutcome: 'confirmed' | 'rejected'
}

const BASE: Omit<ScenarioConfig, 'id' | 'label' | 'description'> = {
  latency: { minMs: 80, maxMs: 250 },
  outOfOrder: false,
  connection: 'online',
  serverErrors: null,
  sessionExpiresAfterRequests: null,
  couponAlwaysExpired: false,
  priceChangeAtCheckout: false,
  soldOutAtCheckout: false,
  orderTimeoutAfterCreate: false,
  paymentOutcome: 'confirmed',
}

export const SCENARIOS: Record<ScenarioId, ScenarioConfig> = {
  default: { ...BASE, id: 'default', label: 'Padrão', description: 'Sucesso, com latência baixa.' },
  slow: {
    ...BASE,
    id: 'slow',
    label: 'Rede lenta',
    description: 'Todas as respostas levam de 1,5 a 3 s (testa skeletons).',
    latency: { minMs: 1500, maxMs: 3000 },
  },
  'variable-latency': {
    ...BASE,
    id: 'variable-latency',
    label: 'Latência variável e fora de ordem',
    description: 'Respostas mais novas chegam antes das antigas.',
    latency: { minMs: 100, maxMs: 2400 },
    outOfOrder: true,
  },
  offline: {
    ...BASE,
    id: 'offline',
    label: 'Sem conexão',
    description: 'Toda requisição falha com erro de rede.',
    connection: 'offline',
  },
  'server-errors': {
    ...BASE,
    id: 'server-errors',
    label: 'Erros 5xx intermitentes',
    description: 'Toda 3ª requisição responde 503.',
    serverErrors: { everyNth: 3, status: 503 },
  },
  'session-expired': {
    ...BASE,
    id: 'session-expired',
    label: 'Sessão expirada',
    description: 'A sessão expira após 6 requisições autenticadas.',
    sessionExpiresAfterRequests: 6,
  },
  'coupon-expired': {
    ...BASE,
    id: 'coupon-expired',
    label: 'Cupom expirado',
    description: 'Qualquer cupom é tratado como expirado.',
    couponAlwaysExpired: true,
  },
  'price-changed': {
    ...BASE,
    id: 'price-changed',
    label: 'Preço alterado no checkout',
    description: 'O preço de um item muda entre o carrinho e a confirmação.',
    priceChangeAtCheckout: true,
  },
  'sold-out': {
    ...BASE,
    id: 'sold-out',
    label: 'Edição esgotada',
    description: 'A edição esgota durante a compra.',
    soldOutAtCheckout: true,
  },
  'order-timeout': {
    ...BASE,
    id: 'order-timeout',
    label: 'Timeout após criar pedido',
    description: 'O pedido é criado, mas a resposta não chega. Reenviar recupera o mesmo pedido.',
    orderTimeoutAfterCreate: true,
  },
  'payment-rejected': {
    ...BASE,
    id: 'payment-rejected',
    label: 'Pagamento recusado',
    description: 'O pedido termina como recusado.',
    paymentOutcome: 'rejected',
  },
}

const STORAGE_KEY = 'kurio:mock-scenario'

type EnvMeta = ImportMeta & { env?: Record<string, string | undefined> }

function isScenarioId(value: string | null | undefined): value is ScenarioId {
  return !!value && value in SCENARIOS
}

/** Prioridade: ?scenario=... na URL > localStorage > VITE_MOCK_SCENARIO > default. */
export function getActiveScenario(): ScenarioConfig {
  const fromUrl =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('scenario') : null
  if (isScenarioId(fromUrl)) return SCENARIOS[fromUrl]

  try {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    if (isScenarioId(stored)) return SCENARIOS[stored]
  } catch {
    /* ignora */
  }

  const fromEnv = (import.meta as EnvMeta).env?.VITE_MOCK_SCENARIO
  return isScenarioId(fromEnv) ? SCENARIOS[fromEnv] : SCENARIOS.default
}

export function setActiveScenario(id: ScenarioId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    /* ignora */
  }
}
