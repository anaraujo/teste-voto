/**
 * Nome da UF a partir da sigla. Usado para reconhecer quando um campo que
 * deveria ser município está, na verdade, trazendo o estado: o TSE mudou o
 * significado de `NM_UE` entre 2004-2024 e 2026 (ver `electoralMunicipality`).
 */
const STATE_NAMES: Record<string, string> = {
  AC: 'ACRE', AL: 'ALAGOAS', AP: 'AMAPÁ', AM: 'AMAZONAS', BA: 'BAHIA',
  CE: 'CEARÁ', DF: 'DISTRITO FEDERAL', ES: 'ESPÍRITO SANTO', GO: 'GOIÁS',
  MA: 'MARANHÃO', MT: 'MATO GROSSO', MS: 'MATO GROSSO DO SUL',
  MG: 'MINAS GERAIS', PA: 'PARÁ', PB: 'PARAÍBA', PR: 'PARANÁ',
  PE: 'PERNAMBUCO', PI: 'PIAUÍ', RJ: 'RIO DE JANEIRO',
  RN: 'RIO GRANDE DO NORTE', RS: 'RIO GRANDE DO SUL', RO: 'RONDÔNIA',
  RR: 'RORAIMA', SC: 'SANTA CATARINA', SP: 'SÃO PAULO', SE: 'SERGIPE',
  TO: 'TOCANTINS', EX: 'EXTERIOR',
}

/**
 * `value` é um município utilizável? `null` quando está vazio ou quando é
 * apenas a UF (sigla ou nome) — os dois casos não são município e não devem
 * aparecer sob o rótulo "Município".
 */
export function municipalityOrNull(value: string | null | undefined, state: string): string | null {
  if (value === null || value === undefined) return null
  const trimmed = value.trim()
  if (trimmed === '') return null
  const upper = trimmed.toUpperCase()
  const uf = state.trim().toUpperCase()
  if (upper === uf) return null
  if (STATE_NAMES[uf] !== undefined && upper === STATE_NAMES[uf]) return null
  return trimmed
}

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
    complementar: DatasetDescriptor
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
    complementar: {
      url: 'https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand_complementar/consulta_cand_complementar_2026.zip',
      dataset: 'candidatos_complementar',
      sourceFileMatch: 'consulta_cand_complementar_2026_PR',
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