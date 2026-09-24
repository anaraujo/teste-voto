import type {
  Candidate,
  Option,
  OptionId,
  Question,
  QuestionId,
} from '../data/quiz.ts'

export interface RankedEntry {
  candidate: Candidate
  matches: number
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

export function rankResults(
  answers: Record<QuestionId, OptionId>,
  questions: readonly Question[],
  candidates: readonly Candidate[],
): RankedEntry[] {
  return candidates
    .map((candidate) => ({
      candidate,
      matches: countMatches(candidate, answers, questions),
    }))
    .sort((a, b) => b.matches - a.matches)
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