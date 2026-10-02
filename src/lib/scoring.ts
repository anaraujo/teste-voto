import type {
  Candidate,
  Option,
  OptionId,
  Question,
  QuestionId,
} from '../data/quiz.ts'
import { profileKey } from '../data/quiz-source.ts'

export interface RankedEntry {
  candidate: Candidate
  matches: number
  rarity: number
}

export interface QuestionMatch {
  question: Question
  user: Option | undefined
  candidate: Option | undefined
  matched: boolean
}

export function questionMatches(
  answers: Record<QuestionId, OptionId>,
  questions: readonly Question[],
  candidate: Candidate,
): QuestionMatch[] {
  return questions.map((question) => {
    const user = question.options.find(
      (option) => option.id === answers[question.id],
    )
    const expected = question.options.find(
      (option) => option.id === candidate.profile[question.id],
    )
    return {
      question,
      user,
      candidate: expected,
      matched: user?.id === expected?.id,
    }
  })
}

/**
 * Ranking do quiz.
 *
 * Ordenação: mais concordâncias primeiro; em empate, perfis mais raros
 * (menos candidatos compartilham o mesmo perfil completo) sobem; em último
 * desempate, ordem alfabética do nome de urna (locale pt-BR). É determinístico.
 */
export function rankResults(
  answers: Record<QuestionId, OptionId>,
  questions: readonly Question[],
  candidates: readonly Candidate[],
): RankedEntry[] {
  const rarity = new Map<string, number>()
  for (const candidate of candidates) {
    const key = profileKey(candidate.profile)
    rarity.set(key, (rarity.get(key) ?? 0) + 1)
  }

  return candidates
    .map((candidate) => ({
      candidate,
      matches: countMatches(candidate, answers, questions),
      rarity: rarity.get(profileKey(candidate.profile)) ?? 0,
    }))
    .sort(
      (a, b) =>
        b.matches - a.matches ||
        a.rarity - b.rarity ||
        a.candidate.name.localeCompare(b.candidate.name, 'pt-BR'),
    )
}

export function computeResult(
  answers: Record<QuestionId, OptionId>,
  questions: readonly Question[],
  candidates: readonly Candidate[],
): RankedEntry | null {
  return rankResults(answers, questions, candidates)[0] ?? null
}

function countMatches(
  candidate: Candidate,
  answers: Record<QuestionId, OptionId>,
  questions: readonly Question[],
): number {
  let matches = 0

  for (const question of questions) {
    if (answers[question.id] === candidate.profile[question.id]) {
      matches++
    }
  }

  return matches
}
