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
  candidacyType: string | null
  federation: string | null
  occupation: string | null
  education: string | null
  maritalStatus: string | null
  birthDate: string | null
  birthState: string | null
  gender: string | null
  race: string | null
  status: string | null
  city: string | null
  photoUrl: string | null
  birthMunicipality: string | null
  isReelection: boolean | null
  totalAssets: number | null
  assetsDeclared: boolean | null
  socialLinks: string[]
  quilombola: boolean | null
  indigenousEthnicity: string | null
  accountsDeclared: boolean | null
  isIncumbent: boolean
  camaraPartyAcronym: string | null
  source: Source
}

export interface ApiCandidatesResponse {
  election: ApiElection
  total: number
  candidates: ApiCandidate[]
}

export interface ApiMandate {
  casa: 'camara' | 'senado'
  legislatura: string
  idParlamentar: number
  nomeParlamentar: string
  partido: string | null
  uf: string | null
  dataInicio: string | null
  dataFim: string | null
}

export interface ApiComissao {
  sigla: string
  nome: string
}

export interface ApiParliamentaryRecord {
  casa: 'camara' | 'senado'
  proposicoesPorAno: Record<string, number>
  comissoes: ApiComissao[]
  despesasPorAno: Record<string, number>
}

export interface ApiVote {
  votacaoId: string
  tema: string
  rotulo: string
  proposicao: string
  data: string
  casa: 'camara' | 'senado'
  voto: string | null
}

export interface ApiEditorialField {
  valor: string
  tipo: string
  fonte: string | null
}

export interface ApiParliamentary {
  mandates: ApiMandate[]
  records: ApiParliamentaryRecord[]
  votes: ApiVote[]
}

export interface ApiPoliticalMandate {
  ano: number
  cargo: string
  uf: string | null
  municipio: string | null
  partidoSigla: string | null
  status: 'eleito' | 'suplente'
  turno: number
}

export interface ApiCandidateDetail extends ApiCandidate {
  campaignStatus: string | null
  nationality: string | null
  email: string | null
  inBallot: boolean | null
  substituted: boolean | null
  campaignSpendingCap: number | null
  importedAt: string
  updatedAt: string
  /** Histórico parlamentar (Câmara/Senado); null quando não há histórico. */
  parliamentary: ApiParliamentary | null
  /** Posições/propostas editoriais; null quando não há ficha editorial. */
  editorial: Record<string, ApiEditorialField> | null
  /** Mandatos/posições políticas anteriores (TSE, 2004+). */
  politicalMandates: ApiPoliticalMandate[]
  /**
   * Histórico de vereação nas Câmaras Municipais (SAPL).
   *
   * Sempre presente, mesmo sem dado: `coverage` diz se a fonte foi consultada
   * ou se não há fonte legível, que são coisas diferentes para o leitor.
   */
  municipal: ApiMunicipalHistory
}
/**
 * Vínculo entre candidato e cadastro de vereador na Câmara.
 *
 * `status` decide o que a ficha pode afirmar. `probable` é o máximo hoje: o
 * SAPL não publica o `sq_candidato` do TSE, então ninguém é `confirmed`.
 */
export type ApiMunicipalMatchStatus = 'confirmed' | 'probable' | 'unresolved'

/** Um mandato como a Câmara o registra. */
export interface ApiMunicipalMandate {
  sourceId: string
  municipalityName: string
  legislatureLabel: string | null
  startDate: string | null
  endDate: string | null
  titular: boolean | null
  party: string | null
  sourceUrl: string
  sourcePublisher: string
}

/** Vínculo candidato -> vereador, com o que sustenta a decisão. */
export interface ApiMunicipalIdentity {
  sourceId: string
  municipalityName: string
  matchingStatus: ApiMunicipalMatchStatus
  matchingEvidence: string | null
  /** Mandatos da Câmara ligada a este cadastro; vazio se não houver. */
  mandates: ApiMunicipalMandate[]
}

/**
 * Situação do histórico municipal para este candidato.
 *
 * `coverage` diz se a fonte foi de fato consultada. `unavailable` é diferente
 * de `no-match`: a primeira é "não achei onde procurar", a segunda é "procurei
 * e não achei" — a ficha precisa distinguir as duas.
 */
export interface ApiMunicipalHistory {
  coverage: 'read' | 'unavailable'
  /** Por que a fonte não pôde ser lida; null quando `coverage === 'read'`. */
  coverageNote: string | null
  identities: ApiMunicipalIdentity[]
}
