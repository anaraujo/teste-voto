/**
 * Dicionário de colunas do arquivo de candidatos do TSE.
 *
 * Os nomes vêm do dicionário público de dados das eleições. A ingestão
 * valida a presença das colunas obrigatórias em tempo de execução e o modo
 * `--inspect` documenta o que foi realmente observado no arquivo baixado
 * (use: npm run ingest -- --inspect).
 */

import type { ElectionConfig } from '../../shared/elections.ts'
import { buildHeaderIndex, readCell } from './csv.ts'

/** Nomes possíveis de coluna por campo lógico do modelo. */
export const TSE_COLUMNS = {
  election: ['DS_ELEICAO', 'CD_ELEICAO'],
  state: ['SG_UF'],
  office: ['DS_CARGO'],
  sequence: ['SQ_CANDIDATO'],
  ballotNumber: ['NR_CANDIDATO'],
  fullName: ['NM_CANDIDATO'],
  ballotName: ['NM_URNA_CANDIDATO'],
  partyAcronym: ['SG_PARTIDO'],
  party: ['NM_PARTIDO'],
  coalition: ['DS_COMPOSICAO_COLIGACAO'],
  status: ['DS_SITUACAO_CANDIDATURA'],
  campaignStatus: ['DS_SITUACAO_CANDIDATO_PLEITO'],
  candidacyType: ['TP_AGREMIACAO'],
  occupation: ['DS_OCUPACAO'],
  education: ['DS_GRAU_INSTRUCAO'],
  birthDate: ['DT_NASCIMENTO'],
  gender: ['DS_GENERO'],
  race: ['DS_COR_RACA'],
  nationality: ['DS_NACIONALIDADE'],
  city: ['NM_UE'],
  email: ['DS_EMAIL', 'NM_EMAIL'],
  maritalStatus: ['DS_ESTADO_CIVIL'],
  birthState: ['SG_UF_NASCIMENTO'],
  federation: ['DS_COMPOSICAO_FEDERACAO'],
} as const

export type TseField = keyof typeof TSE_COLUMNS

/** Configuração de dados analisada do CSV (usada pelo modo --inspect). */
export interface CandidateCsvConfig {
  election: string
  state: string
  office: string
}

export function collectAllHeaders(): string[] {
  const values: string[] = []
  for (const names of Object.values(TSE_COLUMNS)) {
    for (const name of names) values.push(name)
  }
  return values
}

/** Verifica se uma linha pertence à eleição configurada. */
export function isElectionRow(
  index: Map<string, number>,
  row: readonly string[],
  election: CandidateCsvConfig,
): boolean {
  const state = readCell(index, row, 'SG_UF').toUpperCase()
  const office = readCell(index, row, 'DS_CARGO').toUpperCase()

  if (state !== election.state.toUpperCase()) return false
  if (office !== election.office.toUpperCase()) return false

  // Quando o arquivo cobre várias eleições (ex.: ano de 2026 em diversos
  // cargos), valida também a referência ao ano na DS_ELEICAO.
  const electionYear = String(election.election)
  if (TSE_COLUMNS.election.some((c) => index.has(c.toUpperCase()))) {
    const described = readCell(index, row, TSE_COLUMNS.election[0])
    if (described !== '' && !described.includes(electionYear)) return false
  }

  return true
}

/** Linha crua com as células mapeadas para os campos do modelo. */
export interface RawCandidateRow {
  sequence: string
  ballotNumber: string
  fullName: string
  ballotName: string
  partyAcronym: string
  party: string
  coalition: string
  status: string
  campaignStatus: string
  candidacyType: string
  occupation: string
  education: string
  birthDate: string
  gender: string
  race: string
  nationality: string
  /** Município de domicílio eleitoral, ou '' quando o TSE não informa. */
  city: string
  email: string
  maritalStatus: string
  birthState: string
  federation: string
}

