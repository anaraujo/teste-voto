/**
 * Gera a ficha editorial (content/editorial/<id>.json) para os candidatos
 * que ainda não têm arquivo. Nunca sobrescreve conteúdo já editado.
 *
 * As fichas nascem com todos os campos em "não encontrei evidência" — os
 * fatos oficiais (TSE, Câmara, Senado) ficam no banco, não aqui.
 *
 * Execução: node --experimental-strip-types scripts/editorial-templates.ts
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  openRepository,
  listCandidates,
} from '../src/data-sources/repository.ts'
import { defaultDataDir } from '../src/data-sources/tse/candidates.ts'
import { EDITORIAL_DIR } from '../src/data-sources/parliament/editorial.ts'
import { emptyEditorialFicha } from '../src/shared/ficha.ts'
import { CURRENT_ELECTION } from '../src/shared/elections.ts'

const DATA_DIR = defaultDataDir()
const filter = {
  electionYear: CURRENT_ELECTION.year,
  state: CURRENT_ELECTION.state,
  office: CURRENT_ELECTION.office,
}

await mkdir(EDITORIAL_DIR, { recursive: true })

const db = await openRepository(join(DATA_DIR, 'tse.db'))
let created = 0
let skipped = 0

try {
  const candidates = listCandidates(db, filter)
  for (const candidate of candidates) {
    const target = join(EDITORIAL_DIR, `${candidate.id}.json`)
    if (existsSync(target)) {
      skipped += 1
      continue
    }
    const ficha = emptyEditorialFicha()
    await writeFile(target, `${JSON.stringify(ficha, null, 2)}\n`, 'utf8')
    created += 1
  }
  console.log(
    `[editorial] criados ${created}, já existentes ${skipped} (total ${candidates.length})`,
  )
} finally {
  db.close()
}
