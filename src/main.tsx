import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { AppRouter } from './AppRouter.tsx'
import './index.css'

const container = document.getElementById('root')!

if (container.hasChildNodes()) {
  hydrateRoot(
    container,
    <StrictMode>
      <AppRouter />
    </StrictMode>,
  )
} else {
  createRoot(container).render(
    <StrictMode>
      <AppRouter />
    </StrictMode>,
  )
}
