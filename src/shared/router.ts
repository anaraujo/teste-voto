/**
 * Rotas do app: um caminho de URL ↔ uma tela.
 *
 * Módulo puro, sem DOM e sem React: o mesmo matcher serve o cliente
 * (`src/AppRouter.tsx`), o build estático (`scripts/prerender.ts`) e os testes.
 */

import { isFederationUnit } from '../data/brazil-map.ts'
import { isOfficeKind, type OfficeKind } from './elections.ts'

export type Route =
  | { name: 'start' }
  | { name: 'candidates'; uf: string; office: OfficeKind }
  | { name: 'states' }
  | { name: 'candidate'; id: string }
  | { name: 'fairness'; uf: string }
  | { name: 'question'; uf: string; step: number }
  | { name: 'result'; uf: string }
  | { name: 'not-found'; path: string }

export const START_PATH = '/'
/** A seleção de estado é a rota principal. */
export const STATES_PATH = '/'
/** Prefixo da lista, do quiz, do resultado e da imparcialidade de uma UF. */
export const STATE_FLOW_PATH = '/estados'
export const CANDIDATE_PATH = '/candidato'
export const QUIZ_SEGMENT = 'quiz'
export const RESULT_SEGMENT = 'resultado'
export const FAIRNESS_SEGMENT = 'imparcialidade'

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
  if (isLegacyPath(path)) return { name: 'states' }

  if (path.startsWith(`${CANDIDATE_PATH}/`)) {
    const id = decodeSegment(path.slice(CANDIDATE_PATH.length + 1))
    return id ? { name: 'candidate', id } : { name: 'not-found', path }
  }

  if (path.startsWith(`${STATE_FLOW_PATH}/`)) {
    return matchStatePath(path)
  }

  return { name: 'not-found', path }
}

/** `/candidatos` e `/quiz/n` antigos: o cliente troca a URL pela seleção de estado (`/`). */
function isLegacyPath(path: string): boolean {
  return (
    path === '/candidatos' ||
    path === '/resultado' ||
    path === '/imparcialidade' ||
    path === '/quiz' ||
    /^\/quiz\/[1-9]\d*$/.test(path)
  )
}

function matchStatePath(path: string): Route {
  const rest = path.slice(STATE_FLOW_PATH.length + 1)
  const [rawUf, ...tail] = rest.split('/')
  const uf = decodeSegment(rawUf ?? '').toUpperCase()
  if (!isFederationUnit(uf)) return { name: 'not-found', path }

  // `/estados/:uf` (sem cargo) vira o federal; o efeito canônico do cliente
  // reescreve a URL para `/estados/:uf/federal`.
  if (tail.length === 0) return { name: 'candidates', uf, office: 'federal' }

  const [head, ...inner] = tail

  if (isOfficeKind(head)) {
    if (inner.length === 0) return { name: 'candidates', uf, office: head }
    // Quiz/resultado/imparcialidade ainda são só do federal.
    return { name: 'not-found', path }
  }

  if (tail.length === 1 && head === RESULT_SEGMENT)
    return { name: 'result', uf }
  if (tail.length === 1 && head === FAIRNESS_SEGMENT) {
    return { name: 'fairness', uf }
  }
  if (head === QUIZ_SEGMENT && tail.length === 1) {
    return { name: 'question', uf, step: 1 }
  }
  if (
    head === QUIZ_SEGMENT &&
    tail.length === 2 &&
    /^[1-9]\d*$/.test(tail[1])
  ) {
    return { name: 'question', uf, step: Number(tail[1]) }
  }
  return { name: 'not-found', path }
}

/** Caminho da lista de candidatos de uma UF, no cargo pedido (padrão: federal). */
export function statePath(uf: string, office: OfficeKind = 'federal'): string {
  return `${STATE_FLOW_PATH}/${uf}/${office}`
}

export function quizPath(uf: string, step: number): string {
  return `${STATE_FLOW_PATH}/${uf}/${QUIZ_SEGMENT}/${step < 1 ? 1 : step}`
}

export function resultPath(uf: string): string {
  return `${STATE_FLOW_PATH}/${uf}/${RESULT_SEGMENT}`
}

export function fairnessPath(uf: string): string {
  return `${STATE_FLOW_PATH}/${uf}/${FAIRNESS_SEGMENT}`
}

/** Converte uma rota no caminho canônico (o inverso de `matchRoute`). */
export function routeToPath(route: Route): string {
  switch (route.name) {
    case 'start':
      return START_PATH
    case 'states':
      return STATES_PATH
    case 'candidates':
      return statePath(route.uf, route.office)
    case 'candidate':
      return `${CANDIDATE_PATH}/${encodeURIComponent(route.id)}`
    case 'fairness':
      return fairnessPath(route.uf)
    case 'question':
      return quizPath(route.uf, route.step)
    case 'result':
      return resultPath(route.uf)
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

export function ufFromCandidateId(id: string): string | null {
  const uf = id.split('-')[1]?.toUpperCase()
  return uf && isFederationUnit(uf) ? uf : null
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
    case 'candidate': {
      const uf = ufFromCandidateId(route.id)
      return uf ? statePath(uf) : STATES_PATH
    }
    case 'fairness':
      return resultPath(route.uf)
    case 'question':
    case 'result':
      return statePath(route.uf)
    default:
      return START_PATH
  }
}

/** Telas que mostram o botão de voltar no cabeçalho. */
export function showsBackButton(route: Route): boolean {
  return route.name !== 'start' && route.name !== 'states'
}
