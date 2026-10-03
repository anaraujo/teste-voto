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
  assert.deepEqual(matchRoute('/'), { name: 'states' })
  assert.deepEqual(matchRoute('/estados'), { name: 'states' })
  assert.deepEqual(matchRoute('/estados/PR'), {
    name: 'candidates',
    uf: 'PR',
    office: 'federal',
  })
  assert.deepEqual(matchRoute('/estados/sp'), {
    name: 'candidates',
    uf: 'SP',
    office: 'federal',
  })
  assert.deepEqual(matchRoute('/estados/PR/federal'), {
    name: 'candidates',
    uf: 'PR',
    office: 'federal',
  })
  assert.deepEqual(matchRoute('/estados/PR/estadual'), {
    name: 'candidates',
    uf: 'PR',
    office: 'estadual',
  })
  assert.deepEqual(matchRoute('/estados/DF/estadual'), {
    name: 'candidates',
    uf: 'DF',
    office: 'estadual',
  })
  assert.deepEqual(matchRoute('/estados/PR/imparcialidade'), {
    name: 'fairness',
    uf: 'PR',
  })
  assert.deepEqual(matchRoute('/estados/PR/resultado'), {
    name: 'result',
    uf: 'PR',
  })
  assert.deepEqual(matchRoute('/candidato/2026-PR-160002'), {
    name: 'candidate',
    id: '2026-PR-160002',
  })
  assert.deepEqual(matchRoute('/estados/XX'), {
    name: 'not-found',
    path: '/estados/XX',
  })
})

test('matchRoute aceita barra final e número de pergunta', () => {
  assert.deepEqual(matchRoute('/estados/'), { name: 'states' })
  assert.deepEqual(matchRoute('/estados/PR/'), {
    name: 'candidates',
    uf: 'PR',
    office: 'federal',
  })
  assert.deepEqual(matchRoute('/candidato/abc/'), {
    name: 'candidate',
    id: 'abc',
  })
  assert.deepEqual(matchRoute('/estados/PR/quiz'), {
    name: 'question',
    uf: 'PR',
    step: 1,
  })
  assert.deepEqual(matchRoute('/estados/PR/quiz/4'), {
    name: 'question',
    uf: 'PR',
    step: 4,
  })
  assert.deepEqual(matchRoute('/estados/PR/quiz/0'), {
    name: 'not-found',
    path: '/estados/PR/quiz/0',
  })
  assert.deepEqual(matchRoute('/estados/PR/quiz/um'), {
    name: 'not-found',
    path: '/estados/PR/quiz/um',
  })
})

test('caminhos antigos sem UF voltam para a seleção de estado', () => {
  assert.deepEqual(matchRoute('/candidatos'), { name: 'states' })
  assert.deepEqual(matchRoute('/quiz/4'), { name: 'states' })
  assert.deepEqual(matchRoute('/resultado'), { name: 'states' })
  assert.deepEqual(matchRoute('/imparcialidade'), { name: 'states' })
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
  assert.deepEqual(matchRoute('candidatos'), { name: 'states' })
})

test('routeToPath é o inverso de matchRoute', () => {
  const routes: Route[] = [
    { name: 'states' },
    { name: 'candidates', uf: 'PR', office: 'federal' },
    { name: 'candidates', uf: 'PR', office: 'estadual' },
    { name: 'candidate', id: '2026-PR-16 002' },
    { name: 'fairness', uf: 'SP' },
    { name: 'question', uf: 'PR', step: 3 },
    { name: 'result', uf: 'PR' },
  ]
  for (const route of routes) {
    const path = routeToPath(route)
    assert.deepEqual(matchRoute(path), route, `round trip de ${path}`)
  }
  assert.equal(
    routeToPath({ name: 'question', uf: 'PR', step: 0 }),
    '/estados/PR/quiz/1',
  )
  assert.equal(
    routeToPath({ name: 'candidates', uf: 'PR', office: 'federal' }),
    '/estados/PR/federal',
  )
  assert.equal(
    routeToPath({ name: 'candidates', uf: 'PR', office: 'estadual' }),
    '/estados/PR/estadual',
  )
})

test('o caminho antigo /estados volta ao canônico /', () => {
  assert.equal(routeToPath(matchRoute('/estados')), '/')
  assert.equal(routeToPath(matchRoute('/estados/')), '/')
})

test('parentPath dá um destino determinístico e a inicial não mostra voltar', () => {
  assert.equal(
    parentPath({ name: 'candidates', uf: 'PR', office: 'federal' }),
    '/',
  )
  assert.equal(parentPath({ name: 'states' }), '/')
  assert.equal(
    parentPath({ name: 'candidate', id: '2026-PR-1' }),
    '/estados/PR/federal',
  )
  assert.equal(parentPath({ name: 'candidate', id: 'x' }), '/')
  assert.equal(
    parentPath({ name: 'fairness', uf: 'SP' }),
    '/estados/SP/resultado',
  )
  assert.equal(parentPath({ name: 'result', uf: 'PR' }), '/estados/PR/federal')
  assert.equal(
    parentPath({ name: 'question', uf: 'PR', step: 1 }),
    '/estados/PR/federal',
  )
  assert.equal(showsBackButton({ name: 'start' }), false)
  assert.equal(showsBackButton({ name: 'states' }), false)
  assert.equal(showsBackButton({ name: 'result', uf: 'PR' }), true)
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
