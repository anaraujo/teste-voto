/**
 * Sincroniza a identificação de incumbentes (deputados federais em
 * exercício) usando a API de Dados Abertos da Câmara.
 *
 * Casamento por nome normalizado com os candidatos ingeridos do TSE.
 * Sem a rede disponível, reutiliza o cache local de data/camara/.
 *
 * Execução: node --experimental-sqlite --experimental-strip-types
 *   scripts/sync-incumbents.ts [--force]
 */

import { join } from 'node:path'
import {
  openRepository,
  listCandidates,
  replaceIncumbents,
} from '../src/data-sources/repository.ts'
import { defaultDataDir } from '../src/data-sources/tse/candidates.ts'
import { fetchCamaraDeputados } from '../src/data-sources/camara/deputados.ts'
import { matchIncumbents } from '../src/data-sources/camara/identity.ts'
import { CURRENT_ELECTION } from '../src/shared/elections.ts'

const DATA_DIR = defaultDataDir()
const force = process.argv.includes('--force')

const filter = {
  electionYear: CURRENT_ELECTION.year,
  state: CURRENT_ELECTION.state,
  office: CURRENT_ELECTION.office,
}

const db = await openRepository(join(DATA_DIR, 'tse.db'))

try {
  const candidates = listCandidates(db, filter)
  const { items: deputies, fromCache } = await fetchCamaraDeputados({
    dataDir: DATA_DIR,
    force,
  })
  const result = matchIncumbents(candidates, deputies)

  replaceIncumbents(
    db,
    result.matches.map((m) => ({ ...m })),
  )

  console.log(
    `[incumbents] ${deputies.length} deputados PR (${fromCache ? 'cache' : 'api'}), ` +
      `casa com ${result.matchedCount}/${candidates.length} candidatos`,
  )
  if (result.unmatchedDeputies.length > 0) {
    console.log(
      `[incumbents] sem candidato correspondente: ${result.unmatchedDeputies
        .map((d) => d.nome)
        .join(' | ')}`,
    )
  }
} finally {
  db.close()
}
