/**
 * Grava o registro das Câmaras Municipais em `municipal_chambers`.
 *
 * A fonte deste script é `registry.seed.ts`, que é dado verificado à mão —
 * nenhuma URL é adivinhada aqui. Rodar o script é idempotente: ele substitui
 * a tabela inteira pelo conteúdo do seed.
 *
 * Por que um script para algo que já está no código: para que o banco gravado
 * seja conferível contra um arquivo versionado, e para registrar a data da
 * última verificação em um lugar consultável.
 *
 * Execução: npm run sync:municipal-registry
 */

import { join } from 'node:path'
import {
  openRepository,
  replaceMunicipalChambers,
  listMunicipalChambers,
} from '../src/data-sources/repository.ts'
import { listChamberSources } from '../src/data-sources/municipal/registry.ts'
import { defaultDataDir } from '../src/data-sources/tse/candidates.ts'

const chambers = listChamberSources()

const porAccesso = new Map<string, number>()
for (const chamber of chambers) {
  porAccesso.set(chamber.access, (porAccesso.get(chamber.access) ?? 0) + 1)
}

const db = await openRepository(join(defaultDataDir(), 'tse.db'))
try {
  replaceMunicipalChambers(db, chambers)
  const gravadas = listMunicipalChambers(db)
  console.log(`[municipal] ${gravadas.length} câmaras gravadas`)
  for (const [access, total] of [...porAccesso].sort()) {
    console.log(`[municipal]   ${access}: ${total}`)
  }
  const semFonte = chambers.filter((c) => c.access !== 'verified')
  if (semFonte.length > 0) {
    console.log(
      `[municipal] ${semFonte.length} câmaras sem API acessível; a ficha vai ` +
        'explicar a ausência em vez de afirmar que não houve mandato',
    )
  }
} finally {
  db.close()
}
