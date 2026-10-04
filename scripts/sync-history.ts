/**
 * Sincroniza o histórico de posições políticas ocupadas (eleitos + suplentes)
 * de todos os candidatos a deputado federal e estadual (distrital no DF) de
 * todas as UFs (2026).
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
import {
  openRepository,
  listCandidates,
  replacePoliticalMandates,
} from '../src/data-sources/repository.ts'
import { defaultDataDir } from '../src/data-sources/tse/candidates.ts'
import {
  HISTORIC_ELECTIONS,
  fetchHistoricCandidaturas,
  matchHistoricToCandidates,
  sortMandates,
  type PoliticalMandate,
} from '../src/data-sources/tse/history.ts'
import {
  FEDERATION_UNITS,
  OFFICE_KINDS,
  officeFor,
} from '../src/shared/elections.ts'

const DATA_DIR = defaultDataDir()
const YEAR = 2026

const db = await openRepository(join(DATA_DIR, 'tse.db'))

try {
  // Todos os candidatos ativos de 2026: as 27 UFs, nos dois cargos.
  const candidates = []
  for (const uf of FEDERATION_UNITS) {
    for (const kind of OFFICE_KINDS) {
      candidates.push(
        ...listCandidates(db, {
          electionYear: YEAR,
          state: uf,
          office: officeFor(uf, kind),
        }),
      )
    }
  }

  const mandates: PoliticalMandate[] = []
  let totalRows = 0
  let totalMatched = 0

  for (const election of HISTORIC_ELECTIONS) {
    const { rows, erro } = await fetchHistoricCandidaturas(
      election.ano,
      DATA_DIR,
    )
    if (erro) {
      console.log(`[historico] ${election.ano}: ignorado (${erro})`)
      continue
    }
    totalRows += rows.length
    const matched = matchHistoricToCandidates(rows, candidates)
    mandates.push(...matched)
    totalMatched += matched.length
    const eleitos = matched.filter((m) => m.status === 'eleito').length
    console.log(
      `[historico] ${election.ano}: ${rows.length} candidaturas lidas, ` +
        `${matched.length} mandatos (${eleitos} eleitos, ${matched.length - eleitos} suplentes)`,
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
    `[historico] gravados ${finalMandates.length} mandatos para ${withMandate}/${candidates.length} candidatos ` +
      `(${totalRows} candidaturas lidas no total)`,
  )
  console.log(`[historico] por cargo: ${resumoCargos}`)
} finally {
  db.close()
}
