export type QuestionId = string
export type OptionId = string
export type CandidateId = string

export interface Option {
  id: OptionId
  label: string
}

export type QuestionKind = 'profile' | 'stance'

export interface Question {
  id: QuestionId
  title: string
  hint?: string
  kind: QuestionKind
  options: readonly Option[]
}

export interface CandidateFact {
  text: string
  sourceUrl: string | null
  origin: 'candidato' | 'partido' | 'metrica' | null
}

export interface Candidate {
  id: CandidateId
  name: string
  description: string
  photo?: string
  ballotNumber?: string
  partyAcronym: string | null
  profile: Record<QuestionId, OptionId | null>
  facts: Record<QuestionId, CandidateFact | null>
}

export interface GivenAnswer {
  optionId: OptionId
  weight: 1 | 2
}

export { quizQuestions as questions, questionsFor } from './quiz-source.ts'
export type {
  ProfileSource,
  SectorId,
  AgeBandId,
  CandidacyId,
  LocalId,
} from './quiz-source.ts'
