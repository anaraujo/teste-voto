/**
 * Configuração de eleições suportadas pelo app.
 *
 * Cada eleição declara os datasets oficiais do TSE usados como fonte.
 * Nenhuma URL deve ser "chumbada" na lógica: tudo passa por aqui.
 */

import {
  BRAZIL_STATES,
  isFederationUnit,
} from '../data/brazil-map.ts'

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

const YEAR = 2026

export const OFFICE_FEDERAL = 'DEPUTADO FEDERAL'
export const OFFICE_ESTADUAL = 'DEPUTADO ESTADUAL'
export const OFFICE_DISTRITAL = 'DEPUTADO DISTRITAL'

/** Família de cargo a ingerir. O DF não tem estadual: é distrital. */
export type OfficeKind = 'federal' | 'estadual'

/**
 * Cargo da família pedida para uma UF. A família `estadual` cobre as
 * assembleias legislativas (26 UFs) e a Câmara Legislativa do DF.
 */
export function officeFor(state: string, kind: OfficeKind): string {
  if (kind === 'federal') return OFFICE_FEDERAL
  return state.trim().toUpperCase() === 'DF' ? OFFICE_DISTRITAL : OFFICE_ESTADUAL
}

const CANDIDATES_2026_URL =
  'https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2026.zip'

const ASSETS_2026_URL =
  'https://cdn.tse.jus.br/estatistica/sead/odsele/bem_candidato/bem_candidato_2026.zip'

const SOCIAL_2026_URL =
  'https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/rede_social_candidato_2026.zip'

const COMPLEMENTAR_2026_URL =
  'https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand_complementar/consulta_cand_complementar_2026.zip'

/** Siglas das 27 UFs, na ordem de `BRAZIL_STATES`. */
export const FEDERATION_UNITS: readonly string[] = BRAZIL_STATES.map(
  (state) => state.code,
)

export { isFederationUnit }

/** Eleição de 2026 para uma UF, no cargo informado (padrão: federal). */
export function electionFor(
  state: string,
  office: string = OFFICE_FEDERAL,
): ElectionConfig {
  const uf = state.trim().toUpperCase()
  if (!isFederationUnit(uf)) {
    throw new Error(`UF desconhecida: ${state}`)
  }
  return {
    year: YEAR,
    state: uf,
    office,
    candidateDatasetUrl: CANDIDATES_2026_URL,
    datasets: {
      candidates: {
        url: CANDIDATES_2026_URL,
        dataset: 'consultas_candidatos',
        sourceFileMatch: `consulta_cand_${YEAR}_${uf}`,
      },
      assets: {
        url: ASSETS_2026_URL,
        dataset: 'bens_candidatos',
        sourceFileMatch: `bem_candidato_${YEAR}_${uf}`,
      },
      social: {
        url: SOCIAL_2026_URL,
        dataset: 'redes_sociais',
        sourceFileMatch: `rede_social_candidato_${YEAR}_${uf}`,
      },
      complementar: {
        url: COMPLEMENTAR_2026_URL,
        dataset: 'candidatos_complementar',
        sourceFileMatch: `consulta_cand_complementar_${YEAR}_${uf}`,
      },
      photos: {
        url: `https://cdn.tse.jus.br/estatistica/sead/eleicoes/eleicoes${YEAR}/fotos/foto_cand${YEAR}_${uf}_div.zip`,
        dataset: 'fotos_candidatos',
        sourceFileMatch: '',
      },
    },
  }
}

/** Paraná, usado pelos syncs parlamentares que ainda não percorrem as UFs. */
export const CURRENT_ELECTION: ElectionConfig = electionFor('PR')

export function electionKey(
  election: Pick<ElectionConfig, 'year' | 'state' | 'office'>,
): string {
  return `${election.year}:${election.state}:${election.office}`
}
