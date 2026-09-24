/**
 * Dataset de redes sociais (rede_social_candidato_2026.zip).
 *
 * Stub tipado: contrato pronto para preencher na próxima rodada.
 * Quando implementado, alimentará `candidate.socialLinks`.
 */

import type { ElectionConfig } from '../../shared/elections.ts'
import type { Source } from '../../shared/domain.ts'

export interface CandidateSocialLinks {
  tseSequence: string
  socialLinks: string[]
  source: Source
}

export interface SocialFetchResult {
  items: CandidateSocialLinks[]
  implemented: false
  source: Source
}

export async function fetchCandidateSocialLinks(
  election: ElectionConfig,
): Promise<SocialFetchResult> {
  const descriptor = election.datasets.social
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