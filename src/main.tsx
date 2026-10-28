import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

async function bootstrap() {
  if (import.meta.env.VITE_ENABLE_MOCKS === 'true') {
    const { enableMocking } = await import('@/mocks')
    await enableMocking()
  }
  const { default: App } = await import('./App.tsx')
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
bootstrap()
