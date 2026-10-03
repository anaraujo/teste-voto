/**
 * API HTTP (node:http) que serve os dados ingeridos do TSE.
 *
 * Endpoints:
 *   GET /api/health
 *   GET /api/candidates                 (lista da eleição configurada)
 *   GET /api/candidates/:id             (detalhe)
 *   GET /photos/*                       (fotos locais)
 *   GET /*                              (SPA em dist/ quando SERVE_STATIC=true)
 *
 * O payload é montado em `src/data-sources/apiPayload.ts`, o mesmo módulo que
 * alimenta o build estático — assim a ficha pré-renderizada e a resposta da
 * API são idênticas.
 *
 * Execução: node --experimental-sqlite --experimental-strip-types server/index.ts
 * Produção: SERVE_STATIC=true no container (Cloud Run); dev inalterado (Vite proxy).
 */

import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http'
import { dirname, extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openRepository } from '../src/data-sources/repository.ts'
import {
  buildCandidateDetailPayload,
  buildCandidatesPayload,
} from '../src/data-sources/apiPayload.ts'
import { defaultDataDir } from '../src/data-sources/tse/candidates.ts'
import { CURRENT_ELECTION, electionKey } from '../src/shared/elections.ts'

const PORT = Number(process.env.PORT ?? 2027)
const DATA_DIR = defaultDataDir()
const SERVE_STATIC = process.env.SERVE_STATIC === 'true'
const DIST_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')

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
  return new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
    .pathname
}

const PHOTO_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
}

const STATIC_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function isUnsafeRelative(relativePath: string): boolean {
  const normalized = normalize(relativePath)
  return (
    normalized.startsWith('..') ||
    normalized.includes(`..${sep}`) ||
    normalized.includes('../') ||
    normalized.startsWith('/')
  )
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

  const type =
    PHOTO_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
  res.writeHead(200, {
    'content-type': type,
    'cache-control': 'public, max-age=86400',
    'content-length': meta.size,
  })
  createReadStream(filePath).pipe(res)
}

function sendFile(res: ServerResponse, filePath: string, meta: { size: number }): void {
  const type = STATIC_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
  res.writeHead(200, {
    'content-type': type,
    'cache-control': 'public, max-age=3600',
    'content-length': meta.size,
  })
  createReadStream(filePath).pipe(res)
}

/** Serve dist/ com fallback SPA (index.html) para rotas desconhecidas. */
async function serveStatic(res: ServerResponse, urlPath: string): Promise<void> {
  const indexPath = join(DIST_DIR, 'index.html')

  if (urlPath === '/' || urlPath === '') {
    try {
      const meta = await stat(indexPath)
      if (meta.isFile()) {
        sendFile(res, indexPath, meta)
        return
      }
    } catch {
      // cai no 404 abaixo
    }
    sendError(res, 404, 'dist/ não encontrado — rode npm run build')
    return
  }

  const relative = decodeURIComponent(urlPath.slice(1))
  if (isUnsafeRelative(relative)) {
    sendError(res, 400, 'caminho inválido')
    return
  }

  const filePath = join(DIST_DIR, relative)
  try {
    const meta = await stat(filePath)
    if (meta.isFile()) {
      sendFile(res, filePath, meta)
      return
    }
  } catch {
    // SPA fallback
  }

  try {
    const meta = await stat(indexPath)
    if (meta.isFile()) {
      sendFile(res, indexPath, meta)
      return
    }
  } catch {
    // sem index.html
  }
  sendError(res, 404, 'arquivo não encontrado')
}

async function handleApi(res: ServerResponse, urlPath: string): Promise<void> {
  if (urlPath === '/api/health') {
    sendJson(res, 200, {
      status: 'ok',
      election: electionKey(CURRENT_ELECTION),
    })
    return
  }

  if (urlPath === '/api/candidates') {
    const db = await openRepository(join(DATA_DIR, 'tse.db'))
    try {
      sendJson(res, 200, buildCandidatesPayload(db))
    } finally {
      db.close()
    }
    return
  }

  const detailMatch = /^\/api\/candidates\/([^/]+)$/.exec(urlPath)
  if (detailMatch) {
    const id = decodeURIComponent(detailMatch[1])
    const db = await openRepository(join(DATA_DIR, 'tse.db'))
    try {
      const detail = await buildCandidateDetailPayload(db, id)
      if (!detail) {
        sendError(res, 404, 'candidato não encontrado')
        return
      }
      sendJson(res, 200, detail)
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

    if (SERVE_STATIC) {
      await serveStatic(res, urlPath)
      return
    }

    sendError(res, 404, 'rota não encontrada')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    sendError(res, 500, message)
  }
})

server.listen(PORT, () => {
  console.log(
    `[api] ouvindo em http://localhost:${PORT} (dados em ${DATA_DIR})`,
  )
})
