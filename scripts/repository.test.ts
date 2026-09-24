import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import type { CandidateRecord } from '../src/shared/domain.ts'
import {
  deactivateMissing,
  getCandidate,
  listCandidates,
  prepareDatabase,
  setPhotoUrls,
  storeRaw,
  upsertCandidate,
  writeSyncLog,
} from '../src/data-sources/repository.ts'

const FILTER = { electionYear: 2026, state: 'PR', office: 'DEPUTADO FEDERAL' }

function openDatabase(): DatabaseSync {
  const db = new DatabaseSync(':memory:')
  prepareDatabase(db)
  return db
}

function makeCandidate(overrides: Partial<CandidateRecord> = {}): CandidateRecord {
  const base: CandidateRecord = {
    id: '2026-PR-1',
    tseSequence: '1',
    electionYear: 2026,
    state: 'PR',
    office: 'DEPUTADO FEDERAL',
    ballotName: 'ANA PARTICIPANTE',
    fullName: 'ANA PARTICIPANTE TESTE',
    ballotNumber: '101',
    party: 'Partido Teste',
    partyAcronym: 'PTE',
    coalition: null,
    status: 'APTO',
    campaignStatus: null,
    candidacyType: null,
    occupation: null,
    education: null,
    birthDate: null,
    gender: null,
    race: null,
    nationality: null,
    city: 'CURITIBA',
    email: null,
    website: null,
    socialLinks: [],
    photoUrl: null,
    totalAssets: null,
    source: {
      provider: 'TSE',
      url: 'https://exemplo.com/cand.zip',
      dataset: 'consultas_candidatos',
      sourceFile: 'consulta_cand_2026_PR.csv',
      retrievedAt: '2026-09-01T00:00:00.000Z',
      sourceUpdatedAt: null,
    },
    importedAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  }
  return { ...base, ...overrides }
}

test('upsertCandidate insere, atualiza e mantém inalterado', () => {
  const db = openDatabase()

  assert.equal(upsertCandidate(db, makeCandidate()).status, 'inserted')
  assert.equal(upsertCandidate(db, makeCandidate()).status, 'unchanged')

  const changed = makeCandidate({ city: 'LONDRINA', updatedAt: '2026-09-02T00:00:00.000Z' })
  assert.equal(upsertCandidate(db, changed).status, 'updated')

  const stored = getCandidate(db, '2026-PR-1')
  assert.equal(stored?.city, 'LONDRINA')
  assert.equal(stored?.updatedAt, '2026-09-02T00:00:00.000Z')
  assert.equal(stored?.source.url, 'https://exemplo.com/cand.zip')
})

test('deactivateMissing marca removidos e lista apenas ativos', () => {
  const db = openDatabase()
  upsertCandidate(db, makeCandidate({ id: '2026-PR-1', tseSequence: '1' }))
  upsertCandidate(db, makeCandidate({ id: '2026-PR-2', tseSequence: '2', ballotName: 'BIA' }))

  const removed = deactivateMissing(db, FILTER, ['2026-PR-1'])
  assert.equal(removed, 1)

  const active = listCandidates(db, FILTER).map((c) => c.id)
  assert.deepEqual(active, ['2026-PR-1'])
})

test('storeRaw preserva a linha original em JSON', () => {
  const db = openDatabase()
  upsertCandidate(db, makeCandidate())
  storeRaw(db, '2026-PR-1', ['2026', 'PR', 'DEPUTADO FEDERAL', '1'])
  storeRaw(db, '2026-PR-1', ['2026', 'PR', 'DEPUTADO FEDERAL', '1', 'atualizado'])

  const row = db.prepare('SELECT raw_json FROM candidates_raw WHERE id = ?').get('2026-PR-1') as {
    raw_json: string
  }
  const parsed = JSON.parse(row.raw_json) as string[]
  assert.deepEqual(parsed, ['2026', 'PR', 'DEPUTADO FEDERAL', '1', 'atualizado'])
})

test('setPhotoUrls atualiza o caminho das fotos', () => {
  const db = openDatabase()
  upsertCandidate(db, makeCandidate())
  setPhotoUrls(db, [{ id: '2026-PR-1', photoUrl: '/photos/1.jpg' }])

  assert.equal(getCandidate(db, '2026-PR-1')?.photoUrl, '/photos/1.jpg')
})

test('writeSyncLog registra a sincronização', () => {
  const db = openDatabase()
  writeSyncLog(db, {
    election: '2026:PR:DEPUTADO FEDERAL',
    dataset: 'consultas_candidatos',
    url: 'https://exemplo.com/cand.zip',
    validator: 'abc',
    sourceFile: 'consulta_cand_2026_PR.csv',
    retrievedAt: '2026-09-01T00:00:00.000Z',
    rowsRead: 10,
    rowsKept: 2,
    rowsInserted: 2,
    rowsUpdated: 0,
    rowsDeleted: 0,
    status: 'success',
    error: null,
  })

  const count = db.prepare('SELECT COUNT(*) AS n FROM sync_log').get() as { n: number }
  assert.equal(Number(count.n), 1)
})

test('listCandidates ordena por nome de urna', () => {
  const db = openDatabase()
  upsertCandidate(db, makeCandidate({ id: '2026-PR-1', ballotName: 'ZÉ' }))
  upsertCandidate(db, makeCandidate({ id: '2026-PR-2', ballotName: 'ANA' }))
  upsertCandidate(db, makeCandidate({ id: '2026-PR-3', ballotName: 'BIA' }))

  const names = listCandidates(db, FILTER).map((c) => c.ballotName)
  assert.deepEqual(names, ['ANA', 'BIA', 'ZÉ'])
})