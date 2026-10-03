/**
 * Sincroniza a prestação de contas eleitorais de candidatos (receitas e
 * despesas contratadas) para todos os candidatos ativos de 2026, de todas as
 * UFs, nos dois cargos.
 *
 * Fonte: TSE, dataset `prestacao-de-contas-eleitorais-candidatos` (SPCE),
 * um ZIP nacional com um arquivo por UF. O casamento com o candidato é pelo
 * `SQ_CANDIDATO` (mesma chave da `consulta_cand`).
 *
 * Execução: node --experimental-sqlite --experimental-strip-types
 *   scripts/sync-finance.ts
 */

import { join } from 'node:path'
import {
  listCandidates,
  openRepository,
  replaceCampaignFinance,
  type CampaignDespesaRow,
  type CampaignReceitaRow,
} from '../src/data-sources/repository.ts'
import { defaultDataDir } from '../src/data-sources/tse/candidates.ts'
import { fetchCampaignFinance } from '../src/data-sources/tse/finance.ts'
import {
  FEDERATION_UNITS,
  electionFor,
  officeFor,
} from '../src/shared/elections.ts'
import type { Source } from '../src/shared/domain.ts'

const DATA_DIR = defaultDataDir()
const OFFICES = ['federal', 'estadual'] as const

const db = await openRepository(join(DATA_DIR, 'tse.db'))

try {
  // Mapa SQ_CANDIDATO -> candidate_id, de todos os candidatos ativos.
  const seqToId = new Map<string, string>()
  for (const uf of FEDERATION_UNITS) {
    for (const kind of OFFICES) {
      const election = electionFor(uf, officeFor(uf, kind))
      for (const candidate of listCandidates(db, {
        electionYear: election.year,
        state: election.state,
        office: election.office,
      })) {
        seqToId.set(candidate.tseSequence, candidate.id)
      }
    }
  }

  const finance = electionFor('PR').datasets.finance
  const receitas: CampaignReceitaRow[] = []
  const despesas: CampaignDespesaRow[] = []
  let rowsRead = 0
  let receitasMatched = 0
  let despesasMatched = 0

  for (const uf of FEDERATION_UNITS) {
    const result = await fetchCampaignFinance(finance, uf, {
      dataDir: DATA_DIR,
    })
    rowsRead += result.rowsRead

    const receitaSource: Source = {
      provider: 'TSE',
      url: finance.url,
      dataset: finance.dataset,
      sourceFile: result.sourceFileReceitas,
      retrievedAt: result.retrievedAt,
      sourceUpdatedAt: null,
    }
    for (const receita of result.receitas) {
      const candidateId = seqToId.get(receita.sqCandidato)
      if (!candidateId) continue
      receitasMatched++
      receitas.push({
        candidateId,
        doador: receita.doador,
        doadorDocumento: receita.doadorDocumento,
        fonte: receita.fonte,
        origem: receita.origem,
        especie: receita.especie,
        data: receita.data,
        valor: receita.valor,
        source: receitaSource,
      })
    }

    const despesaSource: Source = {
      provider: 'TSE',
      url: finance.url,
      dataset: finance.dataset,
      sourceFile: result.sourceFileDespesas,
      retrievedAt: result.retrievedAt,
      sourceUpdatedAt: null,
    }
    for (const despesa of result.despesas) {
      const candidateId = seqToId.get(despesa.sqCandidato)
      if (!candidateId) continue
      despesasMatched++
      despesas.push({
        candidateId,
        fornecedor: despesa.fornecedor,
        fornecedorDocumento: despesa.fornecedorDocumento,
        origem: despesa.origem,
        descricao: despesa.descricao,
        data: despesa.data,
        valor: despesa.valor,
        source: despesaSource,
      })
    }
  }

  replaceCampaignFinance(db, receitas, despesas)

  const comContas = new Set([
    ...receitas.map((r) => r.candidateId),
    ...despesas.map((d) => d.candidateId),
  ]).size
  console.log(
    `[finance] ${receitas.length} receitas e ${despesas.length} despesas ` +
      `gravadas para ${comContas} candidatos (${rowsRead} linhas lidas)`,
  )
} finally {
  db.close()
}
