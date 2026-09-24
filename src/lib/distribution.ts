import type {
  Candidate,
  OptionId,
  Question,
  QuestionId,
} from '../data/quiz.ts'
import { computeResult } from './scoring.ts'

export interface DistributionEntry {
  candidate: Candidate
  wins: number
  share: number
}

export interface Distribution {
  entries: readonly DistributionEntry[]
  totalCombinations: number
  idealShare: number
}

export function computeDistribution(
  questions: readonly Question[],
  candidates: readonly Candidate[],
): Distribution {
  const wins = new Map(candidates.map((candidate) => [candidate.id, 0]))
  let totalCombinations = 0

  for (const answers of allCombinations(questions)) {
    totalCombinations++
    const result = computeResult(answers, questions, candidates)
    if (result) {
      wins.set(result.candidate.id, (wins.get(result.candidate.id) ?? 0) + 1)
    }
  }

  const entries = candidates
    .map((candidate) => {
      const candidateWins = wins.get(candidate.id) ?? 0
      return {
        candidate,
        wins: candidateWins,
        share: candidateWins / totalCombinations,
      } satisfies DistributionEntry
    })
    .sort((a, b) => b.wins - a.wins)

  return {
    entries,
    totalCombinations,
    idealShare: totalCombinations / candidates.length,
  }
}

function* allCombinations(
  questions: readonly Question[],
): Generator<Record<QuestionId, OptionId>> {
  if (questions.length === 0) {
    yield {}
    return
  }

  const [first, ...rest] = questions

  for (const option of first.options) {
    for (const tail of allCombinations(rest)) {
      yield { ...tail, [first.id]: option.id }
    }
  }
}