/**
 * Ingestão dos candidatos (núcleo da camada TSE).
 *
 * Fluxo: download do ZIP oficial -> extração -> leitura do CSV ->
 * filtragem por eleição configurada -> mapeamento para linhas-validadas.
 * A validação do schema é feita em tempo de execução; o modo `--inspect`
 * documenta o arquivo baixado.
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ElectionConfig } from '../../shared/elections.ts'
import { parseCsv, type ParsedCsv } from './csv.ts'
import { downloadToFile, extractZip, findEntry, listZipEntries } from './download.ts'
import {
  buildHeaderIndex,
  electionConfigFrom,
  isElectionRow,
  mapRawRow,
  missingRequiredHeaders,
  type RawCandidateRow,
} from './schema.ts'
import { validateCandidate } from './validate.ts'

export interface CandidateImportRow {
  raw: RawCandidateRow
  /** Células originais da linha no CSV (preservadas para auditoria). */
  original: string[]
}

export interface CandidateFetchResult {
  rows: CandidateImportRow[]
  csv: ParsedCsv
  sourceFile: string | null
  downloaded: boolean
  validator: string | null
  retrievedAt: string
  rowsRead: number
  rowsKept: number
  errors: string[]
}

export interface FetchOptions {
  dataDir?: string
  force?: boolean
}

export function defaultDataDir(): string {
  return process.env.DATA_DIR ?? 'data'
}

function zipNameFromUrl(url: string): string {
  const path = new URL(url).pathname
  return path.slice(path.lastIndexOf('/') + 1)
}

export async function loadParsedCsv(
  election: ElectionConfig,
  options: FetchOptions,
): Promise<{ csv: ParsedCsv; sourceFile: string; downloaded: boolean; validator: string | null }> {
  const dataDir = options.dataDir ?? defaultDataDir()
  const descriptor = election.datasets.candidates
  const zipName = zipNameFromUrl(descriptor.url)
  const zipPath = join(dataDir, 'download', zipName)

  const download = await downloadToFile(descriptor.url, zipPath, { force: options.force })

  const extractDir = join(dataDir, 'download', 'extracted', descriptor.dataset)
  await extractZip(zipPath, extractDir)

  const entries = listZipEntries(zipPath)
  const entry = findEntry(entries, descriptor.sourceFileMatch)
  if (!entry) {
    throw new Error(`arquivo '${descriptor.sourceFileMatch}' não encontrado dentro de ${zipName}`)
  }

  const csvPath = join(extractDir, entry.name)
  const buffer = await readFile(csvPath)
  return {
    csv: parseCsv(buffer),
    sourceFile: entry.name,
    downloaded: download.downloaded,
    validator: download.validator,
  }
}

/**
 * Baixa e lê os candidatos da eleição configurada.
 * Linhas fora da eleição são descartadas; inconsistências são agregadas
 * em `errors` em vez de abortar a ingestão inteira.
 */
export async function fetchCandidates(
  election: ElectionConfig,
  options: FetchOptions = {},
): Promise<CandidateFetchResult> {
  const { csv, sourceFile, downloaded, validator } = await loadParsedCsv(election, options)

  const missing = missingRequiredHeaders(csv.headers)
  if (missing.length > 0) {
    throw new Error(`colunas obrigatórias ausentes no CSV: ${missing.join(', ')}`)
  }

  const index = buildHeaderIndex(csv.headers)
  const config = electionConfigFrom(election)

  let rowsRead = 0
  let rowsKept = 0
  const rows: CandidateImportRow[] = []
  const errors: string[] = []

  for (const row of csv.rows) {
    rowsRead++
    if (!isElectionRow(index, row, config)) continue

    const mapped = mapRawRow(index, row)
    const problems = validateCandidate(mapped)
    if (problems.length > 0) {
      errors.push(problems.map((e) => `${e.field}: ${e.problem}`).join('; '))
      continue
    }
    rows.push({ raw: mapped, original: row })
    rowsKept++
  }

  return {
    rows,
    csv,
    sourceFile,
    downloaded,
    validator,
    retrievedAt: new Date().toISOString(),
    rowsRead,
    rowsKept,
    errors,
  }
}