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
import type { ParliamentaryData } from './parliament/types.ts'
import type { PoliticalMandate } from './tse/history.ts'
import type {
  MunicipalChamberSource,
  MunicipalLegislatorIdentity,
  MunicipalMandate,
} from './municipal/types.ts'

export type UpsertStatus = 'inserted' | 'updated' | 'unchanged'

export interface UpsertResult {
  status: UpsertStatus
}

function bool(value: boolean | null): SQLInputValue {
  if (value === null) return null
  return value ? 1 : 0
}

function toBool(value: number | null): boolean | null {
  if (value === null) return null
  return value !== 0
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
  marital_status: string | null
  birth_state: string | null
  federation: string | null
  birth_municipality: string | null
  quilombola: number | null
  indigenous_ethnicity: string | null
  in_ballot: number | null
  substituted: number | null
  accounts_declared: number | null
  assets_declared: number | null
  is_reelection: number | null
  campaign_spending_cap: number | null
  social_links: string | null
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
      marital_status TEXT,
      birth_state TEXT,
      federation TEXT,
      birth_municipality TEXT,
      quilombola INTEGER,
      indigenous_ethnicity TEXT,
      in_ballot INTEGER,
      substituted INTEGER,
      accounts_declared INTEGER,
      assets_declared INTEGER,
      is_reelection INTEGER,
      campaign_spending_cap REAL,
      social_links TEXT,
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

    CREATE TABLE IF NOT EXISTS incumbents (
      candidate_id TEXT PRIMARY KEY REFERENCES candidates(id),
      camara_id INTEGER NOT NULL,
      camara_name TEXT NOT NULL,
      camara_party_acronym TEXT,
      camara_photo_url TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS parliamentary_mandates (
      candidate_id TEXT NOT NULL REFERENCES candidates(id),
      casa TEXT NOT NULL,
      legislatura TEXT NOT NULL,
      id_parlamentar INTEGER NOT NULL,
      nome_parlamentar TEXT NOT NULL,
      partido TEXT,
      uf TEXT,
      data_inicio TEXT,
      data_fim TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (candidate_id, casa, legislatura)
    );

    CREATE TABLE IF NOT EXISTS parliamentary_records (
      candidate_id TEXT NOT NULL REFERENCES candidates(id),
      casa TEXT NOT NULL,
      proposicoes_por_ano TEXT NOT NULL DEFAULT '{}',
      comissoes TEXT,
      despesas_por_ano TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (candidate_id, casa)
    );

    CREATE TABLE IF NOT EXISTS votes (
      candidate_id TEXT NOT NULL REFERENCES candidates(id),
      votacao_id TEXT NOT NULL,
      tema TEXT NOT NULL,
      rotulo TEXT NOT NULL,
      proposicao TEXT NOT NULL,
      data TEXT NOT NULL,
      casa TEXT NOT NULL,
      voto TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (candidate_id, votacao_id)
    );

    CREATE TABLE IF NOT EXISTS municipal_chambers (
      municipality_ibge_code TEXT PRIMARY KEY,
      municipality_name TEXT NOT NULL,
      state TEXT NOT NULL,
      chamber_name TEXT NOT NULL,
      chamber_url TEXT,
      source_type TEXT NOT NULL,
      api_base_url TEXT,
      access TEXT NOT NULL,
      capabilities_json TEXT NOT NULL,
      last_verified_at TEXT,
      note TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS municipal_legislators (
      source_id TEXT NOT NULL,
      source_person_id TEXT NOT NULL,
      municipality_ibge_code TEXT NOT NULL,
      full_name TEXT NOT NULL,
      source_raw_json TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (source_id, source_person_id)
    );

    CREATE INDEX IF NOT EXISTS idx_municipal_legislators_ibge
      ON municipal_legislators (municipality_ibge_code);

    CREATE TABLE IF NOT EXISTS municipal_identities (
      candidate_id TEXT NOT NULL REFERENCES candidates(id),
      source_id TEXT NOT NULL,
      source_person_id TEXT,
      municipality_ibge_code TEXT NOT NULL,
      full_name TEXT NOT NULL,
      matching_status TEXT NOT NULL,
      matching_method TEXT NOT NULL,
      matching_evidence TEXT,
      verified_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (candidate_id, source_id)
    );

    CREATE INDEX IF NOT EXISTS idx_municipal_identities_ibge
      ON municipal_identities (municipality_ibge_code);

    CREATE TABLE IF NOT EXISTS municipal_mandates (
      source_id TEXT NOT NULL,
      source_mandate_id TEXT NOT NULL,
      source_person_id TEXT,
      legislature_id TEXT,
      municipality_ibge_code TEXT NOT NULL,
      office TEXT NOT NULL,
      legislature_label TEXT,
      start_date TEXT,
      end_date TEXT,
      titular INTEGER,
      party TEXT,
      roles_json TEXT NOT NULL,
      source_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (source_id, source_mandate_id)
    );

    CREATE INDEX IF NOT EXISTS idx_municipal_mandates_ibge
      ON municipal_mandates (municipality_ibge_code);

    CREATE TABLE IF NOT EXISTS political_mandates (
      candidate_id TEXT NOT NULL REFERENCES candidates(id),
      ano INTEGER NOT NULL,
      cargo TEXT NOT NULL,
      uf TEXT,
      municipio TEXT,
      partido_sigla TEXT,
      status TEXT NOT NULL,
      turno INTEGER NOT NULL DEFAULT 0,
      sq_candidato TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (candidate_id, ano, cargo, turno)
    );
  `)
}

/** Colunas adicionadas após a primeira versão do schema (migração leve). */
const SCHEMA_MIGRATIONS: Array<{ column: string; ddl: string }> = [
  { column: 'marital_status', ddl: 'TEXT' },
  { column: 'birth_state', ddl: 'TEXT' },
  { column: 'federation', ddl: 'TEXT' },
  { column: 'birth_municipality', ddl: 'TEXT' },
  { column: 'quilombola', ddl: 'INTEGER' },
  { column: 'indigenous_ethnicity', ddl: 'TEXT' },
  { column: 'in_ballot', ddl: 'INTEGER' },
  { column: 'substituted', ddl: 'INTEGER' },
  { column: 'accounts_declared', ddl: 'INTEGER' },
  { column: 'assets_declared', ddl: 'INTEGER' },
  { column: 'is_reelection', ddl: 'INTEGER' },
  { column: 'campaign_spending_cap', ddl: 'REAL' },
  { column: 'social_links', ddl: 'TEXT' },
]

/** Adiciona colunas faltantes a um banco já existente (sem recriar dados). */
function migrateSchema(db: DatabaseSync): void {
  const columns = db.prepare('PRAGMA table_info(candidates)').all() as unknown as Array<{ name: string }>
  const existing = new Set(columns.map((column) => column.name))
  for (const migration of SCHEMA_MIGRATIONS) {
    if (existing.has(migration.column)) continue
    db.exec(`ALTER TABLE candidates ADD COLUMN ${migration.column} ${migration.ddl}`)
  }
}

/** Abre (ou cria) o repositório em um caminho no disco. */
export async function openRepository(filePath: string): Promise<DatabaseSync> {
  await mkdir(dirname(filePath), { recursive: true })
  const db = new DatabaseSync(filePath)
  db.exec('PRAGMA journal_mode = WAL;')
  createSchema(db)
  migrateSchema(db)
  return db
}

/** Cria o schema sobre uma conexão já aberta (útil em testes com memória). */
export function prepareDatabase(db: DatabaseSync): void {
  createSchema(db)
  migrateSchema(db)
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
    marital_status: candidate.maritalStatus,
    birth_state: candidate.birthState,
    federation: candidate.federation,
    birth_municipality: candidate.birthMunicipality,
    quilombola: bool(candidate.quilombola),
    indigenous_ethnicity: candidate.indigenousEthnicity,
    in_ballot: bool(candidate.inBallot),
    substituted: bool(candidate.substituted),
    accounts_declared: bool(candidate.accountsDeclared),
    assets_declared: bool(candidate.assetsDeclared),
    is_reelection: bool(candidate.isReelection),
    campaign_spending_cap: candidate.campaignSpendingCap,
    social_links: candidate.socialLinks.length > 0 ? JSON.stringify(candidate.socialLinks) : null,
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
    socialLinks: row.social_links ? (JSON.parse(row.social_links) as string[]) : [],
    photoUrl: row.photo_url,
    totalAssets: row.total_assets,
    maritalStatus: row.marital_status,
    birthState: row.birth_state,
    federation: row.federation,
    birthMunicipality: row.birth_municipality,
    quilombola: toBool(row.quilombola),
    indigenousEthnicity: row.indigenous_ethnicity,
    inBallot: toBool(row.in_ballot),
    substituted: toBool(row.substituted),
    accountsDeclared: toBool(row.accounts_declared),
    assetsDeclared: toBool(row.assets_declared),
    isReelection: toBool(row.is_reelection),
    campaignSpendingCap: row.campaign_spending_cap,
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
        total_assets, marital_status, birth_state, federation,
        birth_municipality, quilombola, indigenous_ethnicity, in_ballot,
        substituted, accounts_declared, assets_declared, is_reelection,
        campaign_spending_cap, social_links,
        source_provider, source_url, source_dataset,
        source_file, source_retrieved_at, source_updated_at, imported_at,
        updated_at, checksum, is_active
      ) VALUES (
        $id, $election_year, $state, $office, $tse_sequence, $ballot_name,
        $full_name, $ballot_number, $party, $party_acronym, $coalition, $status,
        $campaign_status, $candidacy_type, $occupation, $education, $birth_date,
        $gender, $race, $nationality, $city, $email, $website, $photo_url,
        $total_assets, $marital_status, $birth_state, $federation,
        $birth_municipality, $quilombola, $indigenous_ethnicity, $in_ballot,
        $substituted, $accounts_declared, $assets_declared, $is_reelection,
        $campaign_spending_cap, $social_links,
        $source_provider, $source_url, $source_dataset,
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
      marital_status = $marital_status, birth_state = $birth_state,
      federation = $federation,
      birth_municipality = $birth_municipality,
      quilombola = $quilombola,
      indigenous_ethnicity = $indigenous_ethnicity,
      in_ballot = $in_ballot, substituted = $substituted,
      accounts_declared = $accounts_declared,
      assets_declared = $assets_declared,
      is_reelection = $is_reelection,
      campaign_spending_cap = $campaign_spending_cap,
      social_links = $social_links,
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
    marital_status: columns.marital_status,
    birth_state: columns.birth_state,
    federation: columns.federation,
    birth_municipality: columns.birth_municipality,
    quilombola: columns.quilombola,
    indigenous_ethnicity: columns.indigenous_ethnicity,
    in_ballot: columns.in_ballot,
    substituted: columns.substituted,
    accounts_declared: columns.accounts_declared,
    assets_declared: columns.assets_declared,
    is_reelection: columns.is_reelection,
    campaign_spending_cap: columns.campaign_spending_cap,
    social_links: columns.social_links,
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

export interface IncumbentEntry {
  candidateId: string
  camaraId: number
  camaraName: string
  camaraPartyAcronym: string
  camaraPhotoUrl: string | null
}

export interface IncumbentRow extends IncumbentEntry {
  updatedAt: string
}

interface IncumbentDbRow {
  candidate_id: string
  camara_id: number
  camara_name: string
  camara_party_acronym: string | null
  camara_photo_url: string | null
  updated_at: string
}

function toIncumbentRow(row: IncumbentDbRow): IncumbentRow {
  return {
    candidateId: row.candidate_id,
    camaraId: row.camara_id,
    camaraName: row.camara_name,
    camaraPartyAcronym: row.camara_party_acronym ?? '',
    camaraPhotoUrl: row.camara_photo_url,
    updatedAt: row.updated_at,
  }
}

/** Substitui o mapa de incumbentes da eleição pelos casamentos atuais. */
export function replaceIncumbents(db: DatabaseSync, entries: IncumbentEntry[]): void {
  db.exec('BEGIN')
  try {
    db.prepare(`DELETE FROM incumbents`).run()
    const statement = db.prepare(
      `INSERT INTO incumbents (
        candidate_id, camara_id, camara_name, camara_party_acronym,
        camara_photo_url, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    for (const entry of entries) {
      statement.run(
        entry.candidateId,
        entry.camaraId,
        entry.camaraName,
        entry.camaraPartyAcronym || null,
        entry.camaraPhotoUrl,
        new Date().toISOString(),
      )
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

/** Retorna um mapa candidateId -> incumbente. */
export function listIncumbents(db: DatabaseSync): Map<string, IncumbentRow> {
  const rows = db.prepare(`SELECT * FROM incumbents`).all() as unknown as IncumbentDbRow[]
  const map = new Map<string, IncumbentRow>()
  for (const row of rows) {
    map.set(row.candidate_id, toIncumbentRow(row))
  }
  return map
}

interface MandateDbRow {
  candidate_id: string
  casa: string
  legislatura: string
  id_parlamentar: number
  nome_parlamentar: string
  partido: string | null
  uf: string | null
  data_inicio: string | null
  data_fim: string | null
  updated_at: string
}

interface RecordDbRow {
  candidate_id: string
  casa: string
  proposicoes_por_ano: string
  comissoes: string | null
  despesas_por_ano: string | null
  updated_at: string
}

interface VoteDbRow {
  candidate_id: string
  votacao_id: string
  tema: string
  rotulo: string
  proposicao: string
  data: string
  casa: string
  voto: string | null
  updated_at: string
}

function parseJsonObject(value: string | null): Record<string, number> {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, number>
    }
  } catch {
    // ignora e devolve vazio
  }
  return {}
}

function toMandateRow(row: MandateDbRow): ParliamentaryData['mandates'][number] {
  return {
    candidateId: row.candidate_id,
    casa: row.casa as 'camara',
    legislatura: row.legislatura,
    idParlamentar: row.id_parlamentar,
    nomeParlamentar: row.nome_parlamentar,
    partido: row.partido,
    uf: row.uf,
    dataInicio: row.data_inicio,
    dataFim: row.data_fim,
  }
}

function toRecordRow(row: RecordDbRow): ParliamentaryData['records'][number] {
  const comissoes = row.comissoes ? ((JSON.parse(row.comissoes) as unknown[]) ?? []) : []
  return {
    candidateId: row.candidate_id,
    casa: row.casa as 'camara',
    proposicoesPorAno: parseJsonObject(row.proposicoes_por_ano),
    comissoes: comissoes.map((item) => item as { sigla: string; nome: string }),
    despesasPorAno: parseJsonObject(row.despesas_por_ano),
  }
}

function toVoteRow(row: VoteDbRow): ParliamentaryData['votes'][number] {
  return {
    candidateId: row.candidate_id,
    votacaoId: row.votacao_id,
    tema: row.tema,
    rotulo: row.rotulo,
    proposicao: row.proposicao,
    data: row.data,
    casa: row.casa as 'camara',
    voto: row.voto as ParliamentaryData['votes'][number]['voto'],
  }
}

/**
 * Substitui toda a camada parlamentar (mandatos, métricas e votos) de uma
 * vez, em transação. O script de sincronização recalcula o conjunto inteiro.
 */
export function replaceParliamentary(db: DatabaseSync, data: ParliamentaryData): void {
  db.exec('BEGIN')
  try {
    db.prepare(`DELETE FROM votes`).run()
    db.prepare(`DELETE FROM parliamentary_records`).run()
    db.prepare(`DELETE FROM parliamentary_mandates`).run()

    const mandateStmt = db.prepare(
      `INSERT INTO parliamentary_mandates (
        candidate_id, casa, legislatura, id_parlamentar, nome_parlamentar,
        partido, uf, data_inicio, data_fim, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    for (const mandate of data.mandates) {
      mandateStmt.run(
        mandate.candidateId,
        mandate.casa,
        mandate.legislatura,
        mandate.idParlamentar,
        mandate.nomeParlamentar,
        mandate.partido ?? null,
        mandate.uf ?? null,
        mandate.dataInicio ?? null,
        mandate.dataFim ?? null,
        new Date().toISOString(),
      )
    }

    const recordStmt = db.prepare(
      `INSERT INTO parliamentary_records (
        candidate_id, casa, proposicoes_por_ano, comissoes, despesas_por_ano, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    for (const record of data.records) {
      recordStmt.run(
        record.candidateId,
        record.casa,
        JSON.stringify(record.proposicoesPorAno),
        record.comissoes.length > 0 ? JSON.stringify(record.comissoes) : null,
        Object.keys(record.despesasPorAno).length > 0
          ? JSON.stringify(record.despesasPorAno)
          : null,
        new Date().toISOString(),
      )
    }

    const voteStmt = db.prepare(
      `INSERT INTO votes (
        candidate_id, votacao_id, tema, rotulo, proposicao, data, casa, voto, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    for (const vote of data.votes) {
      voteStmt.run(
        vote.candidateId,
        vote.votacaoId,
        vote.tema,
        vote.rotulo,
        vote.proposicao,
        vote.data,
        vote.casa,
        vote.voto ?? null,
        new Date().toISOString(),
      )
    }

    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

/** Dados parlamentares de um candidato (vazios quando não há histórico). */
export function getParliamentary(
  db: DatabaseSync,
  candidateId: string,
): { mandates: ParliamentaryData['mandates']; records: ParliamentaryData['records']; votes: ParliamentaryData['votes'] } {
  const mandates = (
    db.prepare(
      `SELECT * FROM parliamentary_mandates WHERE candidate_id = ? ORDER BY legislatura`,
    ).all(candidateId) as unknown as MandateDbRow[]
  ).map(toMandateRow)
  const records = (
    db.prepare(
      `SELECT * FROM parliamentary_records WHERE candidate_id = ?`,
    ).all(candidateId) as unknown as RecordDbRow[]
  ).map(toRecordRow)
  const votes = (
    db.prepare(
      `SELECT * FROM votes WHERE candidate_id = ? ORDER BY data`,
    ).all(candidateId) as unknown as VoteDbRow[]
  ).map(toVoteRow)
  return { mandates, records, votes }
}

/** Retorna um mapa candidateId -> dados parlamentares (para server/export). */
export function listParliamentary(
  db: DatabaseSync,
): Map<string, { mandates: ParliamentaryData['mandates']; records: ParliamentaryData['records']; votes: ParliamentaryData['votes'] }> {
  const mandates = (
    db.prepare(`SELECT * FROM parliamentary_mandates`).all() as unknown as MandateDbRow[]
  ).map(toMandateRow)
  const records = (
    db.prepare(`SELECT * FROM parliamentary_records`).all() as unknown as RecordDbRow[]
  ).map(toRecordRow)
  const votes = (
    db.prepare(`SELECT * FROM votes`).all() as unknown as VoteDbRow[]
  ).map(toVoteRow)

  const byCandidate = new Map<
    string,
    { mandates: ParliamentaryData['mandates']; records: ParliamentaryData['records']; votes: ParliamentaryData['votes'] }
  >()
  const get = (candidateId: string) => {
    let entry = byCandidate.get(candidateId)
    if (!entry) {
      entry = { mandates: [], records: [], votes: [] }
      byCandidate.set(candidateId, entry)
    }
    return entry
  }
  for (const mandate of mandates) get(mandate.candidateId).mandates.push(mandate)
  for (const record of records) get(record.candidateId).records.push(record)
  for (const vote of votes) get(vote.candidateId).votes.push(vote)
  return byCandidate
}

interface PoliticalMandateDbRow {
  candidate_id: string
  ano: number
  cargo: string
  uf: string | null
  municipio: string | null
  partido_sigla: string | null
  status: string
  turno: number
  sq_candidato: string | null
  updated_at: string
}

function toPoliticalMandateRow(row: PoliticalMandateDbRow): PoliticalMandate {
  return {
    candidateId: row.candidate_id,
    ano: row.ano,
    cargo: row.cargo,
    uf: row.uf,
    municipio: row.municipio,
    partidoSigla: row.partido_sigla,
    status: row.status as PoliticalMandate['status'],
    turno: row.turno,
    sqCandidato: row.sq_candidato,
  }
}

/**
 * Substitui todo o histórico de posições políticas (eleitos + suplentes) de
 * uma vez, em transação. O script de sincronização recalcula o conjunto inteiro.
 */
export function replacePoliticalMandates(db: DatabaseSync, data: PoliticalMandate[]): void {
  db.exec('BEGIN')
  try {
    db.prepare(`DELETE FROM political_mandates`).run()
    const stmt = db.prepare(
      `INSERT INTO political_mandates (
        candidate_id, ano, cargo, uf, municipio, partido_sigla, status, turno, sq_candidato, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    const now = new Date().toISOString()
    for (const mandate of data) {
      stmt.run(
        mandate.candidateId,
        mandate.ano,
        mandate.cargo,
        mandate.uf ?? null,
        mandate.municipio ?? null,
        mandate.partidoSigla ?? null,
        mandate.status,
        mandate.turno,
        mandate.sqCandidato ?? null,
        now,
      )
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

/** Posições políticas anteriores de um candidato (ordenadas por ano/cargo). */
export function getPoliticalMandates(
  db: DatabaseSync,
  candidateId: string,
): PoliticalMandate[] {
  return (
    db.prepare(
      `SELECT * FROM political_mandates WHERE candidate_id = ? ORDER BY ano, cargo`,
    ).all(candidateId) as unknown as PoliticalMandateDbRow[]
  ).map(toPoliticalMandateRow)
}

/** Mapa candidateId -> posições políticas anteriores (para server/export). */
export function listPoliticalMandates(db: DatabaseSync): Map<string, PoliticalMandate[]> {
  const rows = (
    db.prepare(`SELECT * FROM political_mandates ORDER BY ano, cargo`).all() as unknown as PoliticalMandateDbRow[]
  )
  const byCandidate = new Map<string, PoliticalMandate[]>()
  for (const row of rows) {
    const mandate = toPoliticalMandateRow(row)
    const list = byCandidate.get(mandate.candidateId)
    if (list) {
      list.push(mandate)
    } else {
      byCandidate.set(mandate.candidateId, [mandate])
    }
  }
  return byCandidate
}
/* ------------------------------------------------------------------ *
 * Camada municipal (§9): registro das Câmaras, cadastros de legislators,
 * candidato -> vereador e mandatos com período efetivo.
 *
 * Ficam em tabelas separadas de `political_mandates` porque são fatos
 * diferentes: lá, o TSE prova que a pessoa *foi candidata* a vereador; aqui, a
 * Câmara diz quem *exerceu* e quando. Misturar os dois faria a ficha afirmar
 * mandato onde houve apenas candidatura.
 * ------------------------------------------------------------------ */

export interface MunicipalChamberDbRow {
  municipality_ibge_code: string
  municipality_name: string
  state: string
  chamber_name: string
  chamber_url: string | null
  source_type: string
  api_base_url: string | null
  access: string
  capabilities_json: string
  last_verified_at: string | null
  note: string | null
  updated_at: string
}

export interface MunicipalIdentityDbRow {
  candidate_id: string
  source_id: string
  source_person_id: string | null
  municipality_ibge_code: string
  full_name: string
  matching_status: string
  matching_method: string
  matching_evidence: string | null
  verified_at: string
  updated_at: string
}

export interface MunicipalMandateDbRow {
  source_id: string
  source_mandate_id: string
  source_person_id: string | null
  legislature_id: string | null
  municipality_ibge_code: string
  office: string
  legislature_label: string | null
  start_date: string | null
  end_date: string | null
  titular: number | null
  party: string | null
  roles_json: string
  source_json: string
  updated_at: string
}

/** Substitui o registro de Câmaras inteiro, de forma transacional. */
export function replaceMunicipalChambers(
  db: DatabaseSync,
  chambers: readonly MunicipalChamberSource[],
): void {
  db.exec('BEGIN')
  try {
    db.prepare(`DELETE FROM municipal_chambers`).run()
    const stmt = db.prepare(
      `INSERT INTO municipal_chambers (
        municipality_ibge_code, municipality_name, state, chamber_name,
        chamber_url, source_type, api_base_url, access, capabilities_json,
        last_verified_at, note, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    const now = new Date().toISOString()
    for (const chamber of chambers) {
      stmt.run(
        chamber.municipalityIbgeCode,
        chamber.municipalityName,
        chamber.state,
        chamber.chamberName,
        chamber.chamberUrl,
        chamber.sourceType,
        chamber.apiBaseUrl,
        chamber.access,
        JSON.stringify(chamber.capabilities),
        chamber.lastVerifiedAt,
        chamber.note ?? null,
        now,
      )
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

export function listMunicipalChambers(db: DatabaseSync): MunicipalChamberDbRow[] {
  return (
    db.prepare(`SELECT * FROM municipal_chambers ORDER BY municipality_name`).all() as unknown as MunicipalChamberDbRow[]
  )
}

/**
 * Substitui os vínculos **das fontes presentes na entrada**, por `sourceId`.
 *
 * Mesmo motivo de `replaceMunicipalMandates`: uma Câmara que falha não pode
 * apagar o que se sabia dela na execução anterior.
 */
export function replaceMunicipalIdentities(
  db: DatabaseSync,
  identities: readonly MunicipalLegislatorIdentity[],
): void {
  if (identities.length === 0) return
  const sourceIds = [...new Set(identities.map((i) => i.sourceId))]

  db.exec('BEGIN')
  try {
    const del = db.prepare(`DELETE FROM municipal_identities WHERE source_id = ?`)
    for (const sourceId of sourceIds) del.run(sourceId)
    const stmt = db.prepare(
      `INSERT INTO municipal_identities (
        candidate_id, source_id, source_person_id, municipality_ibge_code,
        full_name, matching_status, matching_method, matching_evidence,
        verified_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    const now = new Date().toISOString()
    for (const identity of identities) {
      stmt.run(
        identity.candidateId,
        identity.sourceId,
        identity.sourcePersonId,
        identity.municipalityIbgeCode,
        identity.fullName,
        identity.matchingStatus,
        identity.matchingMethod,
        identity.matchingEvidence,
        identity.verifiedAt,
        now,
      )
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

export function listMunicipalIdentities(db: DatabaseSync): MunicipalIdentityDbRow[] {
  return (
    db.prepare(`SELECT * FROM municipal_identities`).all() as unknown as MunicipalIdentityDbRow[]
  )
}

/** Mapa candidateId -> vínculos. Vínculo `unresolved` entra com `sourcePersonId` nulo. */
export function listMunicipalIdentitiesByCandidate(
  db: DatabaseSync,
): Map<string, MunicipalIdentityDbRow[]> {
  const byCandidate = new Map<string, MunicipalIdentityDbRow[]>()
  for (const row of listMunicipalIdentities(db)) {
    const list = byCandidate.get(row.candidate_id)
    if (list) list.push(row)
    else byCandidate.set(row.candidate_id, [row])
  }
  return byCandidate
}

/**
 * Substitui os mandatos **de uma fonte**, deixando as outras intactas.
 *
 * O escopo por `sourceId` importa: as Câmaras derrubam conexão com
 * frequência, e um `DELETE` global perderia os mandatos das câmaras que
 * funcionaram na última execução.
 */
export function replaceMunicipalMandates(
  db: DatabaseSync,
  mandates: readonly MunicipalMandate[],
): void {
  if (mandates.length === 0) return
  const sourceIds = [...new Set(mandates.map((m) => m.sourceId))]

  db.exec('BEGIN')
  try {
    const del = db.prepare(`DELETE FROM municipal_mandates WHERE source_id = ?`)
    for (const sourceId of sourceIds) del.run(sourceId)
    const stmt = db.prepare(
      `INSERT INTO municipal_mandates (
        source_id, source_mandate_id, source_person_id, legislature_id,
        municipality_ibge_code, office, legislature_label, start_date,
        end_date, titular, party, roles_json, source_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    const now = new Date().toISOString()
    for (const mandate of mandates) {
      stmt.run(
        mandate.sourceId,
        mandate.sourceMandateId,
        mandate.sourcePersonId,
        mandate.legislatureId === '' ? null : mandate.legislatureId,
        mandate.municipalityIbgeCode,
        mandate.office,
        mandate.legislatureLabel,
        mandate.startDate,
        mandate.endDate,
        mandate.titular === null ? null : bool(mandate.titular),
        mandate.party,
        JSON.stringify(mandate.roles),
        JSON.stringify(mandate.source),
        now,
      )
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

export function listMunicipalMandates(db: DatabaseSync): MunicipalMandateDbRow[] {
  return (
    db.prepare(`SELECT * FROM municipal_mandates ORDER BY municipality_ibge_code, start_date`).all() as unknown as MunicipalMandateDbRow[]
  )
}

export function getMunicipalMandatesByIbge(
  db: DatabaseSync,
  ibgeCode: string,
): MunicipalMandateDbRow[] {
  return (
    db.prepare(
      `SELECT * FROM municipal_mandates WHERE municipality_ibge_code = ? ORDER BY start_date`,
    ).all(ibgeCode) as unknown as MunicipalMandateDbRow[]
  )
}
