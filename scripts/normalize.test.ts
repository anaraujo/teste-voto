import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  candidateChecksum,
  clean,
  isTseSentinel,
  normalizeCandidate,
  parseDate,
  parseMoney,
} from '../src/data-sources/tse/normalize.ts'
import { mapRawRow, type RawCandidateRow } from '../src/data-sources/tse/schema.ts'
import { municipalityOrNull } from '../src/shared/elections.ts'

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
    maritalStatus: 'CASADO(A)',
    birthState: 'PR',
    federation: 'FE BRASIL (13-PT, 14-PTB)',
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

test('isTseSentinel reconhece sentinelas do TSE', () => {
  assert.equal(isTseSentinel('#NE'), true)
  assert.equal(isTseSentinel('#NULO'), true)
  assert.equal(isTseSentinel('NÃO DIVULGÁVEL'), true)
  assert.equal(isTseSentinel('   #NE   '), true)
  assert.equal(isTseSentinel(''), true)
  assert.equal(isTseSentinel('APTO'), false)
})

test('clean converte sentinelas do TSE para null', () => {
  assert.equal(clean('#NE'), null)
  assert.equal(clean('#NULO'), null)
  assert.equal(clean('NÃO DIVULGÁVEL'), null)
  assert.equal(clean('APTO'), 'APTO')
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
  assert.equal(candidate.maritalStatus, 'CASADO(A)')
  assert.equal(candidate.birthState, 'PR')
  assert.equal(candidate.federation, 'FE BRASIL (13-PT, 14-PTB)')
  assert.deepEqual(candidate.socialLinks, [])
})

test('normalizeCandidate converte sentinelas em null', () => {
  const candidate = normalizeCandidate(
    sampleRow({ status: '#NE', email: 'NÃO DIVULGÁVEL', federation: '#NULO' }),
    {
      electionYear: 2026,
      state: 'PR',
      office: 'DEPUTADO FEDERAL',
    },
  )
  assert.equal(candidate.status, null)
  assert.equal(candidate.email, null)
  assert.equal(candidate.federation, null)
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

  const federationChanged = normalizeCandidate(
    sampleRow({ federation: '#NULO' }),
    {
      electionYear: 2026,
      state: 'PR',
      office: 'DEPUTADO FEDERAL',
    },
  )
  assert.notEqual(
    candidateChecksum(base),
    candidateChecksum(federationChanged),
  )
})
/* ------------------------------------------------------------------ *
 * NM_UE: município em 2004-2024, estado em 2026
 *
 * O TSE reutiliza a coluna com significados diferentes. No arquivo de 2026
 * (consulta_cand_2026_PR.csv) SG_UE = "PR" e NM_UE = "PARANÁ": a unidade
 * eleitoral do cargo federal é o próprio estado. Tratar isso como município
 * fazia a ficha afirmar que todos os 428 candidatos vinham de uma cidade de
 * nome "Paraná", que não existe.
 * ------------------------------------------------------------------ */

function rowFromCells(cells: Record<string, string>): RawCandidateRow {
  const headers = Object.keys(cells)
  const index = new Map(headers.map((h, i) => [h.toUpperCase(), i]))
  const values = headers.map((h) => cells[h])
  return mapRawRow(index, values)
}

test('NM_UE igual à UF não vira município', () => {
  // Linha real de consulta_cand_2026_PR.csv.
  const row = rowFromCells({
    SG_UF: 'PR',
    SG_UE: 'PR',
    NM_UE: 'PARANÁ',
    SQ_CANDIDATO: '160002547461',
    NM_CANDIDATO: 'ANA PAULA SOUZA',
  })
  assert.equal(row.city, '')
})

test('NM_UE com código de município continua sendo município', () => {
  // Linha real de consulta_cand_2024_PR.csv: SG_UE é o código do município.
  const row = rowFromCells({
    SG_UF: 'PR',
    SG_UE: '76597',
    NM_UE: 'LARANJEIRAS DO SUL',
    SQ_CANDIDATO: '12000123456',
    NM_CANDIDATO: 'ANA PAULA SOUZA',
  })
  assert.equal(row.city, 'LARANJEIRAS DO SUL')
})

test('município em branco quando SG_UE não está no arquivo', () => {
  const row = rowFromCells({
    SG_UF: 'PR',
    NM_UE: 'CURITIBA',
    SQ_CANDIDATO: '12000123456',
    NM_CANDIDATO: 'ANA PAULA SOUZA',
  })
  assert.equal(row.city, 'CURITIBA')
})

test('city vazio vira null e não string vazia', () => {
  const row = rowFromCells({
    SG_UF: 'PR',
    SG_UE: 'PR',
    NM_UE: 'PARANÁ',
    SQ_CANDIDATO: '160002547461',
    NM_CANDIDATO: 'ANA PAULA SOUZA',
  })
  const candidate = normalizeCandidate(row, {
    electionYear: 2026,
    state: 'PR',
    office: 'DEPUTADO FEDERAL',
  })
  assert.equal(candidate.city, null)
})

/* ------------------------------------------------------------------ *
 * Rótulo "Município" na ficha
 *
 * A guarda de tela existia, mas comparava só com a sigla ("PR") e deixava
 * passar o nome do estado ("PARANÁ"). Vale para os dois.
 * ------------------------------------------------------------------ */

test('guarda de município rejeita sigla e nome do estado', () => {
  assert.equal(municipalityOrNull('PARANÁ', 'PR'), null)
  assert.equal(municipalityOrNull('Paraná', 'PR'), null)
  assert.equal(municipalityOrNull('PR', 'PR'), null)
  assert.equal(municipalityOrNull('  pr  ', 'PR'), null)
  assert.equal(municipalityOrNull('', 'PR'), null)
  assert.equal(municipalityOrNull('   ', 'PR'), null)
  assert.equal(municipalityOrNull(null, 'PR'), null)
  assert.equal(municipalityOrNull(undefined, 'PR'), null)
})

test('guarda de município preserva município de verdade', () => {
  assert.equal(municipalityOrNull('CURITIBA', 'PR'), 'CURITIBA')
  assert.equal(municipalityOrNull('Pato Branco', 'PR'), 'Pato Branco')
  // Não confunde município que contém o nome do estado.
  assert.equal(municipalityOrNull('PARANAVAÍ', 'PR'), 'PARANAVAÍ')
  assert.equal(municipalityOrNull('COLOMBO', 'PR'), 'COLOMBO')
})

test('guarda de município funciona para outra UF', () => {
  assert.equal(municipalityOrNull('SÃO PAULO', 'SP'), null)
  assert.equal(municipalityOrNull('Santos', 'SP'), 'Santos')
})