export function mapRawRow(index: Map<string, number>, row: readonly string[]): RawCandidateRow {
  const name = (field: TseField): string => {
    const column = TSE_COLUMNS[field][0]
    return readCell(index, row, column)
  }

  return {
    sequence: name('sequence'),
    ballotNumber: name('ballotNumber'),
    fullName: name('fullName'),
    ballotName: name('ballotName'),
    partyAcronym: name('partyAcronym'),
    party: name('party'),
    coalition: name('coalition'),
    status: name('status'),
    campaignStatus: name('campaignStatus'),
    candidacyType: name('candidacyType'),
    occupation: name('occupation'),
    education: name('education'),
    birthDate: name('birthDate'),
    gender: name('gender'),
    race: name('race'),
    nationality: name('nationality'),
    city: electoralMunicipality(index, row),
    email: name('email'),
    maritalStatus: name('maritalStatus'),
    birthState: name('birthState'),
    federation: name('federation'),
  }
}

/**
 * Município de domicílio eleitoral, ou string vazia quando o TSE não diz.
 *
 * `NM_UE` (unidade eleitoral) não é sempre município. Em 2004-2024 ela traz o
 * município (`SG_UE` = código do município, `NM_UE` = "LARANJEIRAS DO SUL");
 * no arquivo de 2026 ela traz a unidade da eleição, que para Deputado Federal é
 * o próprio estado (`SG_UE` = "PR", `NM_UE` = "PARANÁ"). Escrever "PARANÁ" no
 * campo município faria a ficha afirmar que 428 candidatos nasceram/eleitaram na
 * cidade de Paraná, que não existe.
 *
 * O sinal é `SG_UE === SG_UF`: quando a unidade eleitoral é igual à UF, ela não
 * é município. Não há coluna de município de domicílio no arquivo de 2026, então
 * a resposta honesta é não informar.
 */
function electoralMunicipality(index: Map<string, number>, row: readonly string[]): string {
  const unit = readCell(index, row, 'SG_UE').toUpperCase()
  const state = readCell(index, row, 'SG_UF').toUpperCase()
  if (unit !== '' && unit === state) return ''
  return readCell(index, row, 'NM_UE')
}

/** Lista de colunas obrigatórias para cadastrar candidatos. */
export const REQUIRED_HEADERS = [
  'SG_UF',
  'DS_CARGO',
  'SQ_CANDIDATO',
  'NR_CANDIDATO',
  'NM_CANDIDATO',
  'NM_URNA_CANDIDATO',
  'SG_PARTIDO',
] as const

export function missingRequiredHeaders(headers: readonly string[]): string[] {
  const index = buildHeaderIndex(headers)
  return REQUIRED_HEADERS.filter((header) => !index.has(header.toUpperCase()))
}

/** Relatório de inspeção do schema do arquivo baixado. */
export function inspectCsv(
  headers: readonly string[],
  rows: readonly string[][],
  separator: string,
  encoding: string,
): string {
  const missing = missingRequiredHeaders(headers)
  const lines: string[] = []

  lines.push('# Schema observado no arquivo do TSE')
  lines.push('')
  lines.push(`- Encoding detectado: \`${encoding}\``)
  lines.push(`- Separador: \`${separator}\``)
  lines.push(`- Linhas de dados: ${rows.length}`)
  lines.push(`- Colunas: ${headers.length}`)
  lines.push(`- Colunas obrigatórias ausentes: ${missing.length === 0 ? 'nenhuma' : missing.join(', ')}`)
  lines.push('')

  if (headers.length > 0) {
    lines.push('## Colunas')
    lines.push('')
    lines.push('| # | Coluna | Nulos na amostra |')
    lines.push('|---|--------|------------------|')
    for (let i = 0; i < headers.length; i++) {
      let nulls = 0
      for (let r = 0; r < Math.min(rows.length, 200); r++) {
        if ((rows[r][i] ?? '').trim() === '') nulls++
      }
      lines.push(`| ${i} | ${headers[i]} | ${nulls} |`)
    }
  }

  if (rows.length > 0) {
    lines.push('')
    lines.push('## Amostra (primeira linha)')
    lines.push('')
    lines.push('```')
    lines.push(JSON.stringify(rows[0], null, 2))
    lines.push('```')
  }

  return lines.join('\n')
}

export { buildHeaderIndex }

export function electionConfigFrom(election: ElectionConfig): CandidateCsvConfig {
  return {
    election: String(election.year),
    state: election.state,
    office: election.office,
  }
}