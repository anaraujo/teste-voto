import { test } from 'node:test'
import assert from 'node:assert/strict'
import type {
  Candidate,
  GivenAnswer,
  OptionId,
  Question,
  QuestionId,
} from '../src/data/quiz.ts'
import { quizQuestions } from '../src/data/quiz-source.ts'
import {
  computeResult,
  questionMatches,
  rankResults,
} from '../src/lib/scoring.ts'

const profileQuestions = quizQuestions.filter((question) => question.kind === 'profile')

function candidate(
  id: string,
  name: string,
  profile: Partial<Record<QuestionId, OptionId | null>>,
  facts: Candidate['facts'] = {},
): Candidate {
  const full = {} as Record<QuestionId, OptionId | null>
  const fullFacts = {} as Candidate['facts']
  for (const question of quizQuestions) {
    full[question.id] = profile[question.id] ?? null
    fullFacts[question.id] = facts[question.id] ?? null
  }
  return {
    id,
    name,
    description: '',
    partyAcronym: 'PX',
    profile: Object.assign(full, profile),
    facts: { ...fullFacts, ...facts },
  }
}

function answerMap(
  profile: Record<QuestionId, OptionId | null>,
  weight: 1 | 2 = 1,
): Record<QuestionId, GivenAnswer> {
  const answers = {} as Record<QuestionId, GivenAnswer>
  for (const [id, optionId] of Object.entries(profile)) {
    if (!optionId) continue
    answers[id] = { optionId, weight }
  }
  return answers
}

const baseProfile = {
  sector: 'setor:direito',
  age: 'idade:40-49',
  candidacy: 'agremiacao:isolado',
  local: 'local:pr',
  trajetoria: 'trajetoria:renovacao',
  alinhamento: 'alinhamento:independente',
} as Record<QuestionId, OptionId>

test('rankResults ordena pela fração de concordância', () => {
  const answers = answerMap(baseProfile)
  const perf = candidate('b', 'B', baseProfile)
  const parcial = candidate('a', 'A', { ...baseProfile, sector: 'setor:saude' })
  const ranked = rankResults(answers, profileQuestions, [parcial, perf])
  assert.equal(ranked[0].candidate.id, 'b')
  assert.equal(ranked[0].score, 1)
  assert.ok(ranked[1].score < 1)
})

test('rankResults desempata por raridade do perfil e depois nome', () => {
  const shared = { ...baseProfile, age: 'idade:ate-39' }
  const answers = answerMap(baseProfile)
  const a1 = candidate('a1', 'A', shared)
  const a2 = candidate('a2', 'B', shared)
  const b = candidate('b1', 'C', { ...baseProfile, local: 'local:fora' })
  const ranked = rankResults(answers, profileQuestions, [a2, b, a1])
  assert.equal(ranked[0].candidate.id, 'b1')
  assert.equal(ranked[1].candidate.id, 'a1')
  assert.equal(ranked[2].candidate.id, 'a2')
})

test('peso 2 muda a fração e voto próprio desempata', () => {
  const questions: Question[] = [
    {
      id: 'pauta:x',
      kind: 'stance',
      title: 'Pergunta',
      options: [
        { id: 'pauta:x:concordo', label: 'Concordo' },
        { id: 'pauta:x:discordo', label: 'Discordo' },
        { id: 'pauta:x:tanto-faz', label: 'Tanto faz' },
      ],
    },
  ]
  const answers: Record<QuestionId, GivenAnswer> = {
    'pauta:x': { optionId: 'pauta:x:concordo', weight: 2 },
  }
  const own = candidate('own', 'A', { 'pauta:x': 'pauta:x:sim' }, {
    'pauta:x': { text: 'Votou Sim', sourceUrl: null, origin: 'candidato' },
  })
  const party = candidate('party', 'B', { 'pauta:x': 'pauta:x:sim' }, {
    'pauta:x': { text: 'Partido orientou Sim', sourceUrl: null, origin: 'partido' },
  })
  const ranked = rankResults(answers, questions, [party, own])
  assert.equal(ranked[0].candidate.id, 'own')
  assert.equal(ranked[0].matches, 2)
  assert.equal(ranked[0].ownVoteMatches, 1)
  assert.equal(ranked[1].ownVoteMatches, 0)
})

test('tanto faz e dado ausente não contam como divergência', () => {
  const questions: Question[] = quizQuestions.filter((question) => question.id === 'sector')
  const answers: Record<QuestionId, GivenAnswer> = {
    sector: { optionId: 'setor:saude', weight: 1 },
    'pauta:x': { optionId: 'pauta:x:tanto-faz', weight: 1 },
  }
  const person = candidate('a', 'A', { sector: null })
  const ranked = rankResults(answers, questions, [person])
  assert.equal(ranked[0].possible, 0)
  assert.equal(ranked[0].coverage, 0)
})

test('cobertura abaixo de 50% fica atrás de quem tem dado', () => {
  const questions = profileQuestions
  const answers = answerMap(baseProfile)
  const thin = candidate('thin', 'A', { sector: 'setor:direito' })
  const full = candidate('full', 'B', {
    ...baseProfile,
    sector: 'setor:saude',
  })
  const ranked = rankResults(answers, questions, [thin, full])
  assert.equal(ranked[0].candidate.id, 'full')
  assert.ok(ranked[0].coverage >= 0.5)
  assert.ok(ranked[1].coverage < 0.5)
})

test('computeResult é null sem candidatos', () => {
  assert.equal(computeResult(answerMap(baseProfile), profileQuestions, []), null)
})

test('questionMatches detalha acerto por pergunta', () => {
  const answers = answerMap(baseProfile)
  const perf = candidate('b', 'B', baseProfile)
  const matches = questionMatches(answers, profileQuestions, perf)
  assert.equal(matches.length, profileQuestions.length)
  assert.ok(matches.every((match) => match.matched))
})
