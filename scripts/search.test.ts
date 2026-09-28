import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSearchIndex, searchCandidates } from '../src/lib/search.ts'
import type { ApiCandidate } from '../src/shared/api.ts'
import type { Source } from '../src/shared/domain.ts'

const SOURCE: Source = {
  provider: 'TSE',
  url: 'https://cdn.tse.jus.br/consulta_cand.zip',
  dataset: 'consultas_candidatos',
  sourceFile: 'consulta_cand_2026_PR.csv',
  retrievedAt: '2026-09-01T00:00:00.000Z',
  sourceUpdatedAt: null,
}

function candidate(overrides: Partial<ApiCandidate> = {}): ApiCandidate {
  return {
    id: '2026-PR-1',
    tseSequence: '1',
    ballotName: 'ANA PARTICIPANTE',
    fullName: 'ANA PARTICIPANTE TESTE',
    ballotNumber: '1301',
    party: 'Partido dos Trabalhadores',
    partyAcronym: 'PT',
    coalition: null,
    candidacyType: null,
    federation: null,
    occupation: 'AGRICULTOR',
    education: null,
    maritalStatus: null,
    birthDate: '1980-05-10',
    birthState: 'PR',
    gender: null,
    race: null,
    status: 'APTO',
    city: 'CURITIBA',
    photoUrl: null,
    birthMunicipality: null,
    isReelection: null,
    totalAssets: null,
    assetsDeclared: null,
    socialLinks: [],
    quilombola: null,
    indigenousEthnicity: null,
    accountsDeclared: null,
    isIncumbent: false,
    camaraPartyAcronym: null,
    source: SOURCE,
    ...overrides,
  }
}

const ANA = candidate()
const BIA = candidate({
  id: '2026-PR-2',
  tseSequence: '2',
  ballotName: 'BIA SILVA',
  fullName: 'BEATRIZ SILVA',
  ballotNumber: '4512',
  party: 'Partido da Social Democracia Brasileira',
  partyAcronym: 'PSDB',
  occupation: 'PROFESSOR',
  city: 'LONDRINA',
})
const CARLOS = candidate({
  id: '2026-PR-3',
  tseSequence: '3',
  ballotName: 'CARLOS',
  fullName: 'CARLOS ALBERTO SOUZA',
  ballotNumber: '1503',
  party: 'Movimento Democrático Brasileiro',
  partyAcronym: 'MDB',
  occupation: 'ADVOGADO',
  city: 'MARINGA',
})
const JOAO = candidate({
  id: '2026-PR-4',
  tseSequence: '4',
  ballotName: 'JOÃO DA PADARIA',
  fullName: 'JOÃO PEREIRA SANTOS',
  ballotNumber: '9012',
  party: 'Partido dos Trabalhadores',
  partyAcronym: 'PT',
  occupation: 'COMERCIANTE',
  city: 'PONTA GROSSA',
})

const ALL = [ANA, BIA, CARLOS, JOAO]
const INDEX = buildSearchIndex(ALL)

test('busca vazia devolve lista completa em ordem alfabética', () => {
  const result = searchCandidates(INDEX, '')
  assert.deepEqual(
    result.map((candidate) => candidate.ballotName),
    ['ANA PARTICIPANTE', 'BIA SILVA', 'CARLOS', 'JOÃO DA PADARIA'],
  )
})

test('nome exato casa em primeiro', () => {
  const result = searchCandidates(INDEX, 'ANA PARTICIPANTE')
  assert.equal(result[0].id, ANA.id)
})

test('prefixo do nome de urna', () => {
  const result = searchCandidates(INDEX, 'ANA')
  assert.ok(result.length >= 1)
  assert.equal(result[0].id, ANA.id)
})

test('número de urna exato', () => {
  const result = searchCandidates(INDEX, '1301')
  assert.ok(result.length >= 1)
  assert.equal(result[0].id, ANA.id)
})

test('prefixo do número de urna', () => {
  const result = searchCandidates(INDEX, '13')
  assert.ok(result.length === 1)
  assert.equal(result[0].id, ANA.id)
})

test('número de urna com alta relevância', () => {
  const result = searchCandidates(INDEX, '901')
  assert.ok(result.length >= 1)
  assert.equal(result[0].id, JOAO.id)
})

test('nome de urna com erro de digitação (fuzzy)', () => {
  const result = searchCandidates(INDEX, 'ANA PARTICPANTE')
  assert.ok(result.length >= 1)
  assert.equal(result[0].id, ANA.id)
})

test('nome completo com erro de digitação', () => {
  const result = searchCandidates(INDEX, 'BEATRIS SILVA')
  assert.ok(result.length >= 1)
  assert.equal(result[0].id, BIA.id)
})

