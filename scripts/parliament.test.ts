import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { CandidateRecord } from '../src/shared/domain.ts'
import { normalizeName } from '../src/data-sources/camara/identity.ts'
import { parseParlamentar } from '../src/data-sources/camara/senado.ts'
import { matchHistoryPeople } from '../src/data-sources/parliament/identity.ts'
import { emptyFichaParaCsv } from '../src/data-sources/parliament/export.ts'
import { EDITORIAL_THEMES } from '../src/shared/ficha.ts'
import { PAUTAS_CHAVE } from '../src/shared/pautas.ts'

const SEM_EVIDENCIA = 'não encontrei evidência suficiente'

function makeCandidate(overrides: Partial<CandidateRecord> = {}): CandidateRecord {
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

test('normalizeName remove acentos, pontuação e normaliza caixa', () => {
  assert.equal(normalizeName('JOÃO F. DA SILVA'), 'joao f da silva')
  assert.equal(normalizeName('  Ana  Maria-'), 'ana maria')
})

test('matchHistoryPeople casa pelo nome completo ou nome de urna', () => {
  const candidate = makeCandidate({
    id: '2026-PR-42',
    ballotName: 'ZÉ DO POVO',
    fullName: 'JOSE CARLOS DO POVO',
  })
  const { matched, unmatched } = matchHistoryPeople([candidate], [
    { id: 1, nome: 'Zé do Povo', dataNascimento: null },
  ])
  assert.equal(matched.get(1), '2026-PR-42')
  assert.equal(unmatched.length, 0)
})

test('matchHistoryPeople exige data de nascimento para nome de urna curto', () => {
  const candidate = makeCandidate({
    id: '2026-PR-7',
    ballotName: 'ANA',
    fullName: 'ANA CARLA DE SOUSA',
    birthDate: '1980-02-02',
  })
  const { matched, unmatched } = matchHistoryPeople([candidate], [
    { id: 3, nome: 'Ana', dataNascimento: '1980-02-02' },
  ])
  assert.equal(matched.get(3), '2026-PR-7')
  assert.equal(unmatched.length, 0)

  const { matched: semData, unmatched: naoCasou } = matchHistoryPeople([candidate], [
    { id: 4, nome: 'Ana', dataNascimento: null },
  ])
  assert.equal(semData.size, 0)
  assert.equal(naoCasou.length, 1)
})

test('parseParlamentar lê mandatos de Primeira e SegundaLegislatura', () => {
  const xml = `<?xml?><Parlamentar>
    <IdentificacaoParlamentar>
      <CodigoParlamentar>5000</CodigoParlamentar>
      <NomeParlamentar>MARIA TESTE</NomeParlamentar>
      <NomeCompletoParlamentar>MARIA TESTE DA SILVA</NomeCompletoParlamentar>
      <SiglaPartidoParlamentar>PSD</SiglaPartidoParlamentar>
    </IdentificacaoParlamentar>
    <Mandato>
      <UfParlamentar>PR</UfParlamentar>
      <PrimeiraLegislaturaDoMandato>
        <NumeroLegislatura>55</NumeroLegislatura>
        <DataInicio>2015-02-01</DataInicio>
        <DataFim>2019-01-31</DataFim>
      </PrimeiraLegislaturaDoMandato>
    </Mandato>
  </Parlamentar>`

  const parsed = parseParlamentar(xml)
  assert.equal(parsed.codigo, 5000)
  assert.equal(parsed.nome, 'MARIA TESTE')
  assert.equal(parsed.partido, 'PSD')
  assert.equal(parsed.mandatos.length, 1)
  assert.equal(parsed.mandatos[0].legislatura, 55)
  assert.equal(parsed.mandatos[0].uf, 'PR')
  assert.equal(parsed.mandatos[0].dataInicio, '2015-02-01')
})

test('emptyFichaParaCsv marca sem histórico e sem evidência por padrão', () => {
  const candidate = makeCandidate()
  const linha = emptyFichaParaCsv(candidate, undefined, undefined, null)

  assert.equal(linha.tem_historico_parlamentar, 'Não')
  for (const pauta of PAUTAS_CHAVE) {
    assert.equal(linha[`voto_${pauta.tema}`], 'Sem histórico parlamentar')
  }
  for (const tema of EDITORIAL_THEMES) {
    assert.equal(linha[`posicao_${tema.id}`], SEM_EVIDENCIA)
    assert.equal(linha[`posicao_${tema.id}_evidencia`], 'Sem evidência')
  }
})

test('emptyFichaParaCsv usa valores do histórico parlamentar quando há mandato', () => {
  const candidate = makeCandidate()
  const linha = emptyFichaParaCsv(
    candidate,
    undefined,
    {
      mandates: [{ casa: 'camara', legislatura: '57', partido: 'PT', uf: 'PR' }],
      records: [
        {
          casa: 'camara',
          proposicoesPorAno: { '2023': 12 },
          comissoes: [{ sigla: 'CLP', nome: 'Comissão de Legislação Participativa' }],
          despesasPorAno: { '2023': 1500.5 },
        },
      ],
      votes: [
        {
          candidateId: '2026-PR-1',
          votacaoId: PAUTAS_CHAVE[0].votacaoId,
          tema: PAUTAS_CHAVE[0].tema,
          rotulo: 'Rotulo',
          proposicao: 'PL 1/2024',
          data: '2024-01-31',
          casa: 'camara',
          voto: 'Sim',
        },
      ],
    },
    null,
  )

  assert.equal(linha.tem_historico_parlamentar, 'Sim')
  assert.equal(linha.camara_legislaturas, '57ª (PT)')
  assert.equal(linha.camara_proposicoes_total, 12)
  assert.equal(linha.camara_despesas_total_reais, 1500.5)
  assert.equal(linha.camara_comissoes, 'CLP')
  assert.equal(linha[`voto_${PAUTAS_CHAVE[0].tema}`], 'Sim')
})

test('emptyFichaParaCsv distingue voto não registrado de votação indisponível', () => {
  const candidate = makeCandidate()
  const linha = emptyFichaParaCsv(
    candidate,
    undefined,
    {
      mandates: [{ casa: 'camara', legislatura: '57', partido: 'PT', uf: 'PR' }],
      records: [],
      votes: [
        {
          candidateId: '2026-PR-1',
          votacaoId: PAUTAS_CHAVE[0].votacaoId,
          tema: PAUTAS_CHAVE[0].tema,
          rotulo: 'Rotulo',
          proposicao: 'PL 1/2024',
          data: '2024-01-31',
          casa: 'camara',
          voto: null,
        },
      ],
    },
    null,
  )

  assert.equal(linha[`voto_${PAUTAS_CHAVE[0].tema}`], 'Não registrou voto')
  assert.equal(linha[`voto_${PAUTAS_CHAVE[1].tema}`], 'Votação não disponível')
})