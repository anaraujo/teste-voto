/**
 * Modelo de domínio da camada eleitoral (separado do quiz).
 */

export interface Source {
  provider: string
  url: string
  dataset: string
  sourceFile: string | null
  retrievedAt: string
  sourceUpdatedAt: string | null
}

/** Registro normalizado de um candidato, derivado dos dados oficiais do TSE. */
export interface CandidateRecord {
  id: string
  tseSequence: string
  electionYear: number
  state: string
  office: string
  ballotName: string
  fullName: string
  ballotNumber: string
  party: string | null
  partyAcronym: string | null
  coalition: string | null
  status: string | null
  campaignStatus: string | null
  candidacyType: string | null
  occupation: string | null
  education: string | null
  birthDate: string | null
  gender: string | null
  race: string | null
  nationality: string | null
  city: string | null
  email: string | null
  website: string | null
  socialLinks: string[]
  photoUrl: string | null
  totalAssets: number | null
  source: Source
  importedAt: string
  updatedAt: string
}

export function candidateId(
  election: Pick<CandidateRecord, 'electionYear' | 'state'>,
  tseSequence: string,
): string {
  return `${election.electionYear}-${election.state}-${tseSequence}`
}