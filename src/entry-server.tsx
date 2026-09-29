/**
 * Entrada de build estático: renderiza uma rota em HTML com `react-dom/server`.
 *
 * O cliente (`src/main.tsx`) hidrata exatamente a mesma árvore, sem importar
 * `./index.css` aqui — o CSS entra pela tag `<link>` do shell construído pelo
 * Vite (ver `scripts/prerender.ts`).
 */

import { renderToString } from 'react-dom/server'
import App from './App.tsx'
import type { RenderRouteInput } from './shared/prerender.ts'

const noop = () => {}

export function renderRoute({ route, data }: RenderRouteInput): string {
  return renderToString(<App route={route} onNavigate={noop} data={data} />)
}
