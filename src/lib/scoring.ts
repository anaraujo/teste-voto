import type {
  Candidate,
  GivenAnswer,
  Option,
  OptionId,
  Question,
  QuestionId,
} from '../data/quiz.ts'
import { profileKey } from '../data/quiz-source.ts'

export const MIN_COVERAGE = 0.5

export interface RankedEntry {
  candidate: Candidate
  /** Pontos ponderados em que houve concordância. */
  matches: number
  /** Pontos ponderados das perguntas que entraram na conta. */
  possible: number
  /** matches / possible, ou 0 quando não há pergunta contada. */
  score: number
  /** Perguntas contadas / perguntas respondidas (sem "tanto faz"). */
  coverage: number
  rarity: number
  ownVoteMatches: number
}

export interface QuestionMatch {
  question: Question
  user: Option | undefined
  candidate: Option | undefined
  matched: boolean
  counted: boolean
  skipped: boolean
}

export function isSkip(optionId: OptionId | null | undefined): boolean {
  return optionId?.endsWith(':tanto-faz') ?? false
}

function agrees(userOptionId: OptionId, candidateOptionId: OptionId): boolean {
  if (userOptionId === candidateOptionId) return true
  const userSide = userOptionId.endsWith(':concordo')
    ? 'sim'
    : userOptionId.endsWith(':discordo')
      ? 'nao'
      : null
  const candidateSide = candidateOptionId.endsWith(':sim')
    ? 'sim'
    : candidateOptionId.endsWith(':nao')
      ? 'nao'
      : null
  if (!userSide || userSide !== candidateSide) return false
  const userPrefix = userOptionId.slice(0, userOptionId.lastIndexOf(':'))
  const candidatePrefix = candidateOptionId.slice(
    0,
    candidateOptionId.lastIndexOf(':'),
  )
  return userPrefix === candidatePrefix
}

export function questionMatches(
  answers: Record<QuestionId, GivenAnswer>,
  questions: readonly Question[],
  candidate: Candidate,
): QuestionMatch[] {
  return questions.map((question) => {
    const given = answers[question.id]
    const skipped = isSkip(given?.optionId)
    const user = question.options.find((option) => option.id === given?.optionId)
    const expectedId = candidate.profile[question.id]
    const candidateOption = question.options.find(
      (option) => option.id === expectedId,
    )
    const known = expectedId !== null && expectedId !== undefined
    const counted = Boolean(given) && !skipped && known
    return {
      question,
      user,
      candidate: candidateOption,
      matched: counted && agrees(given.optionId, expectedId as OptionId),
      counted,
      skipped,
    }
  })
}

/**
 * Ranking do quiz.
 *
 * A nota é a fração ponderada de concordância nas perguntas respondidas
 * e conhecidas para aquele candidato. "Tanto faz" e dado ausente ficam de
 * fora. Quem cobre menos da metade das perguntas respondidas fica atrás.
 * Desempate: mais concordâncias com voto próprio, perfil mais raro, nome.
 */
export function rankResults(
  answers: Record<QuestionId, GivenAnswer>,
  questions: readonly Question[],
  candidates: readonly Candidate[],
): RankedEntry[] {
  const rarity = new Map<string, number>()
  for (const candidate of candidates) {
    const key = profileKey(candidate.profile)
    rarity.set(key, (rarity.get(key) ?? 0) + 1)
  }

  return candidates
    .map((candidate) => scoreCandidate(candidate, answers, questions, rarity))
    .sort(compareRanked)
}

export function computeResult(
  answers: Record<QuestionId, GivenAnswer>,
  questions: readonly Question[],
  candidates: readonly Candidate[],
): RankedEntry | null {
  return pickWinner(answers, questions, candidates)
}

/** Melhor candidato, sem ordenar a lista inteira. */
export function pickWinner(
  answers: Record<QuestionId, GivenAnswer>,
  questions: readonly Question[],
  candidates: readonly Candidate[],
): RankedEntry | null {
  const rarity = new Map<string, number>()
  for (const candidate of candidates) {
    const key = profileKey(candidate.profile)
    rarity.set(key, (rarity.get(key) ?? 0) + 1)
  }
  let best: RankedEntry | null = null
  for (const candidate of candidates) {
    const scored = scoreCandidate(candidate, answers, questions, rarity)
    if (!best || compareRanked(scored, best) < 0) best = scored
  }
  return best
}

function compareRanked(a: RankedEntry, b: RankedEntry): number {
  return (
    Number(b.coverage >= MIN_COVERAGE) - Number(a.coverage >= MIN_COVERAGE) ||
    b.score - a.score ||
    b.ownVoteMatches - a.ownVoteMatches ||
    a.rarity - b.rarity ||
    a.candidate.name.localeCompare(b.candidate.name, 'pt-BR')
  )
}

function scoreCandidate(
  candidate: Candidate,
  answers: Record<QuestionId, GivenAnswer>,
  questions: readonly Question[],
  rarity: Map<string, number>,
): RankedEntry {
  let matches = 0
  let possible = 0
  let answered = 0
  let known = 0
  let ownVoteMatches = 0

  for (const question of questions) {
    const given = answers[question.id]
    if (!given || isSkip(given.optionId)) continue
    answered++
    const expected = candidate.profile[question.id]
    if (!expected) continue
    known++
    const weight = given.weight === 2 ? 2 : 1
    possible += weight
    if (agrees(given.optionId, expected)) {
      matches += weight
      if (candidate.facts[question.id]?.origin === 'candidato') ownVoteMatches++
    }
  }

  return {
    candidate,
    matches,
    possible,
    score: possible > 0 ? matches / possible : 0,
    coverage: answered > 0 ? known / answered : 0,
    rarity: rarity.get(profileKey(candidate.profile)) ?? 0,
    ownVoteMatches,
  }
}
