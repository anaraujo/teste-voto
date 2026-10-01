import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  candidatePath,
  DEFAULT_TAB,
  isTab,
  matchRoute,
  parentPath,
  parseTab,
  routeToPath,
  showsBackButton,
  TABS,
  type Route,
} from '../src/shared/router.ts'

test('matchRoute reconhece as rotas do app', () => {
  assert.deepEqual(matchRoute('/'), { name: 'start' })
  assert.deepEqual(matchRoute('/candidatos'), { name: 'candidates' })
  assert.deepEqual(matchRoute('/estados'), { name: 'states' })
  assert.deepEqual(matchRoute('/imparcialidade'), { name: 'fairness' })
  assert.deepEqual(matchRoute('/resultado'), { name: 'result' })
  assert.deepEqual(matchRoute('/candidato/2026-PR-160002'), {
    name: 'candidate',
    id: '2026-PR-160002',
  })
})

test('matchRoute aceita barra final e número de pergunta', () => {
  assert.deepEqual(matchRoute('/candidatos/'), { name: 'candidates' })
  assert.deepEqual(matchRoute('/estados/'), { name: 'states' })
  assert.deepEqual(matchRoute('/candidato/abc/'), {
    name: 'candidate',
    id: 'abc',
  })
  assert.deepEqual(matchRoute('/quiz'), { name: 'question', step: 1 })
  assert.deepEqual(matchRoute('/quiz/4'), { name: 'question', step: 4 })
  assert.deepEqual(matchRoute('/quiz/0'), {
    name: 'not-found',
    path: '/quiz/0',
  })
  assert.deepEqual(matchRoute('/quiz/um'), {
    name: 'not-found',
    path: '/quiz/um',
  })
})

test('matchRoute decodifica o id e marca o que não existe', () => {
  assert.deepEqual(matchRoute('/candidato/2026-PR-16%20002'), {
    name: 'candidate',
    id: '2026-PR-16 002',
  })
  assert.deepEqual(matchRoute('/candidato/'), {
    name: 'not-found',
    path: '/candidato',
  })
  assert.deepEqual(matchRoute('/candidata'), {
    name: 'not-found',
    path: '/candidata',
  })
  assert.deepEqual(matchRoute('candidatos'), { name: 'start' })
})

test('routeToPath é o inverso de matchRoute', () => {
  const routes: Route[] = [
    { name: 'start' },
    { name: 'candidates' },
    { name: 'states' },
    { name: 'candidate', id: '2026-PR-16 002' },
    { name: 'fairness' },
    { name: 'question', step: 3 },
    { name: 'result' },
  ]
  for (const route of routes) {
    const path = routeToPath(route)
    assert.deepEqual(matchRoute(path), route, `round trip de ${path}`)
  }
  assert.equal(routeToPath({ name: 'question', step: 0 }), '/quiz/1')
})

test('parentPath dá um destino determinístico e a inicial não mostra voltar', () => {
  assert.equal(parentPath({ name: 'candidates' }), '/')
  assert.equal(parentPath({ name: 'states' }), '/')
  assert.equal(parentPath({ name: 'candidate', id: 'x' }), '/candidatos')
  assert.equal(parentPath({ name: 'fairness' }), '/resultado')
  assert.equal(parentPath({ name: 'result' }), '/')
  assert.equal(parentPath({ name: 'question', step: 1 }), '/')
  assert.equal(showsBackButton({ name: 'start' }), false)
  assert.equal(showsBackButton({ name: 'states' }), true)
  assert.equal(showsBackButton({ name: 'result' }), true)
})

test('a aba da ficha vive na query, e a rota continua só no pathname', () => {
  // A mesma ficha com e sem `?tab=` é a mesma rota: `matchRoute` não olha a
  // query, e é por isso que o build estático das 436 páginas não muda.
  assert.deepEqual(matchRoute('/candidato/2026-PR-160002'), {
    name: 'candidate',
    id: '2026-PR-160002',
  })

  assert.equal(parseTab(''), DEFAULT_TAB)
  assert.equal(parseTab('?tab=votacoes'), 'votacoes')
  assert.equal(parseTab('?tab=resumo'), 'resumo')
  assert.equal(parseTab('?tab=mandato&outro=1'), 'mandato')
})

test('uma aba fora da lista cai na padrão, em vez de quebrar a página', () => {
  assert.equal(parseTab('?tab=inventada'), DEFAULT_TAB)
  assert.equal(parseTab('?tab='), DEFAULT_TAB)
  assert.equal(isTab('fontes'), true)
  assert.equal(isTab('INVENTADA'), false)
  assert.equal(TABS.length, 6)
})

test('candidatePath só acrescenta a query quando a aba não é a padrão', () => {
  assert.equal(candidatePath('2026-PR-160002'), '/candidato/2026-PR-160002')
  assert.equal(
    candidatePath('2026-PR-160002', 'resumo'),
    '/candidato/2026-PR-160002',
  )
  assert.equal(
    candidatePath('2026-PR-160002', 'posicoes'),
    '/candidato/2026-PR-160002?tab=posicoes',
  )
  // Ida e volta: o caminho com query volta para a mesma aba.
  assert.equal(
    parseTab(new URL(candidatePath('x', 'fontes'), 'http://localhost').search),
    'fontes',
  )
})
