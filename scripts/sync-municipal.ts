/**
 * Lê os mandatos e o cadastro de vereadores das Câmaras com SAPL verificado e
 * grava em `municipal_mandates` + `municipal_identities`.
 *
 * O que entra no banco é sempre o que a Câmara publicou, com a fonte guardada.
 * O que **não** entra:
 *
 * - nome adivinhado ou vínculo forçado entre candidato e vereador;
 * - "não exerceu mandato" derivado de não constar na API — ausência de dado
 *   não é fato negativo;
 * - capacidade declarada para uma Câmara que não respondeu.
 *
 * Os vínculos ficam com `matchingStatus` explícito. `probable` (nome idêntico
 * + município + período) é o máximo alcançável sem `sq_candidato` vindo da
 * Câmara, e a ficha precisa dizer "provável" quando mostrar.
 *
 * Execução: npm run sync:municipal [-- --dry-run] [-- --only <município>]
 */

import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import {
  openRepository,
  replaceMunicipalIdentities,
  replaceMunicipalMandates,
  listCandidates,
  getPoliticalMandates,
} from '../src/data-sources/repository.ts'
import { defaultDataDir } from '../src/data-sources/tse/candidates.ts'
import { MunicipalHttpClient, type MunicipalOperationLog } from '../src/data-sources/municipal/http.ts'
import { listSapableChambers } from '../src/data-sources/municipal/registry.ts'
import { SaplMunicipalSource } from '../src/data-sources/municipal/sapl/source.ts'
import {
  resolveChamberIdentities,
  type MunicipalIdentityCandidate,
  type MunicipalIdentitySourcePerson,
} from '../src/data-sources/municipal/identity.ts'
import { normalizeMunicipalityName } from '../src/data-sources/municipal/ibge.ts'
import type {
  MunicipalChamberSource,
  MunicipalLegislatorIdentity,
  MunicipalMandate,
  MunicipalSourceRef,
} from '../src/data-sources/municipal/types.ts'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const onlyIndex = args.indexOf('--only')
const onlyMunicipality = onlyIndex === -1 ? null : (args[onlyIndex + 1] ?? null)

const RETRIEVED_AT = new Date().toISOString().slice(0, 10)

function log(entry: MunicipalOperationLog): void {
  const status = entry.success ? 'ok' : 'falha'
  const extra = entry.error ? ` (${entry.error})` : ''
  console.log(
    `[municipal] ${entry.municipality} ${entry.operation}: ${status} ` +
      `${entry.items} itens em ${entry.durationMs}ms${extra}`,
  )
}

function sourceRef(chamber: MunicipalChamberSource): MunicipalSourceRef {
  return {
    id: `pr:${chamber.municipalityIbgeCode}`,
    title: `SAPL — ${chamber.chamberName}`,
    url: chamber.apiBaseUrl ?? chamber.chamberUrl ?? '',
    publisher: chamber.chamberName,
    sourceType: 'official-api',
    publishedAt: null,
    retrievedAt: RETRIEVED_AT,
  }
}

/**
 * Candidatos-vereador do TSE registrados neste município.
 *
 * Um mesmo candidato pode aparecer em anos diferentes; a linha mais
 * antiga é a que tem o ano de eleição mais confiável para checar o período.
 */
function tseCandidatesFor(
  db: DatabaseSync,
  ibgeCode: string,
  municipalityName: string,
): MunicipalIdentityCandidate[] {
  const target = normalizeMunicipalityName(municipalityName)
  const earliestByCandidate = new Map<string, MunicipalIdentityCandidate>()

  for (const candidate of listCandidates(db, {
    electionYear: 2026,
    state: 'PR',
    office: 'DEPUTADO FEDERAL',
  })) {
    for (const mandate of getPoliticalMandates(db, candidate.id)) {
      if (!/VEREADOR/.test(mandate.cargo)) continue
      if (mandate.municipio === null) continue
      if (normalizeMunicipalityName(mandate.municipio) !== target) continue

      const previous = earliestByCandidate.get(candidate.id)
      if (previous !== undefined) {
        if (previous.electionYear !== null && mandate.ano < previous.electionYear) {
          earliestByCandidate.set(candidate.id, {
            candidateId: candidate.id,
            fullName: candidate.fullName,
            municipalityIbgeCode: ibgeCode,
            electionYear: mandate.ano,
            sqCandidato: mandate.sqCandidato,
          })
        }
        continue
      }
      earliestByCandidate.set(candidate.id, {
        candidateId: candidate.id,
        fullName: candidate.fullName,
        municipalityIbgeCode: ibgeCode,
        electionYear: mandate.ano,
        sqCandidato: mandate.sqCandidato,
      })
    }
  }

  return [...earliestByCandidate.values()]
}

