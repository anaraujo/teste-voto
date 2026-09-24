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
import { CURRENT_ELECTION, electionKey } from '../src/shared/elections.ts'
import { fetchCandidates, type FetchOptions } from '../src/data-sources/tse/candidates.ts'
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
  ingest [--inspect] [--force]
  ingest --help

Opções:
  --inspect   Documenta o schema do CSV baixado em docs/tse-schema.md e termina.
  --force     Rebaixa os arquivos ZIP mesmo que já existam.
  --help      Mostra esta ajuda.
`

interface CliOptions extends FetchOptions {
  inspect: boolean
  help: boolean
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { inspect: false, help: false, force: false }
  for (const arg of argv) {
    if (arg === '--inspect') options.inspect = true
    else if (arg === '--force') options.force = true
    else if (arg === '--help') options.help = true
    else {
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
  console.error(`[ingest] ${error instanceof Error ? error.message : String(error)}`)
}

async function runInspect(options: FetchOptions): Promise<void> {
  const election = CURRENT_ELECTION
  log(`inspecionando arquivo de candidatos (${election.year}/${election.state}/${election.office})`)

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
  normalized: Omit<CandidateRecord, 'id' | 'source' | 'importedAt' | 'updatedAt'>,
  retrievedAt: string,
): CandidateRecord {
  const now = new Date().toISOString()
  const source = {
    provider: 'TSE',
    url: CURRENT_ELECTION.datasets.candidates.url,
    dataset: CURRENT_ELECTION.datasets.candidates.dataset,
    sourceFile: null,
    retrievedAt,
    sourceUpdatedAt: null,
  }

  return {
    id: candidateId({ electionYear: normalized.electionYear, state: normalized.state }, normalized.tseSequence),
    ...normalized,
    source,
    importedAt: now,
    updatedAt: now,
  }
}

async function runIngest(options: FetchOptions): Promise<void> {
  const election = CURRENT_ELECTION
  const key = electionKey(election)
  const dataDir = options.dataDir ?? 'data'
  const dbPath = join(dataDir, 'tse.db')

  log(`sincronizando candidatos ${election.year} ${election.state} - ${election.office}`)

  const db = await openRepository(dbPath)

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
      { electionYear: election.year, state: election.state, office: election.office },
      activeIds,
    )
    log(`candidatos: ${inserted} novos, ${updated} alterados, ${unchanged} iguais, ${removed} removidos`)
  } catch (error) {
    logError(error)
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
    db.close()
    process.exit(1)
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

  await syncPhotos(db, election, options)

  const count = listCandidates(db, {
    electionYear: election.year,
    state: election.state,
    office: election.office,
  }).length
  log(`${count} candidatos ativos no banco local (${dbPath})`)
  db.close()
}

async function syncPhotos(
  db: Awaited<ReturnType<typeof openRepository>>,
  election: typeof CURRENT_ELECTION,
  options: FetchOptions,
): Promise<void> {
  log('baixando fotos de candidatos (dataset opcional)')
  try {
    const photos = await fetchCandidatePhotos(election, { dataDir: options.dataDir, force: options.force })

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
    await runInspect(options)
    return
  }

  await runIngest(options)
}

await main()