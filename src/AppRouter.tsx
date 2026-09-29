import { useCallback, useState, useSyncExternalStore } from 'react'
import App from './App.tsx'
import type { NavigateOptions } from './App.tsx'
import { PRERENDER_DATA_ID, type PrerenderData } from './shared/prerender.ts'
import { matchRoute, routeToPath, type Route } from './shared/router.ts'

/**
 * Cliente do roteamento: a rota vive na URL e o botão voltar do navegador
 * funciona de verdade. Só o navegador usa este módulo — o build estático
 * renderiza `App` com a rota de cada página.
 */

const listeners = new Set<() => void>()

let cachedPath: string | null = null
let cachedRoute: Route = { name: 'start' }

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  window.addEventListener('popstate', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('popstate', listener)
  }
}

function getSnapshot(): Route {
  const path = window.location.pathname
  if (path !== cachedPath) {
    cachedPath = path
    cachedRoute = matchRoute(path)
  }
  return cachedRoute
}

function notify(): void {
  for (const listener of [...listeners]) listener()
}

/** Navega para um caminho (ou rota) canônico, notificando os subscribers. */
function navigate(to: string, options?: NavigateOptions): void {
  const path = routeToPath(matchRoute(to))
  if (path === window.location.pathname) return
  if (options?.replace) {
    window.history.replaceState(null, '', path)
  } else {
    window.history.pushState(null, '', path)
  }
  notify()
}

/** Lê os dados embutidos no HTML pré-renderizado, se existirem. */
function readPrerenderData(): PrerenderData | undefined {
  const raw = document.getElementById(PRERENDER_DATA_ID)?.textContent
  if (!raw) return undefined
  try {
    return JSON.parse(raw) as PrerenderData
  } catch {
    return undefined
  }
}

export function AppRouter() {
  const route = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const onNavigate = useCallback(
    (to: string, options?: NavigateOptions) => navigate(to, options),
    [],
  )
  const [data] = useState(readPrerenderData)

  return <App route={route} onNavigate={onNavigate} data={data} />
}
