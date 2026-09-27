/**
 * Sincroniza o histórico de posições políticas ocupadas (eleitos + suplentes)
 * dos 428 candidatos a deputado federal pelo Paraná (2026).
 *
 * Fonte: dados abertos do TSE, consultas de candidatos das eleições de
 * 2004 a 2024 (todas as posições: vereador, prefeito, vice-prefeito,
 * deputado estadual/federal, senador, governador, vice-governador e
 * suplentes de senador). Os arquivos são baixados com cache em
 * data/download e casados por nome normalizado + data de nascimento.
 *
 * Execução: node --experimental-sqlite --experimental-strip-types
 *   scripts/sync-history.ts
 */

import { join } from 'node:path'
import { openRepository, listCandidates, replacePoliticalMandates } from '../src/data-sources/repository.ts'
import { defaultDataDir } from '../src/data-sources/tse/candidates.ts'
import {
  HISTORIC_ELECTIONS,
  fetchHistoricCandidaturas,
  matchHistoricToCandidates,
  sortMandates,
  type PoliticalMandate,
} from '../src/data-sources/tse/history.ts'
import { CURRENT_ELECTION } from '../src/shared/elections.ts'

const DATA_DIR = defaultDataDir()

const filter = {
  electionYear: CURRENT_ELECTION.year,
  state: CURRENT_ELECTION.state,
  office: CURRENT_ELECTION.office,
}

const db = await openRepository(join(DATA_DIR, 'tse.db'))

try {
  const candidates = listCandidates(db, filter)
  const mandates: PoliticalMandate[] = []
  let totalRows = 0

  for (const election of HISTORIC_ELECTIONS) {
    const { rows, erro } = await fetchHistoricCandidaturas(election.ano, DATA_DIR)
    if (erro) {
      console.log(`[historico] ${election.ano}: ignorado (${erro})`)
      continue
    }
    totalRows += rows.length
    const matched = matchHistoricToCandidates(rows, candidates)
    mandates.push(...matched)
    const eleitos = matched.filter((m) => m.status === 'eleito').length
    const suplentes = matched.length - eleitos
    console.log(
      `[historico] ${election.ano}: ${rows.length} candidaturas PR lidas, ` +
        `${matched.length} mandatos (${eleitos} eleitos, ${suplentes} suplentes)`,
    )
  }

  const finalMandates = sortMandates(mandates)
  const withMandate = new Set(finalMandates.map((m) => m.candidateId)).size
  replacePoliticalMandates(db, finalMandates)

  const cargos = new Map<string, number>()
  for (const m of finalMandates) {
    cargos.set(m.cargo, (cargos.get(m.cargo) ?? 0) + 1)
  }
  const resumoCargos = [...cargos.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([cargo, count]) => `${cargo}: ${count}`)
    .join(' | ')

  console.log(
    `[historico] gravados ${finalMandates.length} mandatos para ${withMandate}/428 candidatos ` +
      `(${totalRows} candidaturas lidas no total)`,
  )
  console.log(`[historico] por cargo: ${resumoCargos}`)
} finally {
  db.close()
}