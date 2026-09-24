/**
 * Contratos da API HTTP consumidos pelo frontend e produzidos pelo servidor.
 */

import type { Source } from './domain.ts'

export interface ApiElection {
  year: number
  state: string
  office: string
}

export interface ApiCandidate {
  id: string
  tseSequence: string
  ballotName: string
  fullName: string
  ballotNumber: string
  party: string | null
  partyAcronym: string | null
  coalition: string | null
  status: string | null
  city: string | null
  photoUrl: string | null
  source: Source
}

export interface ApiCandidatesResponse {
  election: ApiElection
  total: number
  candidates: ApiCandidate[]
}

export interface ApiCandidateDetail extends ApiCandidate {
  campaignStatus: string | null
  candidacyType: string | null
  occupation: string | null
  education: string | null
  birthDate: string | null
  gender: string | null
  race: string | null
  nationality: string | null
  email: string | null
  totalAssets: number | null
  importedAt: string
  updatedAt: string
}