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
  maritalStatus: string | null
  birthState: string | null
  federation: string | null
  /** Município de nascimento (dataset complementar do TSE). */
  birthMunicipality: string | null
  /** ST_QUILOMBOLA do TSE. */
  quilombola: boolean | null
  /** DS_ETNIA_INDIGENA do TSE (null quando não indígena/sem informação). */
  indigenousEthnicity: string | null
  /** ST_CANDIDATO_INSERIDO_URNA (registro, não é resultado do pleito). */
  inBallot: boolean | null
  /** ST_SUBSTITUIDO do TSE. */
  substituted: boolean | null
  /** ST_PREST_CONTAS do TSE (S/N). */
  accountsDeclared: boolean | null
  /** ST_DECLARAR_BENS do TSE (S/N). */
  assetsDeclared: boolean | null
  /** ST_REELEICAO do TSE (S/N). */
  isReelection: boolean | null
  /** VR_DESPESA_MAX_CAMPANHA do TSE (teto legal, em R$). */
  campaignSpendingCap: number | null
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