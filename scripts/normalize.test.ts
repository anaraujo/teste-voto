import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  candidateChecksum,
  clean,
  normalizeCandidate,
  parseDate,
  parseMoney,
} from '../src/data-sources/tse/normalize.ts'
import type { RawCandidateRow } from '../src/data-sources/tse/schema.ts'

function sampleRow(overrides: Partial<RawCandidateRow> = {}): RawCandidateRow {
  return {
    sequence: '12345',
    ballotNumber: '700',
    fullName: 'MARIA DA SILVA',
    ballotName: 'MARIA SILVA',
    partyAcronym: 'PSD',
    party: 'Partido Social Democrático',
    coalition: 'UNIÃO E FORÇA',
    status: 'APTO',
    campaignStatus: '',
    candidacyType: 'COLIGAÇÃO',
    occupation: 'ADVOGADO',
    education: 'SUPERIOR COMPLETO',
    birthDate: '12/03/1985',
    gender: 'FEMININO',
    race: 'BRANCA',
    nationality: 'BRASILEIRA NATA',
    city: 'CURITIBA',
    email: 'maria@exemplo.com',
    ...overrides,
  }
}

test('parseDate converte DD/MM/AAAA para ISO', () => {
  assert.equal(parseDate('12/03/1985'), '1985-03-12')
  assert.equal(parseDate('01/11/2000'), '2000-11-01')
  assert.equal(parseDate(''), null)
  assert.equal(parseDate('45/13/2000'), null)
})

test('parseMoney normaliza vírgula e milhar', () => {
  assert.equal(parseMoney('1250,5'), 1250.5)
  assert.equal(parseMoney('1.250,50'), 1250.5)
  assert.equal(parseMoney(''), null)
  assert.equal(parseMoney('abc'), null)
})

test('clean normaliza vazio para null', () => {
  assert.equal(clean('  texto  '), 'texto')
  assert.equal(clean(''), null)
  assert.equal(clean('   '), null)
})

test('normalizeCandidate mapeia os campos', () => {
  const candidate = normalizeCandidate(sampleRow(), {
    electionYear: 2026,
    state: 'PR',
    office: 'DEPUTADO FEDERAL',
  })

  assert.equal(candidate.tseSequence, '12345')
  assert.equal(candidate.ballotName, 'MARIA SILVA')
  assert.equal(candidate.birthDate, '1985-03-12')
  assert.equal(candidate.ballotNumber, '700')
  assert.equal(candidate.partyAcronym, 'PSD')
  assert.equal(candidate.party, 'Partido Social Democrático')
  assert.equal(candidate.coalition, 'UNIÃO E FORÇA')
  assert.equal(candidate.status, 'APTO')
  assert.equal(candidate.campaignStatus, null)
  assert.equal(candidate.occupation, 'ADVOGADO')
  assert.equal(candidate.education, 'SUPERIOR COMPLETO')
  assert.equal(candidate.gender, 'FEMININO')
  assert.equal(candidate.race, 'BRANCA')
  assert.equal(candidate.city, 'CURITIBA')
  assert.equal(candidate.email, 'maria@exemplo.com')
  assert.equal(candidate.photoUrl, null)
  assert.equal(candidate.totalAssets, null)
  assert.deepEqual(candidate.socialLinks, [])
})

test('normalizeCandidate sem nomes usa fallback', () => {
  const candidate = normalizeCandidate(sampleRow({ ballotName: '', fullName: '' }), {
    electionYear: 2026,
    state: 'PR',
    office: 'DEPUTADO FEDERAL',
  })
  assert.equal(candidate.ballotName, 'Sem nome de urna')
  assert.equal(candidate.fullName, 'Sem nome completo')
})

test('candidateChecksum muda quando o conteúdo muda', () => {
  const base = normalizeCandidate(sampleRow(), {
    electionYear: 2026,
    state: 'PR',
    office: 'DEPUTADO FEDERAL',
  })
  const changed = normalizeCandidate(sampleRow({ city: 'LONDRINA' }), {
    electionYear: 2026,
    state: 'PR',
    office: 'DEPUTADO FEDERAL',
  })
  assert.notEqual(candidateChecksum(base), candidateChecksum(changed))
  assert.equal(candidateChecksum(base), candidateChecksum(base))
})