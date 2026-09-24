/**
 * Repositório SQLite (`node:sqlite`) com atualização incremental.
 *
 * Guarda dados normalizados, dados brutos (auditoria) e o histórico de
 * sincronização. Detecta candidatos novos, alterados ou removidos
 * comparando um checksum do registro normalizado.
 */

import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import type { CandidateRecord, Source } from '../shared/domain.ts'
import { candidateChecksum } from './tse/normalize.ts'

export type UpsertStatus = 'inserted' | 'updated' | 'unchanged'

export interface UpsertResult {
  status: UpsertStatus
}

export interface SyncLogEntry {
  election: string
  dataset: string
  url: string
  validator: string | null
  sourceFile: string | null
  retrievedAt: string
  rowsRead: number
  rowsKept: number
  rowsInserted: number
  rowsUpdated: number
  rowsDeleted: number
  status: 'success' | 'error'
  error: string | null
}

interface CandidateRow {
  id: string
  election_year: number
  state: string
  office: string
  tse_sequence: string
  ballot_name: string
  full_name: string
  ballot_number: string
  party: string | null
  party_acronym: string | null
  coalition: string | null
  status: string | null
  campaign_status: string | null
  candidacy_type: string | null
  occupation: string | null
  education: string | null
  birth_date: string | null
  gender: string | null
  race: string | null
  nationality: string | null
  city: string | null
  email: string | null
  website: string | null
  photo_url: string | null
  total_assets: number | null
  source_provider: string
  source_url: string
  source_dataset: string
  source_file: string | null
  source_retrieved_at: string
  source_updated_at: string | null
  imported_at: string
  updated_at: string
  checksum: string
  is_active: number
}

export interface ElectionFilter {
  electionYear: number
  state: string
  office: string
}

function createSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS candidates (
      id TEXT PRIMARY KEY,
      election_year INTEGER NOT NULL,
      state TEXT NOT NULL,
      office TEXT NOT NULL,
      tse_sequence TEXT NOT NULL,
      ballot_name TEXT NOT NULL,
      full_name TEXT NOT NULL,
      ballot_number TEXT NOT NULL,
      party TEXT,
      party_acronym TEXT,
      coalition TEXT,
      status TEXT,
      campaign_status TEXT,
      candidacy_type TEXT,
      occupation TEXT,
      education TEXT,
      birth_date TEXT,
      gender TEXT,
      race TEXT,
      nationality TEXT,
      city TEXT,
      email TEXT,
      website TEXT,
      photo_url TEXT,
      total_assets REAL,
      source_provider TEXT NOT NULL,
      source_url TEXT NOT NULL,
      source_dataset TEXT NOT NULL,
      source_file TEXT,
      source_retrieved_at TEXT NOT NULL,
      source_updated_at TEXT,
      imported_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      checksum TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_candidates_election
      ON candidates (election_year, state, office, is_active);

    CREATE TABLE IF NOT EXISTS candidates_raw (
      id TEXT PRIMARY KEY REFERENCES candidates(id),
      raw_json TEXT NOT NULL,
      synced_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      election TEXT NOT NULL,
      dataset TEXT NOT NULL,
      url TEXT NOT NULL,
      validator TEXT,
      source_file TEXT,
      retrieved_at TEXT NOT NULL,
      rows_read INTEGER NOT NULL,
      rows_kept INTEGER NOT NULL,
      rows_inserted INTEGER NOT NULL,
      rows_updated INTEGER NOT NULL,
      rows_deleted INTEGER NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      created_at TEXT NOT NULL
    );
  `)
}

/** Abre (ou cria) o repositório em um caminho no disco. */
export async function openRepository(filePath: string): Promise<DatabaseSync> {
  await mkdir(dirname(filePath), { recursive: true })
  const db = new DatabaseSync(filePath)
  db.exec('PRAGMA journal_mode = WAL;')
  createSchema(db)
  return db
}

/** Cria o schema sobre uma conexão já aberta (útil em testes com memória). */
export function prepareDatabase(db: DatabaseSync): void {
  createSchema(db)
}

/** Converte um CandidateRecord nas colunas SQL. */
function toColumns(candidate: CandidateRecord) {
  return {
    id: candidate.id,
    election_year: candidate.electionYear,
    state: candidate.state,
    office: candidate.office,
    tse_sequence: candidate.tseSequence,
    ballot_name: candidate.ballotName,
    full_name: candidate.fullName,
    ballot_number: candidate.ballotNumber,
    party: candidate.party,
    party_acronym: candidate.partyAcronym,
    coalition: candidate.coalition,
    status: candidate.status,
    campaign_status: candidate.campaignStatus,
    candidacy_type: candidate.candidacyType,
    occupation: candidate.occupation,
    education: candidate.education,
    birth_date: candidate.birthDate,
    gender: candidate.gender,
    race: candidate.race,
    nationality: candidate.nationality,
    city: candidate.city,
    email: candidate.email,
    website: candidate.website,
    photo_url: candidate.photoUrl,
    total_assets: candidate.totalAssets,
    source_provider: candidate.source.provider,
    source_url: candidate.source.url,
    source_dataset: candidate.source.dataset,
    source_file: candidate.source.sourceFile,
    source_retrieved_at: candidate.source.retrievedAt,
    source_updated_at: candidate.source.sourceUpdatedAt,
    imported_at: candidate.importedAt,
    updated_at: candidate.updatedAt,
    checksum: candidateChecksum(candidate),
  }
}

function toCandidate(row: CandidateRow): CandidateRecord {
  const source: Source = {
    provider: row.source_provider,
    url: row.source_url,
    dataset: row.source_dataset,
    sourceFile: row.source_file,
    retrievedAt: row.source_retrieved_at,
    sourceUpdatedAt: row.source_updated_at,
  }

  return {
    id: row.id,
    tseSequence: row.tse_sequence,
    electionYear: row.election_year,
    state: row.state,
    office: row.office,
    ballotName: row.ballot_name,
    fullName: row.full_name,
    ballotNumber: row.ballot_number,
    party: row.party,
    partyAcronym: row.party_acronym,
    coalition: row.coalition,
    status: row.status,
    campaignStatus: row.campaign_status,
    candidacyType: row.candidacy_type,
    occupation: row.occupation,
    education: row.education,
    birthDate: row.birth_date,
    gender: row.gender,
    race: row.race,
    nationality: row.nationality,
    city: row.city,
    email: row.email,
    website: row.website,
    socialLinks: [],
    photoUrl: row.photo_url,
    totalAssets: row.total_assets,
    source,
    importedAt: row.imported_at,
    updatedAt: row.updated_at,
  }
}

function single(db: DatabaseSync, sql: string, ...args: SQLInputValue[]): CandidateRow | undefined {
  const result = db.prepare(sql).get(...args)
  return result === undefined ? undefined : (result as unknown as CandidateRow)
}

/**
 * Insere ou atualiza um candidato mantendo o atributo is_active.
 * Detecção de mudança pelo checksum do conteúdo normalizado.
 */
export function upsertCandidate(
  db: DatabaseSync,
  candidate: CandidateRecord,
): UpsertResult {
  const existing = single(
    db,
    `SELECT * FROM candidates WHERE id = ?`,
    candidate.id,
  )

  const columns = toColumns(candidate)

  if (!existing) {
    db.prepare(
      `INSERT INTO candidates (
        id, election_year, state, office, tse_sequence, ballot_name,
        full_name, ballot_number, party, party_acronym, coalition, status,
        campaign_status, candidacy_type, occupation, education, birth_date,
        gender, race, nationality, city, email, website, photo_url,
        total_assets, source_provider, source_url, source_dataset,
        source_file, source_retrieved_at, source_updated_at, imported_at,
        updated_at, checksum, is_active
      ) VALUES (
        $id, $election_year, $state, $office, $tse_sequence, $ballot_name,
        $full_name, $ballot_number, $party, $party_acronym, $coalition, $status,
        $campaign_status, $candidacy_type, $occupation, $education, $birth_date,
        $gender, $race, $nationality, $city, $email, $website, $photo_url,
        $total_assets, $source_provider, $source_url, $source_dataset,
        $source_file, $source_retrieved_at, $source_updated_at, $imported_at,
        $updated_at, $checksum, 1
      )`,
    ).run(columns)
    return { status: 'inserted' }
  }

  if (existing.checksum === columns.checksum) {
    return { status: 'unchanged' }
  }

  db.prepare(
    `UPDATE candidates SET
      ballot_name = $ballot_name, full_name = $full_name,
      ballot_number = $ballot_number, party = $party,
      party_acronym = $party_acronym, coalition = $coalition,
      status = $status, campaign_status = $campaign_status,
      candidacy_type = $candidacy_type, occupation = $occupation,
      education = $education, birth_date = $birth_date,
      gender = $gender, race = $race, nationality = $nationality,
      city = $city, email = $email, website = $website,
      photo_url = $photo_url, total_assets = $total_assets,
      source_provider = $source_provider, source_url = $source_url,
      source_dataset = $source_dataset, source_file = $source_file,
      source_retrieved_at = $source_retrieved_at,
      source_updated_at = $source_updated_at,
      updated_at = $updated_at, checksum = $checksum
    WHERE id = $id`,
  ).run({
    id: columns.id,
    ballot_name: columns.ballot_name,
    full_name: columns.full_name,
    ballot_number: columns.ballot_number,
    party: columns.party,
    party_acronym: columns.party_acronym,
    coalition: columns.coalition,
    status: columns.status,
    campaign_status: columns.campaign_status,
    candidacy_type: columns.candidacy_type,
    occupation: columns.occupation,
    education: columns.education,
    birth_date: columns.birth_date,
    gender: columns.gender,
    race: columns.race,
    nationality: columns.nationality,
    city: columns.city,
    email: columns.email,
    website: columns.website,
    photo_url: columns.photo_url,
    total_assets: columns.total_assets,
    source_provider: columns.source_provider,
    source_url: columns.source_url,
    source_dataset: columns.source_dataset,
    source_file: columns.source_file,
    source_retrieved_at: columns.source_retrieved_at,
    source_updated_at: columns.source_updated_at,
    updated_at: columns.updated_at,
    checksum: columns.checksum,
  })
  return { status: 'updated' }
}

/** Preserva a linha original do CSV para auditoria. */
export function storeRaw(db: DatabaseSync, id: string, originalCells: readonly string[]): void {
  db.prepare(
    `INSERT INTO candidates_raw (id, raw_json, synced_at)
     VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET raw_json = excluded.raw_json,
       synced_at = excluded.synced_at`,
  ).run(id, JSON.stringify(originalCells), new Date().toISOString())
}

/**
 * Marca como inativos os candidatos da eleição que aparecem no banco mas
 * não no último arquivo recebido. Retorna quantos foram desativados.
 */
export function deactivateMissing(
  db: DatabaseSync,
  filter: ElectionFilter,
  activeIds: readonly string[],
): number {
  let result: { changes: number | bigint }

  if (activeIds.length === 0) {
    result = db.prepare(
      `UPDATE candidates SET is_active = 0
       WHERE election_year = ? AND state = ? AND office = ? AND is_active = 1`,
    ).run(filter.electionYear, filter.state, filter.office)
  } else {
    const placeholders = activeIds.map(() => '?').join(',')
    result = db.prepare(
      `UPDATE candidates SET is_active = 0
       WHERE election_year = ?
         AND state = ?
         AND office = ?
         AND is_active = 1
         AND id NOT IN (${placeholders})`,
    ).run(filter.electionYear, filter.state, filter.office, ...activeIds)
  }

  return Number(result.changes)
}

export function writeSyncLog(db: DatabaseSync, entry: SyncLogEntry): void {
  db.prepare(
    `INSERT INTO sync_log (
      election, dataset, url, validator, source_file, retrieved_at,
      rows_read, rows_kept, rows_inserted, rows_updated, rows_deleted,
      status, error, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    entry.election,
    entry.dataset,
    entry.url,
    entry.validator,
    entry.sourceFile,
    entry.retrievedAt,
    entry.rowsRead,
    entry.rowsKept,
    entry.rowsInserted,
    entry.rowsUpdated,
    entry.rowsDeleted,
    entry.status,
    entry.error,
    new Date().toISOString(),
  )
}

/** Lista candidatos ativos da eleição, em ordem alfabética do nome de urna. */
export function listCandidates(
  db: DatabaseSync,
  filter: ElectionFilter,
): CandidateRecord[] {
  const rows = db
    .prepare(
      `SELECT * FROM candidates
       WHERE election_year = ? AND state = ? AND office = ? AND is_active = 1
       ORDER BY ballot_name COLLATE NOCASE`,
    )
    .all(filter.electionYear, filter.state, filter.office) as unknown as CandidateRow[]

  return rows.map(toCandidate)
}

export function getCandidate(db: DatabaseSync, id: string): CandidateRecord | null {
  const row = single(db, `SELECT * FROM candidates WHERE id = ?`, id)
  return row ? toCandidate(row) : null
}

/** Atualiza o caminho da foto dos candidatos presentes em `updates`. */
export function setPhotoUrls(db: DatabaseSync, updates: Array<{ id: string; photoUrl: string | null }>): void {
  const statement = db.prepare(`UPDATE candidates SET photo_url = ? WHERE id = ?`)
  for (const update of updates) {
    statement.run(update.photoUrl, update.id)
  }
}