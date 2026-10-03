import type {
  Candidate,
  GivenAnswer,
  Question,
  QuestionId,
} from '../data/quiz.ts'
import { pickWinner } from './scoring.ts'

export const AUDIT_SAMPLES = 50_000
export const AUDIT_SEED = 20261004

export interface DistributionEntry {
  candidate: Candidate
  wins: number
  share: number
}

export interface PartyShare {
  party: string
  candidates: number
  candidateShare: number
  wins: number
  winShare: number
}

export interface Distribution {
  entries: readonly DistributionEntry[]
  partyShares: readonly PartyShare[]
  totalCombinations: number
  idealShare: number
  sampled: boolean
}

export function computeDistribution(
  questions: readonly Question[],
  candidates: readonly Candidate[],
  options: { samples?: number; seed?: number } = {},
): Distribution {
  const samples = options.samples ?? AUDIT_SAMPLES
  const random = mulberry32(options.seed ?? AUDIT_SEED)
  const wins = new Map(candidates.map((candidate) => [candidate.id, 0]))
  let totalCombinations = 0

  for (let index = 0; index < samples; index++) {
    totalCombinations++
    const result = pickWinner(
      sampleAnswers(questions, random),
      questions,
      candidates,
    )
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
        share: totalCombinations > 0 ? candidateWins / totalCombinations : 0,
      } satisfies DistributionEntry
    })
    .sort((a, b) => b.wins - a.wins || a.candidate.name.localeCompare(b.candidate.name, 'pt-BR'))

  return {
    entries,
    partyShares: partyShares(entries, totalCombinations),
    totalCombinations,
    idealShare: candidates.length > 0 ? totalCombinations / candidates.length : 0,
    sampled: true,
  }
}

function sampleAnswers(
  questions: readonly Question[],
  random: () => number,
): Record<QuestionId, GivenAnswer> {
  const answers = {} as Record<QuestionId, GivenAnswer>
  for (const question of questions) {
    const index = Math.floor(random() * question.options.length)
    const option = question.options[index] ?? question.options[0]
    answers[question.id] = { optionId: option.id, weight: 1 }
  }
  return answers
}

function partyShares(
  entries: readonly DistributionEntry[],
  total: number,
): PartyShare[] {
  const groups = new Map<string, { candidates: number; wins: number }>()
  for (const entry of entries) {
    const party = entry.candidate.partyAcronym ?? 'sem partido'
    const group = groups.get(party) ?? { candidates: 0, wins: 0 }
    group.candidates++
    group.wins += entry.wins
    groups.set(party, group)
  }
  return [...groups.entries()]
    .map(([party, group]) => ({
      party,
      candidates: group.candidates,
      candidateShare: entries.length > 0 ? group.candidates / entries.length : 0,
      wins: group.wins,
      winShare: total > 0 ? group.wins / total : 0,
    }))
    .sort((a, b) => b.winShare - a.winShare || a.party.localeCompare(b.party, 'pt-BR'))
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
