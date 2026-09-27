import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { CandidateRecord } from '../src/shared/domain.ts'
import { matchIncumbents, normalizeName } from '../src/data-sources/camara/identity.ts'
import type { CamaraDeputy } from '../src/data-sources/camara/deputados.ts'

function candidate(id: string, fullName: string, ballotName: string): CandidateRecord {
  const source = {
    provider: 'TSE',
    url: 'https://exemplo.com',
    dataset: 'consultas_candidatos',
    sourceFile: 'consulta_cand_2026_PR.csv',
    retrievedAt: '2026-09-01T00:00:00.000Z',
    sourceUpdatedAt: null,
  }
  return {
    id,
    tseSequence: id,
    electionYear: 2026,
    state: 'PR',
    office: 'DEPUTADO FEDERAL',
    ballotName,
    fullName,
    ballotNumber: '101',
    party: null,
    partyAcronym: 'PTE',
    coalition: null,
    status: 'APTO',
    campaignStatus: null,
    candidacyType: null,
    occupation: null,
    education: null,
    birthDate: null,
    gender: null,
    race: null,
    nationality: null,
    city: null,
    email: null,
    website: null,
    socialLinks: [],
    photoUrl: null,
    totalAssets: null,
    maritalStatus: null,
    birthState: null,
    federation: null,
    birthMunicipality: null,
    quilombola: null,
    indigenousEthnicity: null,
    inBallot: null,
    substituted: null,
    accountsDeclared: null,
    assetsDeclared: null,
    isReelection: null,
    campaignSpendingCap: null,
    source,
    importedAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  }
}

function deputy(id: number, nome: string, siglaPartido: string): CamaraDeputy {
  return { id, nome, siglaPartido, siglaUf: 'PR', urlFoto: null, email: null, dataNascimento: null }
}

test('normalizeName remove acentos e pontuação', () => {
  assert.equal(normalizeName('LUIZ CARLOS HAULY'), 'luiz carlos hauly')
  assert.equal(normalizeName('Aécio-Neves, Jr.'), 'aecio neves jr')
})

test('matchIncumbents casa por nome completo', () => {
  const candidates = [candidate('1', 'LUIZ CARLOS HAULY', 'LUIZ HAULY')]
  const result = matchIncumbents(candidates, [deputy(1, 'LUIZ CARLOS HAULY', 'PP')])

  assert.equal(result.matchedCount, 1)
  assert.equal(result.matches[0].candidateId, '1')
  assert.equal(result.matches[0].camaraId, 1)
  assert.equal(result.matches[0].camaraPartyAcronym, 'PP')
  assert.deepEqual(result.unmatchedDeputies, [])
})

test('matchIncumbents casa pelo nome de urna mesmo sem nome civil', () => {
  const candidates = [candidate('2', 'JORGE CANCIAN PRETO', 'BETO PRETO')]
  const result = matchIncumbents(candidates, [deputy(2, 'BETO PRETO', 'PSD')])

  assert.equal(result.matchedCount, 1)
  assert.equal(result.matches[0].candidateId, '2')
})

test('matchIncumbents recusa nome de urna curto sem data de nascimento', () => {
  const candidates = [candidate('3', 'ANA PAULA SILVA', 'ANA')]
  const result = matchIncumbents(candidates, [{ ...deputy(3, 'ANA', 'PT'), dataNascimento: null }])

  assert.equal(result.matchedCount, 0)
  assert.equal(result.unmatchedDeputies.length, 1)
})

test('matchIncumbents aceita nome de urna curto com data de nascimento', () => {
  const candidates = [{ ...candidate('3', 'ANA PAULA SILVA', 'ANA'), birthDate: '1975-08-12' }]
  const result = matchIncumbents(candidates, [
    { ...deputy(3, 'ANA', 'PT'), dataNascimento: '1975-08-12' },
  ])

  assert.equal(result.matchedCount, 1)
  assert.equal(result.matches[0].candidateId, '3')
})

test('matchIncumbents desempata nomes iguais pela data de nascimento', () => {
  const candidates = [
    { ...candidate('10', 'JOSÉ ANTÔNIO CLAUDINO', 'BRAZÃO'), birthDate: '1970-01-01' },
    { ...candidate('11', 'JOSÉ ANTÔNIO CLAUDINO', 'BRAZÃO'), birthDate: '1975-05-05' },
  ]
  const result = matchIncumbents(candidates, [
    { ...deputy(4, 'BRAZÃO', 'PL'), dataNascimento: '1975-05-05' },
  ])

  assert.equal(result.matchedCount, 1)
  assert.equal(result.matches[0].candidateId, '11')
})

test('matchIncumbents não casa duas vezes o mesmo candidato', () => {
  const candidates = [candidate('4', 'PEDRO HENRIQUE LIMA', 'PEDRO LIMA')]
  const result = matchIncumbents(candidates, [
    deputy(4, 'PEDRO HENRIQUE LIMA', 'PL'),
    deputy(5, 'PEDRO LIMA', 'PSDB'),
  ])

  assert.equal(result.matchedCount, 1)
  assert.equal(result.unmatchedDeputies.length, 1)
})

test('matchIncumbents mantém deputados sem candidato correspondente', () => {
  const candidates = [candidate('6', 'MARIA FERNANDA SOUZA', 'MARIA SOUZA')]
  const result = matchIncumbents(candidates, [
    deputy(6, 'MARIA FERNANDA SOUZA', 'MDB'),
    deputy(7, 'JOSÉ AUGUSTO TEIXEIRA', 'UNIÃO'),
  ])

  assert.equal(result.matchedCount, 1)
  assert.equal(result.unmatchedDeputies.length, 1)
  assert.equal(result.unmatchedDeputies[0].nome, 'JOSÉ AUGUSTO TEIXEIRA')
})