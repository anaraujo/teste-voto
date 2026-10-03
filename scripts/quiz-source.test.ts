import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { ApiCandidate } from '../src/shared/api.ts'
import type { Candidate, OptionId, QuestionId } from '../src/data/quiz.ts'
import { stateByCode } from '../src/data/brazil-map.ts'
import {
  buildProfile,
  profileKey,
  questionProvenance,
  questionsFor,
  quizQuestions,
  resolveAgeBand,
  resolveCandidacy,
  resolveExperience,
  resolveLocal,
  resolveSector,
  toQuizCandidate,
} from '../src/data/quiz-source.ts'

function apiCandidate(
  overrides: Partial<
    Pick<
      ApiCandidate,
      'occupation' | 'birthDate' | 'candidacyType' | 'birthState'
    >
  > = {},
): ApiCandidate {
  return {
    id: '2026-PR-1',
    tseSequence: '1',
    electionYear: 2026,
    state: 'PR',
    office: 'DEPUTADO FEDERAL',
    ballotName: 'FULANO DE TAL',
    fullName: 'FULANO DE TAL',
    ballotNumber: '700',
    party: 'Partido X',
    partyAcronym: 'PX',
    coalition: null,
    candidacyType: 'PARTIDO ISOLADO',
    federation: null,
    occupation: 'ADVOGADO',
    education: 'SUPERIOR COMPLETO',
    maritalStatus: 'CASADO(A)',
    birthDate: '1980-05-10',
    birthState: 'PR',
    gender: 'MASCULINO',
    race: 'BRANCA',
    status: 'APTO',
    city: null,
    photoUrl: '/photos/1.jpg',
    birthMunicipality: 'CURITIBA',
    isReelection: null,
    totalAssets: null,
    assetsDeclared: null,
    socialLinks: [],
    quilombola: null,
    indigenousEthnicity: null,
    accountsDeclared: null,
    isIncumbent: false,
    camaraPartyAcronym: null,
    quizPositions: [],
    quizMetrics: null,
    source: {
      provider: 'TSE',
      url: 'https://example.com',
      dataset: 'consulta_cand_2026',
      sourceFile: 'consulta_cand_2026_PR.csv',
      retrievedAt: '2026-01-01T00:00:00.000Z',
      sourceUpdatedAt: null,
    },
    ...overrides,
  }
}

test('resolveSector classifica ocupações por setor', () => {
  assert.equal(resolveSector('ADVOGADO'), 'direito')
  assert.equal(resolveSector('MÉDICO'), 'saude')
  assert.equal(resolveSector('PSICÓLOGO'), 'saude')
  assert.equal(resolveSector('ENFERMEIRO'), 'saude')
  assert.equal(resolveSector('FONOAUDIÓLOGO'), 'saude')
  assert.equal(
    resolveSector('TÉCNICO DE ENFERMAGEM E ASSEMELHADOS (EXCETO ENFERMEIRO)'),
    'saude',
  )
  assert.equal(resolveSector('ESTETICISTA'), 'saude')
  assert.equal(resolveSector('VETERINÁRIO'), 'saude')
  assert.equal(resolveSector('PROFESSOR DE ENSINO MÉDIO'), 'educacao')
  assert.equal(
    resolveSector('DIRETOR DE ESTABELECIMENTO DE ENSINO'),
    'educacao',
  )
  assert.equal(resolveSector('EMPRESÁRIO'), 'economia')
  assert.equal(
    resolveSector('AUXILIAR DE ESCRITÓRIO E ASSEMELHADOS'),
    'economia',
  )
  assert.equal(resolveSector('POLICIAL MILITAR'), 'seguranca')
  assert.equal(resolveSector('MEMBRO DAS FORÇAS ARMADAS'), 'seguranca')
  assert.equal(resolveSector('PRODUTOR AGROPECUÁRIO'), 'agro')
  assert.equal(resolveSector('TRABALHADOR DE CONSTRUÇÃO CIVIL'), 'servicos')
  assert.equal(resolveSector('DEPUTADO'), 'politica-e-gestao')
  assert.equal(resolveSector('SERVIDOR PÚBLICO ESTADUAL'), 'politica-e-gestao')
})

test('resolveSector não mistura aposentado de servidor', () => {
  assert.equal(resolveSector('APOSENTADO (EXCETO SERVIDOR PÚBLICO)'), 'outros')
})

test('resolveSector usa outros para o que não casou', () => {
  assert.equal(resolveSector('OUTROS'), 'outros')
  assert.equal(resolveSector('ENGENHEIRO'), 'outros')
  assert.equal(resolveSector(null), 'outros')
  assert.equal(resolveSector(''), 'outros')
})

