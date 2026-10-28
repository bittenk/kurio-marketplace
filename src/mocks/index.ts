import { installMockControls } from './control'
import { bootstrapPendingOrders } from './domain/orders'

/**
 * Chame antes de renderizar o app (em main.tsx):
 *   if (import.meta.env.VITE_ENABLE_MOCKS === 'true') await enableMocking()
 */
export async function enableMocking(): Promise<void> {
  const { worker } = await import('./browser')
  // MSW 2 usa `onUnhandledRequest`; MSW 3 renomeou para `onUnhandledFrame`.
  // Passar os dois deixa o código compatível com qualquer uma das versões.
  const options = {
    onUnhandledFrame: 'bypass',
    onUnhandledRequest: 'bypass',
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  }
  await worker.start(options as Parameters<typeof worker.start>[0])
  installMockControls()
  bootstrapPendingOrders()
}
