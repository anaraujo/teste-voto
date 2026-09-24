import type {
  Candidate,
  OptionId,
  Question,
  QuestionId,
} from '../data/quiz.ts'

export interface RankedEntry {
  candidate: Candidate
  matches: number
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