import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import './styles/global.css'
import './i18n'
import Providers from './app/providers'
import { router } from './app/router'

// VITE_API_MODE=mock: chay voi du lieu gia (MSW), khong can backend.
async function enableMocking() {
  if (import.meta.env.VITE_API_MODE !== 'mock') return
  const { worker } = await import('./mocks/browser')
  await worker.start({ onUnhandledRequest: 'bypass' })
}

enableMocking().then(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <Providers>
        <RouterProvider router={router} />
      </Providers>
    </StrictMode>,
  )
})
