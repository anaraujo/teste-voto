export type QuestionId = string
export type OptionId = string
export type CandidateId = string

export interface Option {
  id: OptionId
  label: string
}

export interface Question {
  id: QuestionId
  title: string
  hint?: string
  options: readonly Option[]
}

export interface Candidate {
  id: CandidateId
  name: string
  description: string
  photo?: string
  profile: Record<QuestionId, OptionId>
}

export { quizQuestions as questions } from './quiz-source.ts'
export type {
  ProfileSource,
  SectorId,
  ExperienceId,
  AgeBandId,
  CandidacyId,
  LocalId,
} from './quiz-source.ts'
