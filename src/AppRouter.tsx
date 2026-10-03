import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import App from './App.tsx'
import type { NavigateOptions } from './App.tsx'
import { PRERENDER_DATA_ID, type PrerenderData } from './shared/prerender.ts'
import { DEFAULT_TAB, parseTab, type Tab } from './shared/router.ts'
import { matchRoute, routeToPath, type Route } from './shared/router.ts'

/**
 * Cliente do roteamento: a rota vive na URL e o botão voltar do navegador
 * funciona de verdade. Só o navegador usa este módulo — o build estático
 * renderiza `App` com a rota de cada página.
 */

const listeners = new Set<() => void>()

/** Rota e aba vivas. A URL é a única fonte das duas. */
interface Snapshot {
  route: Route
  tab: Tab
}

let cachedKey: string | null = null
let cached: Snapshot = { route: { name: 'start' }, tab: DEFAULT_TAB }

let cachedHydrationPath: string | null = null
let cachedHydration: Snapshot = { route: { name: 'start' }, tab: DEFAULT_TAB }

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  window.addEventListener('popstate', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('popstate', listener)
  }
}

function getSnapshot(): Snapshot {
  const { pathname, search } = window.location
  const key = `${pathname}?${search}`
  if (key !== cachedKey) {
    cachedKey = key
    cached = { route: matchRoute(pathname), tab: parseTab(search) }
  }
  return cached
}

/**
 * Snapshot usado durante a hidratação, e só nela.
 *
 * As 436 páginas do build estático são emitidas sem `?tab=` e portanto trazem
 * o Resumo. Aqui a aba volta à padrão para casar com aquele HTML; logo depois
 * da hidratação o React passa a usar `getSnapshot`, e a aba da URL entra sem
 * nunca ter havido descasamento.
 */
function getHydrationSnapshot(): Snapshot {
  const path = window.location.pathname
  if (path !== cachedHydrationPath) {
    cachedHydrationPath = path
    cachedHydration = { route: matchRoute(path), tab: DEFAULT_TAB }
  }
  return cachedHydration
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
  // Trocar de rota troca o conteúdo inteiro, então a rolagem volta ao topo:
  // sem isto a tela nova começa na posição da anterior (a seleção de estados,
  // que é longa, deixava a lista de candidatos aberta no meio).
  window.scrollTo({ top: 0, behavior: 'auto' })
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
  const { route, tab } = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getHydrationSnapshot,
  )
  const onNavigate = useCallback(
    (to: string, options?: NavigateOptions) => navigate(to, options),
    [],
  )
  const [data] = useState(readPrerenderData)

  useEffect(() => {
    if (route.name === 'not-found') return
    const canonical = routeToPath(route)
    const current = window.location.pathname.replace(/\/+$/, '') || '/'
    if (current === canonical) return
    const search = window.location.search
    window.history.replaceState(null, '', `${canonical}${search}`)
    notify()
  }, [route])

  /**
   * Trocar de aba não vira entrada de histórico: `replaceState` mantém o botão
   * voltar do navegador como "sair da ficha", em vez de fazer ele desandar aba
   * por aba. Como `replaceState` não dispara `popstate`, o `notify` é o que
   * faz o store reler a URL.
   */
  const onTabChange = useCallback((next: Tab) => {
    const url = new URL(window.location.href)
    if (next === DEFAULT_TAB) url.searchParams.delete('tab')
    else url.searchParams.set('tab', next)
    window.history.replaceState(null, '', url)
    notify()
  }, [])

  return (
    <App
      route={route}
      onNavigate={onNavigate}
      onTabChange={onTabChange}
      tab={tab}
      data={data}
    />
  )
}
