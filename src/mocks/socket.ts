import { toSocketIo } from '@mswjs/socket.io-binding'
import { ws } from 'msw'
import type { ServerEvent } from '@/lib/contracts'
import { getDb } from './db/db'
import { subscribeServerEvents } from './events'
import { getActiveScenario } from './scenarios/index'

/**
 * Transporte: WebSocket puro (Engine.IO v4 + Socket.IO), interceptado pelo MSW
 * via `ws.link` e decodificado por `@mswjs/socket.io-binding`.
 *
 * Limitações do ambiente simulado (documentar no ARCHITECTURE.md):
 *  - só o transporte `websocket` (sem long-polling): o cliente precisa usar `transports: ['websocket']`;
 *  - só o namespace `/`, sem rooms ou broadcast nativos (o roteamento é feito aqui);
 *  - o servidor responde ao handshake e envia `ping` (Engine.IO) a cada 20 s.
 */
const PING_INTERVAL_MS = 20_000

// O MSW remove o prefixo `/socket.io/` do caminho antes de casar o padrão,
// então ligamos em `*` e filtramos pelo caminho dentro do handler.
const link = ws.link('*')

interface SocketConnection {
  io: ReturnType<typeof toSocketIo>
  close: (code?: number, reason?: string) => void
  /** Token enviado em `auth` no handshake do cliente. */
  token: string | null
}

const connections = new Set<SocketConnection>()

/** Usuário dono da conexão, revalidado a cada evento (logout invalida na hora). */
function userOf(connection: SocketConnection): string | null {
  if (!connection.token) return null
  const session = getDb().sessions[connection.token]
  return session && Date.parse(session.expiresAt) > Date.now() ? session.userId : null
}

function deliver(event: ServerEvent): void {
  for (const connection of connections) {
    // Dados privados só vão para o dono; catálogo é público.
    if (event.type === 'order.updated' && userOf(connection) !== event.userId) continue
    connection.io.client.emit(event.type, event)
  }
}

/** Derruba todas as conexões (simula queda de rede). O cliente reconecta sozinho. */
export function dropSocketConnections(): void {
  for (const connection of [...connections]) connection.close(1006, 'connection dropped')
}

export function socketConnectionCount(): number {
  return connections.size
}

let subscribed = false

export const socketHandlers = [
  link.addEventListener('connection', (wsConnection) => {
    if (!new URL(wsConnection.client.url).pathname.startsWith('/socket.io')) return

    if (getActiveScenario().connection === 'offline') {
      // Abre o Engine.IO e derruba em seguida: o cliente enxerga "transport close"
      // e entra no ciclo normal de reconexão (sem isso ficaria preso em "opening").
      wsConnection.client.send(
        '0' + JSON.stringify({ sid: 'offline', upgrades: [], pingInterval: 25000, pingTimeout: 5000 }),
      )
      setTimeout(() => wsConnection.client.close(1011, 'offline'), 0)
      return
    }

    const io = toSocketIo(wsConnection)
    const connection: SocketConnection = {
      io,
      token: null,
      close: (code, reason) => wsConnection.client.close(code, reason),
    }
    connections.add(connection)

    // Engine.IO exige `ping` do servidor; sem ele o cliente se desconecta após ~30 s.
    const ping = setInterval(() => wsConnection.client.send('2'), PING_INTERVAL_MS)

    // O binding não expõe o pacote CONNECT; lemos o `auth` dele diretamente.
    wsConnection.client.addEventListener('message', (message) => {
      if (typeof message.data !== 'string') return
      const match = message.data.match(/^40(\{[\s\S]*\})?$/)
      if (!match) return
      try {
        const auth = match[1] ? (JSON.parse(match[1]) as { token?: string }) : {}
        connection.token = auth.token ?? null
      } catch {
        connection.token = null
      }
    })

    wsConnection.client.addEventListener('close', () => {
      clearInterval(ping)
      connections.delete(connection)
    })
  }),
]

if (!subscribed) {
  subscribed = true
  subscribeServerEvents(deliver)
}