const chambers = listSapableChambers().filter(
  (chamber) =>
    onlyMunicipality === null ||
    normalizeMunicipalityName(chamber.municipalityName) ===
      normalizeMunicipalityName(onlyMunicipality),
)

if (onlyMunicipality !== null && chambers.length === 0) {
  console.error(`[municipal] nenhuma câmara SAPL verificada para "${onlyMunicipality}"`)
  process.exit(1)
}

console.log(
  `[municipal] ${chambers.length} câmaras SAPL` +
    (dryRun ? ' (dry-run: nada será gravado)' : ''),
)

const db = await openRepository(join(defaultDataDir(), 'tse.db'))

// Servidores de Câmara derrubam conexão sem aviso, e o pool de conexões do Node
// satura se as 22 câmaras forem lidas em sequência rápida: depois de algumas
// páginas, todo host seguinte devolve "fetch failed" e a execução perde quase
// tudo. Uma reqisição por vez, com 1s entre elas, dá conta do caso comum sem
// parecer abuso — e o `replace*` por fonte preserva o que foi lido antes.
const http = new MunicipalHttpClient({
  log,
  timeoutMs: 60_000,
  retries: 3,
  backoffMs: 2_000,
  minIntervalMs: 1000,
  concurrency: 1,
})

const identidades: MunicipalLegislatorIdentity[] = []
const mandatos: MunicipalMandate[] = []
let falhas = 0

try {
  for (const chamber of chambers) {
    const source = new SaplMunicipalSource({
      chamber,
      http,
      source: sourceRef(chamber),
    })

    try {
      const [cadastros, listaMandatos] = await Promise.all([
        source.findLegislators(),
        source.listMandates(),
      ])

      const candidates = tseCandidatesFor(
        db,
        chamber.municipalityIbgeCode,
        chamber.municipalityName,
      )

      // Início do mandato mais antigo de cada pessoa: é o dado que permite
      // recusar um vínculo cujo período não bate com a eleição. Vem da lista
      // de mandatos já lida, sem uma requisição por legislator.
      const inicioPorPessoa = source.mandateStartsByPerson(listaMandatos)

      const persons: MunicipalIdentitySourcePerson[] = cadastros.map((legislator) => ({
        ...legislator,
        mandateStartDate: inicioPorPessoa.get(legislator.sourcePersonId) ?? null,
        // O SAPL não publica o número de candidato do TSE: fica null, e o
        // matcher nunca promove um vínculo a "confirmed" sem este campo.
        sqCandidato: null,
      }))

      const resolved = resolveChamberIdentities(
        candidates,
        persons,
        sourceRef(chamber).id,
        RETRIEVED_AT,
      )

      identidades.push(...resolved)
      mandatos.push(...listaMandatos)

      const confirmados = resolved.filter((i) => i.matchingStatus === 'confirmed').length
      const provaveis = resolved.filter((i) => i.matchingStatus === 'probable').length
      const naoResolvidos = resolved.filter((i) => i.matchingStatus === 'unresolved').length
      console.log(
        `[municipal] ${chamber.municipalityName}: ${listaMandatos.length} mandatos, ` +
          `${cadastros.length} cadastros, ${candidates.length} candidatos do TSE ` +
          `(${confirmados} confirmados, ${provaveis} prováveis, ${naoResolvidos} não resolvidos)`,
      )
    } catch (error) {
      falhas++
      console.log(
        `[municipal] ${chamber.municipalityName}: ignorada — ` +
          (error instanceof Error ? error.message : String(error)),
      )
    }
  }

  console.log(
    `[municipal] total: ${mandatos.length} mandatos, ${identidades.length} vínculos, ` +
      `${falhas} câmaras sem leitura`,
  )

  if (!dryRun) {
    replaceMunicipalIdentities(db, identidades)
    replaceMunicipalMandates(db, mandatos)
    console.log('[municipal] gravado em municipal_identities e municipal_mandates')
  }
} finally {
  db.close()
}
