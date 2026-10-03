/**
 * Publica dados locais (tse.db, manifest.json, photos/) no bucket GCS.
 *
 * O runtime no Cloud Run nunca lê o repositório: o entrypoint copia os
 * arquivos do bucket montado (FUSE) para o disco local do container.
 *
 * Flags:
 *   --ingest   roda ingest + syncs antes de publicar
 *   --reload   força nova revisão do Cloud Run (DATA_VERSION) sem trocar a imagem
 *
 * Variáveis de ambiente:
 *   GCS_BUCKET         obrigatória (ex.: gs://meu-bucket)
 *   CLOUD_RUN_SERVICE  opcional, usada com --reload (default: teste-voto)
 *   CLOUD_RUN_REGION   opcional, usada com --reload (default: southamerica-east1)
 *
 * Execução: npm run publish:data -- [--ingest] [--reload]
 */

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { openRepository, listCandidates } from '../src/data-sources/repository.ts'
import { defaultDataDir } from '../src/data-sources/tse/candidates.ts'
import { CURRENT_ELECTION, electionKey } from '../src/shared/elections.ts'

interface Manifest {
  publishedAt: string
  election: string
  electionYear: number
  state: string
  office: string
  tseDbSha256: string
  tseDbBytes: number
  photosCount: number
  photosBytes: number
  candidatesCount: number
  source: {
    electionUrl: string
    datasets: Array<{ dataset: string; url: string }>
  }
}

function fail(message: string): never {
  console.error(`[publish:data] ${message}`)
  process.exit(1)
}

function run(command: string, args: string[]): void {
  console.log(`[publish:data] $ ${command} ${args.join(' ')}`)
  const result = spawnSync(command, args, { stdio: 'inherit' })
  if (result.error) fail(`falha ao executar ${command}: ${result.error.message}`)
  if (result.status !== 0) fail(`${command} saiu com código ${result.status}`)
}

function parseFlags(argv: string[]): { ingest: boolean; reload: boolean } {
  const flags = { ingest: false, reload: false }
  for (const arg of argv) {
    if (arg === '--ingest') flags.ingest = true
    else if (arg === '--reload') flags.reload = true
    else if (arg === '--help' || arg === '-h') {
      console.log('Uso: npm run publish:data -- [--ingest] [--reload]')
      process.exit(0)
    } else fail(`flag desconhecida: ${arg}`)
  }
  return flags
}

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash('sha256')
  hash.update(await readFile(filePath))
  return hash.digest('hex')
}

async function walkFiles(dir: string): Promise<string[]> {
  const out: string[] = []
  async function walk(current: string): Promise<void> {
    let entries
    try {
      entries = await readdir(current, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = join(current, entry.name)
      if (entry.isDirectory()) await walk(full)
      else if (entry.isFile()) out.push(full)
    }
  }
  await walk(dir)
  return out
}

function normalizeBucket(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) fail('GCS_BUCKET vazia. Configure GCS_BUCKET=gs://<bucket>.')
  return trimmed.replace(/^gs:\/\//, '').replace(/\/$/, '')
}

function requireFile(path: string, hint: string): void {
  if (!existsSync(path)) {
    fail(`${path} não encontrado. Rode "${hint}" antes de publicar.`)
  }
}

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2))
  const dataDir = defaultDataDir()
  const dbPath = join(dataDir, 'tse.db')
  const photosDir = join(dataDir, 'photos')
  const manifestPath = join(dataDir, 'manifest.json')
  const bucket = normalizeBucket(process.env.GCS_BUCKET ?? '')

  if (flags.ingest) {
    run('npm', ['run', 'ingest'])
    run('npm', ['run', 'sync:incumbents'])
    run('npm', ['run', 'sync:parliament'])
    run('npm', ['run', 'sync:history'])
  }

  requireFile(dbPath, 'npm run ingest')
  if (!existsSync(photosDir)) {
    console.warn(`[publish:data] aviso: ${photosDir} ausente — publicando sem fotos`)
  }

  console.log('[publish:data] checkpoint WAL do banco…')
  {
    const db = new DatabaseSync(dbPath)
    try {
      db.exec('PRAGMA wal_checkpoint(TRUNCATE);')
    } finally {
      db.close()
    }
  }

  const publishedAt = new Date().toISOString()
  const tseDbSha256 = await sha256File(dbPath)
  const tseDbBytes = (await stat(dbPath)).size

  const photoFiles = await walkFiles(photosDir)
  let photosBytes = 0
  for (const file of photoFiles) {
    photosBytes += (await stat(file)).size
  }

  let candidatesCount = 0
  {
    const db = await openRepository(dbPath)
    try {
      candidatesCount = listCandidates(db, {
        electionYear: CURRENT_ELECTION.year,
        state: CURRENT_ELECTION.state,
        office: CURRENT_ELECTION.office,
      }).length
    } finally {
      db.close()
    }
  }

  const manifest: Manifest = {
    publishedAt,
    election: electionKey(CURRENT_ELECTION),
    electionYear: CURRENT_ELECTION.year,
    state: CURRENT_ELECTION.state,
    office: CURRENT_ELECTION.office,
    tseDbSha256,
    tseDbBytes,
    photosCount: photoFiles.length,
    photosBytes,
    candidatesCount,
    source: {
      electionUrl: CURRENT_ELECTION.candidateDatasetUrl,
      datasets: Object.values(CURRENT_ELECTION.datasets).map((d) => ({
        dataset: d.dataset,
        url: d.url,
      })),
    },
  }

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  console.log(`[publish:data] manifest em ${manifestPath}`)
  console.log(
    `[publish:data] eleição ${manifest.election} · ${manifest.candidatesCount} candidatos · ` +
      `${manifest.photosCount} fotos · sha256 ${tseDbSha256.slice(0, 12)}…`,
  )

  const gsBase = `gs://${bucket}`
  console.log(`[publish:data] upload para ${gsBase}/`)
  run('gcloud', ['storage', 'cp', dbPath, `${gsBase}/tse.db`])
  run('gcloud', ['storage', 'cp', manifestPath, `${gsBase}/manifest.json`])
  if (photoFiles.length > 0) {
    run('gcloud', ['storage', 'rsync', photosDir, `${gsBase}/photos`, '--recursive'])
  }

  console.log('[publish:data] nunca envie data/download/ nem data/camara/ — só runtime.')

  if (flags.reload) {
    const service = process.env.CLOUD_RUN_SERVICE ?? 'teste-voto'
    const region = process.env.CLOUD_RUN_REGION ?? 'southamerica-east1'
    console.log(`[publish:data] reload do Cloud Run (${service} em ${region})…`)
    run('gcloud', [
      'run',
      'services',
      'update',
      service,
      '--region',
      region,
      '--update-env-vars',
      `DATA_VERSION=${publishedAt}`,
    ])
  }

  console.log('[publish:data] ok')
}

await main()