test('resolveExperience separa mandato eletivo e técnico', () => {
  assert.equal(resolveExperience('DEPUTADO'), 'ja-deputado')
  assert.equal(resolveExperience('DEPUTADO FEDERAL'), 'ja-deputado')
  assert.equal(resolveExperience('VEREADOR'), 'outro-mandato')
  assert.equal(resolveExperience('SENADOR'), 'outro-mandato')
  assert.equal(resolveExperience('EMPRESÁRIO'), 'sem-mandato')
  assert.equal(resolveExperience(null), 'sem-mandato')
})

test('resolveAgeBand calcula idade na data da eleição', () => {
  assert.equal(resolveAgeBand('1987-10-05'), 'ate-39')
  assert.equal(resolveAgeBand('1986-10-05'), 'ate-39')
  assert.equal(resolveAgeBand('1986-10-04'), '40-49')
  assert.equal(resolveAgeBand('1976-10-04'), '50-59')
  assert.equal(resolveAgeBand('1966-10-04'), '60-mais')
  assert.equal(resolveAgeBand(null), null)
  assert.equal(resolveAgeBand('invalida'), null)
})

test('resolveCandidacy distingue federação de partido isolado', () => {
  assert.equal(resolveCandidacy('FEDERAÇÃO'), 'federacao')
  assert.equal(resolveCandidacy('federação'), 'federacao')
  assert.equal(resolveCandidacy('PARTIDO ISOLADO'), 'isolado')
  assert.equal(resolveCandidacy(null), 'isolado')
})

test('resolveLocal compara a UF de nascimento com a da eleição', () => {
  assert.equal(resolveLocal('PR', 'PR'), 'aqui')
  assert.equal(resolveLocal('SP', 'SP'), 'aqui')
  assert.equal(resolveLocal('PR', 'SP'), 'fora')
  assert.equal(resolveLocal('SP', 'PR'), 'fora')
  assert.equal(resolveLocal(null, 'PR'), 'fora')
  assert.equal(resolveLocal('', 'PR'), 'fora')
})

test('buildProfile resolve as dimensões oficiais e deixa métrica sem dado em null', () => {
  const profile = buildProfile(apiCandidate(), 'PR')
  assert.equal(profile.sector, 'setor:direito')
  assert.equal(profile.age, 'idade:40-49')
  assert.equal(profile.candidacy, 'agremiacao:isolado')
  assert.equal(profile.local, 'local:aqui')
  assert.equal(profile.trajetoria, null)
  assert.equal(profile.alinhamento, null)
  for (const question of quizQuestions) {
    if (question.kind === 'stance') continue
    const optionId = profile[question.id]
    if (optionId === null) continue
    assert.ok(question.options.some((option) => option.id === optionId))
  }
})

test('buildProfile deixa a idade em null quando a data não existe', () => {
  const profile = buildProfile(apiCandidate({ birthDate: null }), 'PR')
  assert.equal(profile.age, null)
  assert.equal(profile.sector, 'setor:direito')
})

test('buildProfile sem ocupação cai em "outra área" sem quebrar', () => {
  const profile = buildProfile(apiCandidate({ occupation: null }), 'PR')
  assert.equal(profile.sector, 'setor:outros')
})

test('a pergunta de nascimento usa a UF da eleição', () => {
  const sp = stateByCode('SP')
  assert.ok(sp)
  const questions = questionsFor(sp)
  const local = questions.find((question) => question.id === 'local')
  assert.equal(local?.title, 'Você valoriza um candidato nascido em São Paulo?')
  assert.equal(local?.options[0]?.id, 'local:aqui')
  assert.equal(local?.options[0]?.label, 'Nascido(a) em São Paulo')

  const bornInSp = buildProfile(apiCandidate({ birthState: 'SP' }), 'SP')
  assert.equal(bornInSp.local, 'local:aqui')
  const bornInPr = buildProfile(apiCandidate({ birthState: 'PR' }), 'SP')
  assert.equal(bornInPr.local, 'local:fora')
})

test('profileKey é estável por conjunto de opções', () => {
  const a = {
    sector: 'setor:direito',
    age: 'idade:40-49',
    candidacy: 'agremiacao:isolado',
    local: 'local:pr',
  } as Record<QuestionId, OptionId>
  assert.equal(profileKey(a), profileKey(a))
  assert.equal(profileKey(a).split('|').length, quizQuestions.length)
})

test('questionProvenance devolve a fonte de cada dimensão', () => {
  for (const question of quizQuestions) {
    assert.ok(questionProvenance(question.id).length > 0)
  }
  assert.ok(questionProvenance('desconhecida').length > 0)
})

test('toQuizCandidate espelha nome, foto e perfil da API', () => {
  const candidate: Candidate = toQuizCandidate(
    apiCandidate({ occupation: 'PEDAGOGO' }),
    'PR',
  )
  assert.equal(candidate.id, '2026-PR-1')
  assert.equal(candidate.name, 'FULANO DE TAL')
  assert.equal(candidate.photo, '/photos/1.jpg')
  assert.equal(candidate.ballotNumber, '700')
  assert.equal(candidate.profile.sector, 'setor:educacao')
  assert.ok(candidate.description.includes('PX'))
})
