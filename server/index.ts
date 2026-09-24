/**
 * API HTTP (node:http) que serve os dados ingeridos do TSE.
 *
 * Endpoints:
 *   GET /api/health
 *   GET /api/candidates                 (lista da eleição configurada)
 *   GET /api/candidates/:id             (detalhe)
 *   GET /photos/*                       (fotos locais)
 *
 * Execução: node --experimental-sqlite --experimental-strip-types server/index.ts
 */

import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { openRepository, listCandidates } from '../src/data-sources/repository.ts'
import { defaultDataDir } from '../src/data-sources/tse/candidates.ts'
import { CURRENT_ELECTION, electionKey } from '../src/shared/elections.ts'
import type { ApiCandidate, ApiCandidatesResponse, ApiCandidateDetail } from '../src/shared/api.ts'
import type { CandidateRecord } from '../src/shared/domain.ts'

const PORT = Number(process.env.PORT ?? 2027)
const DATA_DIR = defaultDataDir()

const electionFilter = {
  electionYear: CURRENT_ELECTION.year,
  state: CURRENT_ELECTION.state,
  office: CURRENT_ELECTION.office,
}

function toApiCandidate(candidate: CandidateRecord): ApiCandidate {
  return {
    id: candidate.id,
    tseSequence: candidate.tseSequence,
    ballotName: candidate.ballotName,
    fullName: candidate.fullName,
    ballotNumber: candidate.ballotNumber,
    party: candidate.party,
    partyAcronym: candidate.partyAcronym,
    coalition: candidate.coalition,
    status: candidate.status,
    city: candidate.city,
    photoUrl: candidate.photoUrl,
    source: candidate.source,
  }
}

function toApiDetail(candidate: CandidateRecord): ApiCandidateDetail {
  return {
    ...toApiCandidate(candidate),
    campaignStatus: candidate.campaignStatus,
    candidacyType: candidate.candidacyType,
    occupation: candidate.occupation,
    education: candidate.education,
    birthDate: candidate.birthDate,
    gender: candidate.gender,
    race: candidate.race,
    nationality: candidate.nationality,
    email: candidate.email,
    totalAssets: candidate.totalAssets,
    importedAt: candidate.importedAt,
    updatedAt: candidate.updatedAt,
  }
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}

function sendError(res: ServerResponse, status: number, message: string): void {
  sendJson(res, status, { error: message })
}

function parseUrlPath(req: IncomingMessage): string {
  return new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`).pathname
}

const PHOTO_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
}

async function servePhoto(res: ServerResponse, urlPath: string): Promise<void> {
  const relative = decodeURIComponent(urlPath.slice('/photos/'.length))
  const normalized = normalize(relative)
  if (
    normalized.startsWith('..') ||
    normalized.includes('..') ||
    normalized.startsWith('/')
  ) {
    sendError(res, 400, 'caminho inválido')
    return
  }

  const filePath = join(DATA_DIR, 'photos', normalized)
  let meta
  try {
    meta = await stat(filePath)
    if (!meta.isFile()) throw new Error('não é um arquivo')
  } catch {
    sendError(res, 404, 'foto não encontrada')
    return
  }

  const type = PHOTO_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
  res.writeHead(200, {
    'content-type': type,
    'cache-control': 'public, max-age=86400',
    'content-length': meta.size,
  })
  createReadStream(filePath).pipe(res)
}

async function handleApi(res: ServerResponse, urlPath: string): Promise<void> {
  if (urlPath === '/api/health') {
    sendJson(res, 200, { status: 'ok', election: electionKey(CURRENT_ELECTION) })
    return
  }

  if (urlPath === '/api/candidates') {
    const db = await openRepository(join(DATA_DIR, 'tse.db'))
    try {
      const candidates = listCandidates(db, electionFilter).map(toApiCandidate)
      const payload: ApiCandidatesResponse = {
        election: {
          year: CURRENT_ELECTION.year,
          state: CURRENT_ELECTION.state,
          office: CURRENT_ELECTION.office,
        },
        total: candidates.length,
        candidates,
      }
      sendJson(res, 200, payload)
    } finally {
      db.close()
    }
    return
  }

  const detailMatch = /^\/api\/candidates\/([^/]+)$/.exec(urlPath)
  if (detailMatch) {
    const db = await openRepository(join(DATA_DIR, 'tse.db'))
    try {
      const id = decodeURIComponent(detailMatch[1])
      const row = listCandidates(db, electionFilter).find((c) => c.id === id)
      if (!row) {
        sendError(res, 404, 'candidato não encontrado')
        return
      }
      sendJson(res, 200, toApiDetail(row))
    } finally {
      db.close()
    }
    return
  }

  sendError(res, 404, 'rota não encontrada')
}

const server = createServer(async (req, res) => {
  try {
    const urlPath = parseUrlPath(req)

    if (urlPath.startsWith('/api/')) {
      await handleApi(res, urlPath)
      return
    }

    if (urlPath.startsWith('/photos/')) {
      await servePhoto(res, urlPath)
      return
    }

    sendError(res, 404, 'rota não encontrada')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    sendError(res, 500, message)
  }
})

server.listen(PORT, () => {
  console.log(`[api] ouvindo em http://localhost:${PORT} (dados em ${DATA_DIR})`)
})