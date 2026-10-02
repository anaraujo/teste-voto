/**
 * Dataset de bens declarados (bem_candidato_2026.zip).
 *
 * O arquivo tem uma linha por bem declarado (VR_BEM_CANDIDATO em R$, com
 * separador vírgula). A soma por candidato (SQ_CANDIDATO) alimenta o campo
 * `totalAssets`, exibido como "bens declarados".
 */

import type { ElectionConfig } from '../../shared/elections.ts'
import type { Source } from '../../shared/domain.ts'
import { loadDescriptorCsv } from './candidates.ts'
import { buildHeaderIndex, readCell } from './csv.ts'
import { parseMoney } from './normalize.ts'

export interface CandidateAssets {
  tseSequence: string
  /** Soma dos bens declarados (R$). Null quando não há declaração no arquivo. */
  totalAssets: number | null
}

export interface AssetsFetchResult {
  items: CandidateAssets[]
  source: Source
}

export async function fetchCandidateAssets(
  election: ElectionConfig,
  options: { dataDir?: string; force?: boolean } = {},
): Promise<AssetsFetchResult> {
  const descriptor = election.datasets.assets
  const { csv, sourceFile } = await loadDescriptorCsv(descriptor, options)
  const index = buildHeaderIndex(csv.headers)

  const sums = new Map<string, number>()
  for (const row of csv.rows) {
    const sequence = readCell(index, row, 'SQ_CANDIDATO').trim()
    if (sequence === '') continue
    const value = parseMoney(readCell(index, row, 'VR_BEM_CANDIDATO'))
    if (value === null) continue
    sums.set(sequence, (sums.get(sequence) ?? 0) + value)
  }

  const items: CandidateAssets[] = []
  for (const [tseSequence, totalAssets] of sums) {
    items.push({ tseSequence, totalAssets })
  }

  return {
    items,
    source: {
      provider: 'TSE',
      url: descriptor.url,
      dataset: descriptor.dataset,
      sourceFile,
      retrievedAt: new Date().toISOString(),
      sourceUpdatedAt: null,
    },
  }
}
