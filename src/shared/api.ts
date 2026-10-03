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
  electionYear: number
  state: string
  office: string
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
  quizPositions: ApiQuizPosition[]
  quizMetrics: ApiQuizMetrics | null
  source: Source
}

export interface ApiQuizPosition {
  pautaId: string
  value: 'sim' | 'nao' | null
  origin: 'candidato' | 'partido' | null
  voto: string | null
  partyAcronym: string | null
  sourceUrl: string | null
}

export interface ApiQuizMetrics {
  alinhamentoGoverno: number | null
  alinhamentoOrigem: 'candidato' | 'partido' | null
  trajetoria: number
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

export interface ApiCampaignContributor {
  nome: string
  valor: number
}

export interface ApiCampaignFinance {
  totalReceitas: number
  totalDespesas: number
  /** Maiores doadores, somados por nome, em ordem decrescente. */
  doadores: ApiCampaignContributor[]
  /** Maiores fornecedores, somados por nome, em ordem decrescente. */
  fornecedores: ApiCampaignContributor[]
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
  /** Prestação de contas de campanha; null quando não há. */
  campaignFinance: ApiCampaignFinance | null
}
