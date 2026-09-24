/**
 * Configuração de eleições suportadas pelo app.
 *
 * Cada eleição declara os datasets oficiais do TSE usados como fonte.
 * Nenhuma URL deve ser "chumbada" na lógica: tudo passa por aqui.
 */

export interface DatasetDescriptor {
  /** URL oficial do arquivo ZIP no CDN do TSE. */
  url: string
  /** Nome semântico do dataset (ex.: "consultas_candidatos"). */
  dataset: string
  /**
   * Substring usada para achar o arquivo correto dentro do ZIP
   * (ex.: "consulta_cand_2026_PR"). Pode ser vazio quando o ZIP
   * contém um único arquivo relevante.
   */
  sourceFileMatch: string
}

export interface ElectionConfig {
  year: number
  /** Unidade da Federação, ex.: "PR". */
  state: string
  /** Cargo, ex.: "DEPUTADO FEDERAL". */
  office: string
  /** URL principal de candidatos (forma curta, pedida na especificação). */
  candidateDatasetUrl: string
  datasets: {
    candidates: DatasetDescriptor
    assets: DatasetDescriptor
    social: DatasetDescriptor
    history: DatasetDescriptor
    photos: DatasetDescriptor
  }
}

const CANDIDATES_2026_URL =
  'https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2026.zip'

export const CURRENT_ELECTION: ElectionConfig = {
  year: 2026,
  state: 'PR',
  office: 'DEPUTADO FEDERAL',
  candidateDatasetUrl: CANDIDATES_2026_URL,
  datasets: {
    candidates: {
      url: CANDIDATES_2026_URL,
      dataset: 'consultas_candidatos',
      sourceFileMatch: 'consulta_cand_2026_PR',
    },
    assets: {
      url: 'https://cdn.tse.jus.br/estatistica/sead/odsele/bem_candidato/bem_candidato_2026.zip',
      dataset: 'bens_candidatos',
      sourceFileMatch: 'bem_candidato_2026_PR',
    },
    social: {
      url: 'https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/rede_social_candidato_2026.zip',
      dataset: 'redes_sociais',
      sourceFileMatch: 'rede_social_candidato_2026_PR',
    },
    history: {
      url: CANDIDATES_2026_URL,
      dataset: 'historico_candidaturas',
      sourceFileMatch: 'consulta_cand_2026_complementar_PR',
    },
    photos: {
      url: 'https://cdn.tse.jus.br/estatistica/sead/eleicoes/eleicoes2026/fotos/foto_cand2026_PR_div.zip',
      dataset: 'fotos_candidatos',
      sourceFileMatch: '',
    },
  },
}

export function electionKey(election: Pick<ElectionConfig, 'year' | 'state' | 'office'>): string {
  return `${election.year}:${election.state}:${election.office}`
}