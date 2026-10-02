/**
 * Dataset complementar de candidatos (consulta_cand_complementar_2026.zip).
 *
 * É um segundo arquivo do TSE para a mesma eleição, unido à candidatura pelo
 * SQ_CANDIDATO. Junto com o perfil, traz apenas dados de cadastro/identificação
 * e o teto de gastos: NÃO inclui o resultado do pleito (colunas de situação no
 * pleito/total, diploma e julgamento são ignoradas nesta rodada, por decisão
 * documentada em docs/how-it-works.md).
 */

import type { ElectionConfig } from '../../shared/elections.ts'
import type { Source } from '../../shared/domain.ts'
import { loadDescriptorCsv } from './candidates.ts'
import { buildHeaderIndex, type ParsedCsv, readCell } from './csv.ts'
import { clean } from './normalize.ts'

export interface ComplementarySummary {
  tseSequence: string
  birthMunicipality: string | null
  quilombola: boolean | null
  indigenousEthnicity: string | null
  inBallot: boolean | null
  substituted: boolean | null
  accountsDeclared: boolean | null
  assetsDeclared: boolean | null
  isReelection: boolean | null
  campaignSpendingCap: number | null
}

export interface ComplementaryFetchResult {
  items: ComplementarySummary[]
  source: Source
}

function toBoolean(value: string): boolean | null {
  const code = value.trim().toUpperCase()
  if (code === 'S' || code === 'SIM') return true
  if (code === 'N' || code === 'NÃO') return false
  return null
}

/** VR_DESPESA_MAX_CAMPAHAN usa ponto decimal ("3176572.53"). */
function parseDecimalDot(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

/** Sentinelas de DS_ETNIA_INDIGENA para "sem etnia informada". */
const INDIGENOUS_SENTINELS = new Set([
  'NÃO INFORMADA',
  'NÃO INFORMADO',
  '#NE',
  '#NULO',
])

function cleanIndigenous(value: string): string | null {
  const trimmed = value.trim()
  if (trimmed === '' || INDIGENOUS_SENTINELS.has(trimmed.toUpperCase()))
    return null
  return clean(trimmed)
}

const REQUIRED_COMPLEMENTAR_HEADERS = ['SQ_CANDIDATO'] as const

/** Mapeia o CSV complementar para resumos por SQ_CANDIDATO (função pura). */
export function mapComplementaryCsv(csv: ParsedCsv): ComplementarySummary[] {
  const index = buildHeaderIndex(csv.headers)
  const items: ComplementarySummary[] = []
  for (const row of csv.rows) {
    const sequence = readCell(index, row, 'SQ_CANDIDATO').trim()
    if (sequence === '') continue

    items.push({
      tseSequence: sequence,
      birthMunicipality: clean(readCell(index, row, 'NM_MUNICIPIO_NASCIMENTO')),
      quilombola: toBoolean(readCell(index, row, 'ST_QUILOMBOLA')),
      indigenousEthnicity: cleanIndigenous(
        readCell(index, row, 'DS_ETNIA_INDIGENA'),
      ),
      inBallot: toBoolean(readCell(index, row, 'ST_CANDIDATO_INSERIDO_URNA')),
      substituted: toBoolean(readCell(index, row, 'ST_SUBSTITUIDO')),
      accountsDeclared: toBoolean(readCell(index, row, 'ST_PREST_CONTAS')),
      assetsDeclared: toBoolean(readCell(index, row, 'ST_DECLARAR_BENS')),
      isReelection: toBoolean(readCell(index, row, 'ST_REELEICAO')),
      campaignSpendingCap: parseDecimalDot(
        readCell(index, row, 'VR_DESPESA_MAX_CAMPANHA'),
      ),
    })
  }
  return items
}

export async function fetchComplementary(
  election: ElectionConfig,
  options: { dataDir?: string; force?: boolean } = {},
): Promise<ComplementaryFetchResult> {
  const descriptor = election.datasets.complementar
  const { csv, sourceFile, retrieved } = await readCsv(election, options)
  const index = buildHeaderIndex(csv.headers)

  const missing = REQUIRED_COMPLEMENTAR_HEADERS.filter((h) => !index.has(h))
  if (missing.length > 0) {
    throw new Error(
      `colunas obrigatórias ausentes no complementar: ${missing.join(', ')}`,
    )
  }

  return {
    items: mapComplementaryCsv(csv),
    source: {
      provider: 'TSE',
      url: descriptor.url,
      dataset: descriptor.dataset,
      sourceFile,
      retrievedAt: retrieved,
      sourceUpdatedAt: null,
    },
  }
}

async function readCsv(
  election: ElectionConfig,
  options: { dataDir?: string; force?: boolean },
): Promise<{ csv: ParsedCsv; sourceFile: string; retrieved: string }> {
  const { csv, sourceFile } = await loadDescriptorCsv(
    election.datasets.complementar,
    options,
  )
  return { csv, sourceFile, retrieved: new Date().toISOString() }
}
