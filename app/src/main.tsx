import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './lib/patch-heroui-overlays'
import './index.css'
import './lib/i18n'
import App from './App.tsx'

// After a deploy, old hashed chunks no longer exist and the server answers with
// index.html. Reload once to pick up the new build; the guard prevents a loop.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  const key = 'chunk-reload-at'
  try {
    const last = Number(sessionStorage.getItem(key) ?? 0)
    if (Date.now() - last < 10_000) return
    sessionStorage.setItem(key, String(Date.now()))
  } catch {
    // storage unavailable: fall through and reload anyway
  }
  window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
