/**
 * Dataset de histórico de candidaturas (consulta complementar / turnos
 * anteriores). Stub tipado: a proveniência vem do ZIP da consulta;
 * preencher a análise de histórico eleitoral na próxima rodada.
 */

import type { ElectionConfig } from '../../shared/elections.ts'
import type { Source } from '../../shared/domain.ts'

export interface ElectoralHistoryEntry {
  electionYear: number
  state: string
  office: string
  status: string | null
  source: Source
}

export interface CandidateHistory {
  tseSequence: string
  entries: ElectoralHistoryEntry[]
  source: Source
}

export interface HistoryFetchResult {
  items: CandidateHistory[]
  implemented: false
  source: Source
}

export async function fetchCandidateHistory(
  election: ElectionConfig,
): Promise<HistoryFetchResult> {
  const descriptor = election.datasets.history
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