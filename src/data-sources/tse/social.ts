/**
 * Dataset de redes sociais (rede_social_candidato_2026.zip).
 *
 * Uma linha por URL (DS_URL) por candidato (SQ_CANDIDATO). As URLs são
 * agrupadas e alimentam `candidate.socialLinks`.
 */

import type { ElectionConfig } from '../../shared/elections.ts'
import type { Source } from '../../shared/domain.ts'
import { loadDescriptorCsv } from './candidates.ts'
import { buildHeaderIndex, readCell } from './csv.ts'

export interface CandidateSocialLinks {
  tseSequence: string
  socialLinks: string[]
}

export interface SocialFetchResult {
  items: CandidateSocialLinks[]
  source: Source
}

export async function fetchCandidateSocialLinks(
  election: ElectionConfig,
  options: { dataDir?: string; force?: boolean } = {},
): Promise<SocialFetchResult> {
  const descriptor = election.datasets.social
  const { csv, sourceFile } = await loadDescriptorCsv(descriptor, options)
  const index = buildHeaderIndex(csv.headers)

  const byCandidate = new Map<string, string[]>()
  for (const row of csv.rows) {
    const sequence = readCell(index, row, 'SQ_CANDIDATO').trim()
    if (sequence === '') continue
    const url = readCell(index, row, 'DS_URL')
    if (url === '') continue
    const links = byCandidate.get(sequence) ?? []
    links.push(url)
    byCandidate.set(sequence, links)
  }

  const items: CandidateSocialLinks[] = []
  for (const [tseSequence, socialLinks] of byCandidate) {
    items.push({ tseSequence, socialLinks })
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
