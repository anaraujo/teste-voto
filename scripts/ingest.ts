/**
 * CLI de ingestão de dados do TSE.
 *
 * Uso:
 *   npm run ingest                # baixa, valida, normaliza e sincroniza
 *   npm run ingest -- --inspect   # documenta o schema observado (docs/tse-schema.md)
 *   npm run ingest -- --force     # rebaixa os arquivos mesmo se já existirem
 *
 * Execução: node --experimental-sqlite --experimental-strip-types scripts/ingest.ts
 */

import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { CandidateRecord } from '../src/shared/domain.ts'
import { candidateId } from '../src/shared/domain.ts'
import {
  CURRENT_ELECTION,
  FEDERATION_UNITS,
  electionFor,
  electionKey,
  isFederationUnit,
  type ElectionConfig,
} from '../src/shared/elections.ts'
import {
  fetchCandidates,
  type FetchOptions,
} from '../src/data-sources/tse/candidates.ts'
import { fetchComplementary } from '../src/data-sources/tse/complementar.ts'
import { fetchCandidateAssets } from '../src/data-sources/tse/assets.ts'
import { fetchCandidateSocialLinks } from '../src/data-sources/tse/social.ts'
import {
  applyAssets,
  applyComplementary,
  applySocialLinks,
} from '../src/data-sources/tse/enrich.ts'
import { inspectCsv } from '../src/data-sources/tse/schema.ts'
import { normalizeCandidate } from '../src/data-sources/tse/normalize.ts'
import {
  fetchCandidatePhotos,
  photoFileForSequence,
  photoPublicPath,
} from '../src/data-sources/tse/images.ts'
import {
  deactivateMissing,
  listCandidates,
  openRepository,
  setPhotoUrls,
  storeRaw,
  upsertCandidate,
  writeSyncLog,
} from '../src/data-sources/repository.ts'

const USAGE = `
Ingestão de dados do TSE

Uso:
  ingest [--inspect] [--force] [--states PR,SC]
  ingest --help

Opções:
  --inspect        Documenta o schema do CSV baixado em docs/tse-schema.md e termina.
  --force          Rebaixa os arquivos ZIP mesmo que já existam.
  --states A,B     Limita as UFs (siglas separadas por vírgula). Padrão: as 27.
  --help           Mostra esta ajuda.
`

interface CliOptions extends FetchOptions {
  inspect: boolean
  help: boolean
  /** null = todas as UFs. */
  states: string[] | null
}

function parseStateList(value: string): string[] {
  const codes = value
    .split(',')
    .map((part) => part.trim().toUpperCase())
    .filter((part) => part !== '')
  if (codes.length === 0) {
    console.error('informe ao menos uma UF em --states')
    process.exit(1)
  }
  for (const code of codes) {
    if (!isFederationUnit(code)) {
      console.error(`UF desconhecida: ${code}`)
      process.exit(1)
    }
  }
  return codes
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    inspect: false,
    help: false,
    force: false,
    states: null,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--inspect') options.inspect = true
    else if (arg === '--force') options.force = true
    else if (arg === '--help') options.help = true
    else if (arg === '--states') {
      const value = argv[++i]
      if (!value) {
        console.error('informe as UFs depois de --states')
        process.exit(1)
      }
      options.states = parseStateList(value)
    } else if (arg.startsWith('--states=')) {
      options.states = parseStateList(arg.slice('--states='.length))
    } else {
      console.error(`opção desconhecida: ${arg}`)
      console.error(USAGE)
      process.exit(1)
    }
  }
  return options
}

function log(message: string): void {
  console.log(`[ingest] ${message}`)
}

function logError(error: unknown): void {
  console.error(
    `[ingest] ${error instanceof Error ? error.message : String(error)}`,
  )
}

async function runInspect(
  election: ElectionConfig,
  options: FetchOptions,
): Promise<void> {
  log(
    `inspecionando arquivo de candidatos (${election.year}/${election.state}/${election.office})`,
  )

  const { csv, sourceFile } = await fetchCandidates(election, options)
  const report = inspectCsv(csv.headers, csv.rows, csv.separator, csv.encoding)

  const docsDir = join(process.cwd(), 'docs')
  await mkdir(docsDir, { recursive: true })
  const target = join(docsDir, 'tse-schema.md')
  const header = `<!-- Documento gerado automaticamente por \`npm run ingest -- --inspect\`. -->\n\n`
  await writeFile(target, header + report, 'utf8')

  log('encoding: ' + csv.encoding)
  log('separador: ' + csv.separator)
  log(`colunas: ${csv.headers.length}, linhas: ${csv.rows.length}`)
  log(`arquivo-fonte: ${sourceFile ?? '(direto do zip)'}`)
  log(`schema documentado em ${target}`)
}

