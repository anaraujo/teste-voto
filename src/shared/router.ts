/**
 * Rotas do app: um caminho de URL ↔ uma tela.
 *
 * Módulo puro, sem DOM e sem React: o mesmo matcher serve o cliente
 * (`src/AppRouter.tsx`), o build estático (`scripts/prerender.ts`) e os testes.
 */

export type Route =
  | { name: 'start' }
  | { name: 'candidates' }
  | { name: 'states' }
  | { name: 'candidate'; id: string }
  | { name: 'fairness' }
  | { name: 'question'; step: number }
  | { name: 'result' }
  | { name: 'not-found'; path: string }

export const START_PATH = '/'
export const STATES_PATH = '/'
export const CANDIDATES_PATH = '/candidatos'
export const CANDIDATE_PATH = '/candidato'
export const FAIRNESS_PATH = '/imparcialidade'
export const QUIZ_PATH = '/quiz'
export const RESULT_PATH = '/resultado'

/** Caminho antigo da seleção de estado, antes de ela virar a rota principal. */
export const LEGACY_STATES_PATH = '/estados'

/** Remove a barra final, para que `/candidatos/` case com `/candidatos`. */
function normalize(pathname: string): string {
  if (!pathname.startsWith('/')) return START_PATH
  const trimmed = pathname.replace(/\/+$/, '')
  return trimmed === '' ? START_PATH : trimmed
}

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return ''
  }
}

/** Converte um caminho de URL em rota. Caminhos desconhecidos viram 'not-found'. */
export function matchRoute(pathname: string): Route {
  const path = normalize(pathname)

  if (path === STATES_PATH || path === LEGACY_STATES_PATH) {
    return { name: 'states' }
  }
  if (path === CANDIDATES_PATH) return { name: 'candidates' }
  if (path === FAIRNESS_PATH) return { name: 'fairness' }
  if (path === RESULT_PATH) return { name: 'result' }
  if (path === QUIZ_PATH) return { name: 'question', step: 1 }

  if (path.startsWith(`${CANDIDATE_PATH}/`)) {
    const id = decodeSegment(path.slice(CANDIDATE_PATH.length + 1))
    return id ? { name: 'candidate', id } : { name: 'not-found', path }
  }

  if (path.startsWith(`${QUIZ_PATH}/`)) {
    const step = path.slice(QUIZ_PATH.length + 1)
    return /^[1-9]\d*$/.test(step)
      ? { name: 'question', step: Number(step) }
      : { name: 'not-found', path }
  }

  return { name: 'not-found', path }
}

/** Converte uma rota no caminho canônico (o inverso de `matchRoute`). */
export function routeToPath(route: Route): string {
  switch (route.name) {
    case 'start':
      return START_PATH
    case 'states':
      return STATES_PATH
    case 'candidates':
      return CANDIDATES_PATH
    case 'candidate':
      return `${CANDIDATE_PATH}/${encodeURIComponent(route.id)}`
    case 'fairness':
      return FAIRNESS_PATH
    case 'question':
      return `${QUIZ_PATH}/${route.step < 1 ? 1 : route.step}`
    case 'result':
      return RESULT_PATH
    case 'not-found':
      return route.path
  }
}

/** Caminho da ficha de um candidato (para links e para `navigate`). */
export function candidatePath(id: string, tab?: string): string {
  const path = routeToPath({ name: 'candidate', id })
  return tab && tab !== DEFAULT_TAB
    ? `${path}?tab=${encodeURIComponent(tab)}`
    : path
}

/*
 * Abas da ficha.
 *
 * A aba viva vai na *query string*, não no caminho: `matchRoute` continua
 * casando só o pathname, então `/candidato/2026-PR-160002?tab=votacoes` e
 * `/candidato/2026-PR-160002` continuam sendo a mesma rota, e o build
 * estático — que emite o caminho sem query — não muda em nada.
 */

export const TABS = [
  'resumo',
  'mandato',
  'historico',
  'votacoes',
  'posicoes',
  'fontes',
] as const

export type Tab = (typeof TABS)[number]

export const DEFAULT_TAB: Tab = 'resumo'

export function isTab(value: string): value is Tab {
  return (TABS as readonly string[]).includes(value)
}

/**
 * Lê a aba de uma query string, caindo na padrão quando não vier nenhuma ou
 * vier algo fora da lista — uma URL adulterada volta ao Resumo em vez de
 * quebrar a página.
 */
export function parseTab(search: string): Tab {
  const raw = new URLSearchParams(search).get('tab')
  return raw !== null && isTab(raw) ? raw : DEFAULT_TAB
}

/**
 * Tela "de onde se veio" de forma determinística — sem guardar histórico na
 * máquina de estados. A seleção de estado é a rota principal (`/`), então é o
 * destino de volta de quem está nos candidatos.
 */
export function parentPath(route: Route): string {
  switch (route.name) {
    case 'candidates':
      return STATES_PATH
    case 'states':
      return STATES_PATH
    case 'candidate':
      return CANDIDATES_PATH
    case 'fairness':
      return RESULT_PATH
    default:
      return START_PATH
  }
}

/** Telas que mostram o botão de voltar no cabeçalho. */
export function showsBackButton(route: Route): boolean {
  return route.name !== 'start' && route.name !== 'states'
}
