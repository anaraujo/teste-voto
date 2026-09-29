/**
 * Contrato entre o build estático (`scripts/prerender.ts`) e o app: os dados
 * de uma rota pré-renderizada viajam embutidos no HTML, num script
 * `application/json`, e semeiam o estado dos hooks na hidratação.
 *
 * Puro e sem DOM — o leitor do navegador fica em `src/AppRouter.tsx`.
 */

import type { ApiCandidateDetail, ApiCandidatesResponse } from './api.ts'
import type { Route } from './router.ts'

export const PRERENDER_DATA_ID = '__prerender-data'

export type PrerenderData =
  | { kind: 'candidates'; payload: ApiCandidatesResponse }
  | { kind: 'candidate'; payload: ApiCandidateDetail }

export interface RouteMeta {
  /** <title> da página. */
  title: string
  /** <meta name="description"> e og:description. */
  description: string
  /** Caminho canônico, usado em canonical, og:url e sitemap. */
  path: string
  /** og:image — foto do candidato quando houver. */
  image?: string | null
}

/** Entrada do render de uma rota (bundle SSR em `dist-ssr/entry-server.js`). */
export interface RenderRouteInput {
  route: Route
  data?: PrerenderData
}
