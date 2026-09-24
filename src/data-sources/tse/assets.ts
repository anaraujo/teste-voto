/**
 * Dataset de bens declarados (bem_candidato_2026.zip).
 *
 * Stub tipado: a interface já reflete o contrato da oferta futura e a
 * proveniência vem do ZIP oficial. Substituir o corpo na próxima rodada
 * (o ZIP de bens não é a fonte primária atual de "total de bens" da tela
 * de lista, então este módulo ainda não é usado pela ingestão principal).
 */

import type { ElectionConfig } from '../../shared/elections.ts'
import type { Source } from '../../shared/domain.ts'

export interface CandidateAssets {
  candidateId: string
  tseSequence: string
  /** Soma dos bens declarados (R$). */
  totalAssets: number | null
  source: Source
}

export interface AssetsFetchResult {
  items: CandidateAssets[]
  implemented: false
  source: Source
}

export async function fetchCandidateAssets(
  election: ElectionConfig,
): Promise<AssetsFetchResult> {
  const descriptor = election.datasets.assets
  return {
    items: [],
    implemented: false,
    source: {
      provider: 'TSE',
      url: descriptor.url,
      dataset: descriptor.dataset,
      sourceFile: null,
      retrievedAt: new Date().toISOString(),
      sourceUpdatedAt: null,
    },
  }
}