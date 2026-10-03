import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { CandidateRecord } from '../src/shared/domain.ts'
import {
  classifyMandateResult,
  formatCargoLabel,
  formatMandateSummary,
  matchHistoricToCandidates,
  normalizeResultado,
  sortMandates,
  toIsoDate,
  type HistoricCandidacyRow,
  type PoliticalMandate,
} from '../src/data-sources/tse/history.ts'
import { emptyFichaParaCsv } from '../src/data-sources/parliament/export.ts'

function makeCandidate(
  overrides: Partial<CandidateRecord> = {},
): CandidateRecord {
  const base: CandidateRecord = {
    id: '2026-PR-1',
    tseSequence: '1',
    electionYear: 2026,
    state: 'PR',
    office: 'DEPUTADO FEDERAL',
    ballotName: 'ANA PARTICIPANTE',
    fullName: 'ANA PARTICIPANTE TESTE',
    ballotNumber: '101',
    party: 'Partido Teste',
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
    city: 'CURITIBA',
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
    source: {
      provider: 'TSE',
      url: 'https://exemplo.com/cand.zip',
      dataset: 'consultas_candidatos',
      sourceFile: 'consulta_cand_2026_PR.csv',
      retrievedAt: '2026-09-01T00:00:00.000Z',
      sourceUpdatedAt: null,
    },
    importedAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  }
  return { ...base, ...overrides }
}

function fazerLinha(
  overrides: Partial<HistoricCandidacyRow> = {},
): HistoricCandidacyRow {
  return {
    ano: 2020,
    nome: 'Ana Participante Teste',
    dataNascimento: '1980-02-02',
    cargo: 'VEREADOR',
    uf: 'PR',
    municipio: 'Curitiba',
    partidoSigla: 'PTE',
    partidoNome: null,
    numero: '101',
    resultado: 'ELEITO POR MÉDIA',
    turno: 0,
    sqCandidato: '100',
    ...overrides,
  }
}

test('normalizeResultado remove acentos e normaliza para maiúsculas', () => {
  assert.equal(normalizeResultado('Eleito por média'), 'ELEITO POR MEDIA')
  assert.equal(normalizeResultado('NÃO ELEITO'), 'NAO ELEITO')
})

test('toIsoDate converte datas do TSE para AAAA-MM-DD', () => {
  assert.equal(toIsoDate('02/10/1986'), '1986-10-02')
  assert.equal(toIsoDate('1986-10-02'), '1986-10-02')
  assert.equal(toIsoDate(''), null)
  assert.equal(toIsoDate('#NULO'), null)
  assert.equal(toIsoDate(null), null)
})

test('matchHistoricToCandidates casa mesmo com data em DD/MM/AAAA', () => {
  const candidate = makeCandidate({ birthDate: '1986-10-02' })
  const mandates = matchHistoricToCandidates(
    [
      fazerLinha({
        nome: 'ANA PARTICIPANTE TESTE',
        dataNascimento: '02/10/1986',
      }),
    ],
    [candidate],
  )
  assert.equal(mandates.length, 1)
})

test('classifyMandateResult separa eleito, suplente e não-mandato', () => {
  assert.equal(classifyMandateResult('ELEITO POR MÉDIA'), 'eleito')
  assert.equal(classifyMandateResult('2º SUPLENTE DE SENADOR'), 'suplente')
  assert.equal(classifyMandateResult('SUPLENTE'), 'suplente')
  assert.equal(classifyMandateResult('NÃO ELEITO'), null)
  assert.equal(classifyMandateResult('NAO ELEITO'), null)
  assert.equal(classifyMandateResult('RENÚNCIA'), null)
  assert.equal(classifyMandateResult(null), null)
})

test('matchHistoricToCandidates casa pelo nome completo + data de nascimento', () => {
  const candidate = makeCandidate({ birthDate: '1980-02-02' })
  const mandates = matchHistoricToCandidates(
    [fazerLinha({ nome: 'ANA PARTICIPANTE TESTE' })],
    [candidate],
  )
  assert.equal(mandates.length, 1)
  assert.equal(mandates[0].candidateId, '2026-PR-1')
  assert.equal(mandates[0].ano, 2020)
  assert.equal(mandates[0].cargo, 'VEREADOR')
  assert.equal(mandates[0].status, 'eleito')
})

test('matchHistoricToCandidates ignora quando a data de nascimento difere', () => {
  const candidate = makeCandidate({ birthDate: '1980-02-02' })
  const mandates = matchHistoricToCandidates(
    [fazerLinha({ dataNascimento: '1981-03-03' })],
    [candidate],
  )
  assert.equal(mandates.length, 0)
})

test('matchHistoricToCandidates exige data de nascimento para nome de urna curto', () => {
  const candidate = makeCandidate({
    id: '2026-PR-7',
    ballotName: 'ANA',
    fullName: 'ANA CARLA DE SOUSA',
    birthDate: '1980-02-02',
  })
  const comData = matchHistoricToCandidates(
    [fazerLinha({ nome: 'ANA', dataNascimento: '1980-02-02' })],
    [candidate],
  )
  assert.equal(comData.length, 1)
  const semData = matchHistoricToCandidates(
    [fazerLinha({ nome: 'ANA', dataNascimento: null })],
    [candidate],
  )
  assert.equal(semData.length, 0)
})

