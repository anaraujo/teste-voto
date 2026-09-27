import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Candidate, OptionId, QuestionId } from '../src/data/quiz.ts'
import { quizQuestions } from '../src/data/quiz-source.ts'
import { computeResult, questionMatches, rankResults } from '../src/lib/scoring.ts'

function candidate(id: string, name: string, profile: Partial<Record<QuestionId, OptionId>>): Candidate {
  return {
    id,
    name,
    description: '',
    profile: {
      sector: 'setor:outros',
      experience: 'experiencia:sem-mandato',
      age: 'idade:40-49',
      candidacy: 'agremiacao:isolado',
      local: 'local:pr',
      ...profile,
    },
  }
}

const answers: Record<QuestionId, OptionId> = {
  sector: 'setor:direito',
  experience: 'experiencia:sem-mandato',
  age: 'idade:40-49',
  candidacy: 'agremiacao:isolado',
  local: 'local:pr',
}

test('rankResults ordena por mais concordâncias', () => {
  const perf = candidate('b', 'B', answers)
  const parcial = candidate('a', 'A', { sector: 'setor:saude' })
  const ranked = rankResults(answers, quizQuestions, [parcial, perf])
  assert.equal(ranked[0].candidate.id, 'b')
  assert.equal(ranked[0].matches, 5)
  assert.equal(ranked[1].matches, 4)
})

test('rankResults desempata por raridade do perfil e depois nome', () => {
  // a1 e a2 compartilham o mesmo perfil (raridade 2); b tem perfil único (1).
  const shared: Partial<Record<QuestionId, OptionId>> = {
    ...answers,
    age: 'idade:ate-39',
  }
  const a1 = candidate('a1', 'A', shared)
  const a2 = candidate('a2', 'B', shared)
  const b = candidate('b1', 'C', { ...answers, local: 'local:fora' })

  const ranked = rankResults(answers, quizQuestions, [a2, b, a1])

  // Todos empatam em acertos (4); b é o perfil mais raro e sobe primeiro.
  assert.equal(ranked[0].candidate.id, 'b1')
  assert.equal(ranked[1].candidate.id, 'a1')
  assert.equal(ranked[2].candidate.id, 'a2')
})

test('computeResult retorna o melhor alinhado', () => {
  const perf = candidate('b', 'B', answers)
  const result = computeResult(answers, quizQuestions, [perf])
  assert.equal(result?.candidate.id, 'b')
  assert.equal(result?.matches, 5)
})

test('computeResult é null sem candidatos', () => {
  assert.equal(computeResult(answers, quizQuestions, []), null)
})

test('questionMatches detalha acerto por pergunta', () => {
  const perf = candidate('b', 'B', answers)
  const matches = questionMatches(answers, quizQuestions, perf)
  assert.equal(matches.length, quizQuestions.length)
  assert.ok(matches.every((item) => item.matched))
  assert.ok(matches.every((item) => item.user && item.candidate))
})