function buildCandidate(
  election: ElectionConfig,
  normalized: Omit<
    CandidateRecord,
    'id' | 'source' | 'importedAt' | 'updatedAt'
  >,
  retrievedAt: string,
): CandidateRecord {
  const now = new Date().toISOString()
  const source = {
    provider: 'TSE',
    url: election.datasets.candidates.url,
    dataset: election.datasets.candidates.dataset,
    sourceFile: null,
    retrievedAt,
    sourceUpdatedAt: null,
  }

  return {
    id: candidateId(
      { electionYear: normalized.electionYear, state: normalized.state },
      normalized.tseSequence,
    ),
    ...normalized,
    source,
    importedAt: now,
    updatedAt: now,
  }
}

async function ingestElection(
  db: Awaited<ReturnType<typeof openRepository>>,
  election: ElectionConfig,
  options: FetchOptions,
): Promise<void> {
  const key = electionKey(election)

  log(
    `sincronizando candidatos ${election.year} ${election.state} - ${election.office}`,
  )

  let inserted = 0
  let updated = 0
  let unchanged = 0
  const activeIds: string[] = []
  let retrievedAt = ''
  let rowsRead = 0
  let rowsKept = 0
  let sourceFile: string | null = null
  let validator: string | null = null
  const errors: string[] = []

  try {
    const result = await fetchCandidates(election, options)
    retrievedAt = result.retrievedAt
    rowsRead = result.rowsRead
    rowsKept = result.rowsKept
    sourceFile = result.sourceFile
    validator = result.validator
    errors.push(...result.errors)

    log(`CSV: ${rowsRead} linhas lidas, ${rowsKept} mantidas para a eleição`)

    for (const item of result.rows) {
      const candidate = buildCandidate(
        election,
        normalizeCandidate(item.raw, {
          electionYear: election.year,
          state: election.state,
          office: election.office,
        }),
        retrievedAt,
      )
      const outcome = upsertCandidate(db, candidate)
      if (outcome.status === 'inserted') inserted++
      else if (outcome.status === 'updated') updated++
      else unchanged++

      storeRaw(db, candidate.id, item.original)
      activeIds.push(candidate.id)
    }

    const removed = deactivateMissing(
      db,
      {
        electionYear: election.year,
        state: election.state,
        office: election.office,
      },
      activeIds,
    )
    log(
      `candidatos: ${inserted} novos, ${updated} alterados, ${unchanged} iguais, ${removed} removidos`,
    )
  } catch (error) {
    writeSyncLog(db, {
      election: key,
      dataset: election.datasets.candidates.dataset,
      url: election.datasets.candidates.url,
      validator,
      sourceFile,
      retrievedAt: retrievedAt || new Date().toISOString(),
      rowsRead,
      rowsKept,
      rowsInserted: inserted,
      rowsUpdated: updated,
      rowsDeleted: 0,
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }

  writeSyncLog(db, {
    election: key,
    dataset: election.datasets.candidates.dataset,
    url: election.datasets.candidates.url,
    validator,
    sourceFile,
    retrievedAt,
    rowsRead,
    rowsKept,
    rowsInserted: inserted,
    rowsUpdated: updated,
    rowsDeleted: 0,
    status: 'success',
    error: null,
  })

  await syncComplementary(db, election, options)
  await syncAssets(db, election, options)
  await syncSocial(db, election, options)
  await syncPhotos(db, election, options)

  const count = listCandidates(db, {
    electionYear: election.year,
    state: election.state,
    office: election.office,
  }).length
  log(`${count} candidatos ativos em ${election.state}`)
}

async function runIngest(options: CliOptions): Promise<void> {
  const states = options.states ?? [...FEDERATION_UNITS]
  const dataDir = options.dataDir ?? 'data'
  const dbPath = join(dataDir, 'tse.db')
  const db = await openRepository(dbPath)
  let failed = 0

  try {
    for (const state of states) {
      try {
        await ingestElection(db, electionFor(state), options)
      } catch (error) {
        failed++
        logError(error)
      }
    }
  } finally {
    db.close()
  }

  log(`${states.length - failed}/${states.length} UFs sincronizadas (${dbPath})`)
  if (failed > 0) process.exit(1)
}

async function syncComplementary(
  db: Awaited<ReturnType<typeof openRepository>>,
  election: ElectionConfig,
  options: FetchOptions,
): Promise<void> {
  log(
    `sincronizando dados complementares do TSE (${election.datasets.complementar.dataset})`,
  )
  try {
    const { items, source } = await fetchComplementary(election, {
      dataDir: options.dataDir,
      force: options.force,
    })
    const bySequence = new Map(items.map((item) => [item.tseSequence, item]))

    const candidates = listCandidates(db, {
      electionYear: election.year,
      state: election.state,
      office: election.office,
    })

    let matched = 0
    for (const candidate of candidates) {
      const summary = bySequence.get(candidate.tseSequence)
      const enriched = applyComplementary(candidate, {
        tseSequence: candidate.tseSequence,
        birthMunicipality: summary?.birthMunicipality ?? null,
        quilombola: summary?.quilombola ?? null,
        indigenousEthnicity: summary?.indigenousEthnicity ?? null,
        inBallot: summary?.inBallot ?? null,
        substituted: summary?.substituted ?? null,
        accountsDeclared: summary?.accountsDeclared ?? null,
        assetsDeclared: summary?.assetsDeclared ?? null,
        isReelection: summary?.isReelection ?? null,
        campaignSpendingCap: summary?.campaignSpendingCap ?? null,
      })
      const updated = { ...enriched, source }
      upsertCandidate(db, updated)
      if (summary) matched++
    }
    log(
      `complementar: ${matched} candidatos enriquecidos (fonte ${source.dataset})`,
    )
  } catch (error) {
    logError(error)
  }
}

async function syncAssets(
  db: Awaited<ReturnType<typeof openRepository>>,
  election: ElectionConfig,
  options: FetchOptions,
): Promise<void> {
  log(`sincronizando bens declarados (${election.datasets.assets.dataset})`)
  try {
    const { items, source } = await fetchCandidateAssets(election, {
      dataDir: options.dataDir,
      force: options.force,
    })
    const bySequence = new Map(items.map((item) => [item.tseSequence, item]))

    const candidates = listCandidates(db, {
      electionYear: election.year,
      state: election.state,
      office: election.office,
    })

    let matched = 0
    for (const candidate of candidates) {
      const summary = bySequence.get(candidate.tseSequence)
      const updated = {
        ...applyAssets(candidate, summary?.totalAssets ?? null),
        source,
      }
      upsertCandidate(db, updated)
      if (summary) matched++
    }
    log(`bens: ${matched}/${candidates.length} candidatos com bens no arquivo`)
  } catch (error) {
    logError(error)
  }
}

async function syncSocial(
  db: Awaited<ReturnType<typeof openRepository>>,
  election: ElectionConfig,
  options: FetchOptions,
): Promise<void> {
  log(`sincronizando redes sociais (${election.datasets.social.dataset})`)
  try {
    const { items, source } = await fetchCandidateSocialLinks(election, {
      dataDir: options.dataDir,
      force: options.force,
    })
    const bySequence = new Map(items.map((item) => [item.tseSequence, item]))

    const candidates = listCandidates(db, {
      electionYear: election.year,
      state: election.state,
      office: election.office,
    })

    let matched = 0
    for (const candidate of candidates) {
      const summary = bySequence.get(candidate.tseSequence)
      const updated = {
        ...applySocialLinks(candidate, summary?.socialLinks ?? []),
        source,
      }
      upsertCandidate(db, updated)
      if (summary) matched++
    }
    log(`redes: ${matched}/${candidates.length} candidatos com link no arquivo`)
  } catch (error) {
    logError(error)
  }
}

async function syncPhotos(
  db: Awaited<ReturnType<typeof openRepository>>,
  election: ElectionConfig,
  options: FetchOptions,
): Promise<void> {
  log('baixando fotos de candidatos (dataset opcional)')
  try {
    const photos = await fetchCandidatePhotos(election, {
      dataDir: options.dataDir,
      force: options.force,
    })

    const candidates = listCandidates(db, {
      electionYear: election.year,
      state: election.state,
      office: election.office,
    })

    const updates: Array<{ id: string; photoUrl: string | null }> = []
    let matched = 0
    for (const candidate of candidates) {
      const file = photoFileForSequence(photos.files, candidate.tseSequence)
      const photoUrl = file ? photoPublicPath(photos.photosDir, file) : null
      updates.push({ id: candidate.id, photoUrl })
      if (photoUrl) matched++
    }

    setPhotoUrls(db, updates)
    log(`fotos: ${matched}/${candidates.length} candidatos com foto disponível`)
  } catch (error) {
    logError(error)
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))

  if (options.help) {
    console.log(USAGE)
    return
  }

  if (options.inspect) {
    const state = options.states?.[0] ?? CURRENT_ELECTION.state
    await runInspect(electionFor(state), options)
    return
  }

  await runIngest(options)
}

await main()