test('busca por sigla do partido (exata)', () => {
  const result = searchCandidates(INDEX, 'PT')
  const names = result.map((candidate) => candidate.ballotName)
  assert.deepEqual(names, ['ANA PARTICIPANTE', 'JOÃO DA PADARIA'])
})

test('busca por sigla do partido em minúsculas', () => {
  const result = searchCandidates(INDEX, 'pt')
  const names = result.map((candidate) => candidate.ballotName)
  assert.deepEqual(names, ['ANA PARTICIPANTE', 'JOÃO DA PADARIA'])
})

test('busca por nome completo do partido (exato)', () => {
  const result = searchCandidates(INDEX, 'Partido dos Trabalhadores')
  const names = result.map((candidate) => candidate.ballotName)
  assert.deepEqual(names, ['ANA PARTICIPANTE', 'JOÃO DA PADARIA'])
})

test('sigla do partido com acentos normalizados', () => {
  const result = searchCandidates(INDEX, 'PSDB')
  const names = result.map((candidate) => candidate.ballotName)
  assert.deepEqual(names, ['BIA SILVA'])
})

test('nome do partido sem acentos', () => {
  const result = searchCandidates(INDEX, 'partido')
  // PSDB + PT contêm "partido", então ambos aparecem
  const names = result.map((candidate) => candidate.ballotName)
  assert.ok(names.includes('BIA SILVA'))
  assert.ok(names.includes('ANA PARTICIPANTE'))
})

test('nome do partido bem específico filtra um único partido', () => {
  const result = searchCandidates(INDEX, 'Partido da Social Democracia')
  const names = result.map((candidate) => candidate.ballotName)
  assert.deepEqual(names, ['BIA SILVA'])
})

test('nome do partido revisado filtra apenas quando uma agremiação casa', () => {
  // "trabalhadores" casa PT e não outro partido do conjunto
  const result = searchCandidates(INDEX, 'trabalhadores')
  const names = result.map((candidate) => candidate.ballotName)
  assert.deepEqual(names, ['ANA PARTICIPANTE', 'JOÃO DA PADARIA'])
})

test('nome de partido ambíguo entre várias agremiações', () => {
  const psdb = candidate({
    id: '2026-PR-5',
    tseSequence: '5',
    ballotName: 'DIEGO MENDES',
    fullName: 'DIEGO MENDES',
    ballotNumber: '4520',
    party: 'Partido da Social Democracia',
    partyAcronym: 'PSD',
    occupation: null,
    city: null,
  })
  const result = searchCandidates(
    buildSearchIndex([...ALL, psdb]),
    'Partido da Social Democracia',
  )
  // Ambíguo entre PSDB e PSD — não faz filtro de partido, busca como texto
  const names = result.map((candidate) => candidate.ballotName)
  assert.ok(names.length >= 2)
  assert.ok(names.includes('BIA SILVA'))
  assert.ok(names.includes('DIEGO MENDES'))
})

test('busca sem resultados retorna array vazio', () => {
  const result = searchCandidates(INDEX, 'xyznonexistent123')
  assert.deepEqual(result, [])
})

test('busca por cidade', () => {
  const result = searchCandidates(INDEX, 'Londrina')
  const names = result.map((candidate) => candidate.ballotName)
  assert.deepEqual(names, ['BIA SILVA'])
})

test('busca por ocupação', () => {
  const result = searchCandidates(INDEX, 'advogado')
  assert.equal(result[0].id, CARLOS.id)
})

test('busca por nome completo (não nome de urna)', () => {
  const result = searchCandidates(INDEX, 'BEATRIZ')
  assert.equal(result[0].id, BIA.id)
})

test('múltiplos matches ordenados por relevância', () => {
  const result = searchCandidates(INDEX, 'ANA')
  // ANA PARTICIPANTE deve vir antes de JOÃO DA PADARIA (substring match)
  const names = result.map((candidate) => candidate.ballotName)
  assert.ok(names.indexOf('ANA PARTICIPANTE') < names.indexOf('JOÃO DA PADARIA') || !names.includes('JOÃO DA PADARIA'))
})

test('nome de urna tem mais peso que outros campos', () => {
  // CARLOS de MARINGA (advogado) vs BIA de LONDRINA
  // Ambos não são "ANA", mas "ANA" aparece como substring de "MARINGA"
  const result = searchCandidates(INDEX, 'ANA')
  // CARLOS (city contém "ANA") pode aparecer, mas ANA PARTICIPANTE deve vir primeiro
  if (result.length > 0) {
    assert.equal(result[0].id, ANA.id)
  }
})