test('matchHistoricToCandidates sem data no histórico exige nome completo', () => {
  const candidate = makeCandidate({ birthDate: null })
  const completo = matchHistoricToCandidates(
    [fazerLinha({ nome: 'ANA PARTICIPANTE TESTE', dataNascimento: null })],
    [candidate],
  )
  assert.equal(completo.length, 1)
})

test('matchHistoricToCandidates não registra não eleitos', () => {
  const candidate = makeCandidate({ birthDate: '1980-02-02' })
  const mandates = matchHistoricToCandidates(
    [fazerLinha({ resultado: 'NÃO ELEITO' })],
    [candidate],
  )
  assert.equal(mandates.length, 0)
})

test('matchHistoricToCandidates mantém suplentes', () => {
  const candidate = makeCandidate({ birthDate: '1980-02-02' })
  const mandates = matchHistoricToCandidates(
    [fazerLinha({ resultado: '1º SUPLENTE' })],
    [candidate],
  )
  assert.equal(mandates.length, 1)
  assert.equal(mandates[0].status, 'suplente')
})

test('matchHistoricToCandidates agrupa por (candidato, ano, cargo, turno)', () => {
  const candidate = makeCandidate({ birthDate: '1980-02-02' })
  const mandates = matchHistoricToCandidates(
    [
      fazerLinha({ nome: 'ANA PARTICIPANTE TESTE' }),
      fazerLinha({ nome: 'ANA PARTICIPANTE TESTE' }),
      fazerLinha({ cargo: 'PREFEITO', turno: 1, resultado: 'ELEITO' }),
      fazerLinha({ cargo: 'PREFEITO', turno: 2, resultado: 'ELEITO' }),
    ],
    [candidate],
  )
  assert.equal(mandates.length, 3)
})

test('sortMandates ordena por ano e cargo', () => {
  const mandato = (ano: number, cargo: string): PoliticalMandate => ({
    candidateId: '2026-PR-1',
    ano,
    cargo,
    uf: 'PR',
    municipio: null,
    partidoSigla: null,
    status: 'eleito',
    turno: 0,
    sqCandidato: null,
  })
  const ordenado = sortMandates([
    mandato(2020, 'VEREADOR'),
    mandato(2008, 'VEREADOR'),
    mandato(2008, 'PREFEITO'),
  ])
  assert.deepEqual(
    ordenado.map((m) => [m.ano, m.cargo]),
    [
      [2008, 'PREFEITO'],
      [2008, 'VEREADOR'],
      [2020, 'VEREADOR'],
    ],
  )
})

test('formatCargoLabel dá rótulo legível a cargos executivos e do Senado', () => {
  assert.equal(formatCargoLabel('SENADOR'), 'Senador')
  assert.equal(formatCargoLabel('PREFEITO'), 'Prefeito')
  assert.equal(formatCargoLabel('GOVERNADOR'), 'Governador')
  assert.equal(formatCargoLabel('VICE-GOVERNADOR'), 'Vice-governador')
  assert.equal(formatCargoLabel('PRESIDENTE'), 'Presidente')
  assert.equal(formatCargoLabel('VICE-PRESIDENTE'), 'Vice-presidente')
  assert.equal(formatCargoLabel('1º SUPLENTE'), '1º suplente de senador')
  assert.equal(formatCargoLabel('2º SUPLENTE'), '2º suplente de senador')
})

test('formatMandateSummary descreve cargo, lugar, partido e resultado', () => {
  assert.equal(
    formatMandateSummary({
      candidateId: '2026-PR-1',
      ano: 2020,
      cargo: 'VEREADOR',
      uf: 'PR',
      municipio: 'Curitiba',
      partidoSigla: 'PTE',
      status: 'eleito',
      turno: 0,
      sqCandidato: null,
    }),
    '2020 Vereador em Curitiba/PR (PTE) · eleito',
  )
})

test('emptyFichaParaCsv preenche o resumo de posições anteriores', () => {
  const candidate = makeCandidate({ birthDate: '1980-02-02' })
  const history: PoliticalMandate[] = [
    {
      candidateId: candidate.id,
      ano: 2008,
      cargo: 'VEREADOR',
      uf: 'PR',
      municipio: 'Curitiba',
      partidoSigla: 'PTE',
      status: 'eleito',
      turno: 0,
      sqCandidato: null,
    },
    {
      candidateId: candidate.id,
      ano: 2016,
      cargo: 'PREFEITO',
      uf: 'PR',
      municipio: 'Curitiba',
      partidoSigla: 'PTE',
      status: 'eleito',
      turno: 0,
      sqCandidato: null,
    },
  ]
  const linha = emptyFichaParaCsv(
    candidate,
    undefined,
    undefined,
    null,
    history,
  )
  assert.equal(linha.historico_posicoes_total, 2)
  assert.equal(
    linha.historico_posicoes,
    '2008 Vereador em Curitiba/PR (PTE) · eleito | 2016 Prefeito em Curitiba/PR (PTE) · eleito',
  )
})

test('emptyFichaParaCsv deixa posições anteriores vazias sem histórico', () => {
  const linha = emptyFichaParaCsv(makeCandidate(), undefined, undefined, null)
  assert.equal(linha.historico_posicoes, null)
  assert.equal(linha.historico_posicoes_total, null)
})
