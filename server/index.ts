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
import type { DatabaseSync } from 'node:sqlite'
import { extname, join, normalize } from 'node:path'
import { openRepository, listCandidates, listIncumbents, getParliamentary, getPoliticalMandates, getMunicipalHistory, type IncumbentRow } from '../src/data-sources/repository.ts'
import { readEditorialFicha } from '../src/data-sources/parliament/editorial.ts'
import { defaultDataDir } from '../src/data-sources/tse/candidates.ts'
import { CURRENT_ELECTION, electionKey } from '../src/shared/elections.ts'
import type {
  ApiCandidate,
  ApiCandidatesResponse,
  ApiCandidateDetail,
  ApiEditorialField,
  ApiMandate,
  ApiMunicipalHistory,
  ApiMunicipalMatchStatus,
  ApiParliamentary,
  ApiParliamentaryRecord,
  ApiPoliticalMandate,
  ApiVote,
} from '../src/shared/api.ts'
import type { CandidateRecord } from '../src/shared/domain.ts'

const PORT = Number(process.env.PORT ?? 2027)
const DATA_DIR = defaultDataDir()

const electionFilter = {
  electionYear: CURRENT_ELECTION.year,
  state: CURRENT_ELECTION.state,
  office: CURRENT_ELECTION.office,
}

function toApiCandidate(
  candidate: CandidateRecord,
  incumbent: IncumbentRow | undefined,
): ApiCandidate {
  return {
    id: candidate.id,
    tseSequence: candidate.tseSequence,
    ballotName: candidate.ballotName,
    fullName: candidate.fullName,
    ballotNumber: candidate.ballotNumber,
    party: candidate.party,
    partyAcronym: candidate.partyAcronym,
    coalition: candidate.coalition,
    candidacyType: candidate.candidacyType,
    federation: candidate.federation,
    occupation: candidate.occupation,
    education: candidate.education,
    maritalStatus: candidate.maritalStatus,
    birthDate: candidate.birthDate,
    birthState: candidate.birthState,
    gender: candidate.gender,
    race: candidate.race,
    status: candidate.status,
    city: candidate.city,
    photoUrl: candidate.photoUrl,
    birthMunicipality: candidate.birthMunicipality,
    isReelection: candidate.isReelection,
    totalAssets: candidate.totalAssets,
    assetsDeclared: candidate.assetsDeclared,
    socialLinks: candidate.socialLinks,
    quilombola: candidate.quilombola,
    indigenousEthnicity: candidate.indigenousEthnicity,
    accountsDeclared: candidate.accountsDeclared,
    isIncumbent: incumbent !== undefined,
    camaraPartyAcronym: incumbent?.camaraPartyAcronym ?? null,
    source: candidate.source,
  }
}

async function toApiDetail(
  candidate: CandidateRecord,
  incumbent: IncumbentRow | undefined,
): Promise<ApiCandidateDetail> {
  const db = await openRepository(join(DATA_DIR, 'tse.db'))
  try {
    const { mandates, records, votes } = getParliamentary(db, candidate.id)
    const politicalMandates = getPoliticalMandates(db, candidate.id)
    const editorial = await readEditorialFicha(candidate.id)

    const parliamentary: ApiParliamentary | null =
      mandates.length === 0 && records.length === 0 && votes.length === 0
        ? null
        : {
            mandates: mandates.map(toApiMandate),
            records: records.map(toApiRecord),
            votes: votes.map(toApiVote),
          }

    return {
      ...toApiCandidate(candidate, incumbent),
      campaignStatus: candidate.campaignStatus,
      nationality: candidate.nationality,
      email: candidate.email,
      inBallot: candidate.inBallot,
      substituted: candidate.substituted,
      campaignSpendingCap: candidate.campaignSpendingCap,
      importedAt: candidate.importedAt,
      updatedAt: candidate.updatedAt,
      parliamentary,
      editorial: editorial ? toApiEditorial(editorial) : null,
      politicalMandates: politicalMandates.map(toApiPoliticalMandate),
      municipal: toApiMunicipalHistory(db, candidate.id),
    }
  } finally {
    db.close()
  }
}

function toApiMandate(mandate: Awaited<ReturnType<typeof getParliamentary>>['mandates'][number]): ApiMandate {
  return {
    casa: mandate.casa,
    legislatura: mandate.legislatura,
    idParlamentar: mandate.idParlamentar,
    nomeParlamentar: mandate.nomeParlamentar,
    partido: mandate.partido,
    uf: mandate.uf,
    dataInicio: mandate.dataInicio,
    dataFim: mandate.dataFim,
  }
}

/**
 * Monta o histórico municipal para a ficha.
 *
 * Vínculo `unresolved` não entra: ele significa "não consegui afirmar que é esta
 * pessoa", e mostrar a lista ali seria transformar uma dúvida em fato. O
 * registro continua no banco, com a evidência, para auditoria.
 */
function toApiMunicipalHistory(
  db: DatabaseSync,
  candidateId: string,
): ApiMunicipalHistory {
  const history = getMunicipalHistory(db, candidateId)

  const chamberName = new Map(
    (
      db.prepare(`SELECT municipality_ibge_code, chamber_name FROM municipal_chambers`).all() as unknown as Array<{
        municipality_ibge_code: string
        chamber_name: string
      }>
    ).map((row) => [row.municipality_ibge_code, row.chamber_name]),
  )

  const identities = history.identities
    .filter((row) => row.matching_status !== 'unresolved' && row.source_person_id !== null)
    .map((row) => ({
      sourceId: row.source_id,
      municipalityName: chamberName.get(row.municipality_ibge_code) ?? row.municipality_ibge_code,
      matchingStatus: row.matching_status as ApiMunicipalMatchStatus,
      matchingEvidence: row.matching_evidence,
      mandates: (history.mandates.get(row.source_person_id as string) ?? [])
        .map((mandate) => {
          const source = JSON.parse(mandate.source_json) as {
            url: string
            publisher: string
          }
          return {
            sourceId: mandate.source_id,
            municipalityName: chamberName.get(mandate.municipality_ibge_code) ?? '',
            legislatureLabel: mandate.legislature_label,
            startDate: mandate.start_date,
            endDate: mandate.end_date,
            titular: mandate.titular === null ? null : mandate.titular === 1,
            party: mandate.party,
            sourceUrl: source.url,
            sourcePublisher: source.publisher,
          }
        })
        .sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? '')),
    }))

  return {
    coverage: history.coverage,
    coverageNote: history.coverageNote,
    identities,
  }
}

function toApiPoliticalMandate(
  mandate: Awaited<ReturnType<typeof getPoliticalMandates>>[number],
): ApiPoliticalMandate {
  return {
    ano: mandate.ano,
    cargo: mandate.cargo,
    uf: mandate.uf,
    municipio: mandate.municipio,
    partidoSigla: mandate.partidoSigla,
    status: mandate.status,
    turno: mandate.turno,
  }
}

function toApiRecord(record: Awaited<ReturnType<typeof getParliamentary>>['records'][number]): ApiParliamentaryRecord {
  return {
    casa: record.casa,
    proposicoesPorAno: record.proposicoesPorAno,
    comissoes: record.comissoes.map((comissao) => ({ sigla: comissao.sigla, nome: comissao.nome })),
    despesasPorAno: record.despesasPorAno,
  }
}

function toApiVote(vote: Awaited<ReturnType<typeof getParliamentary>>['votes'][number]): ApiVote {
  return {
    votacaoId: vote.votacaoId,
    tema: vote.tema,
    rotulo: vote.rotulo,
    proposicao: vote.proposicao,
    data: vote.data,
    casa: vote.casa,
    voto: vote.voto,
  }
}

function toApiEditorial(
  editorial: Awaited<ReturnType<typeof readEditorialFicha>>,
): Record<string, ApiEditorialField> {
  const result: Record<string, ApiEditorialField> = {}
  for (const [tema, campo] of Object.entries(editorial?.campos ?? {})) {
    if (!campo) continue
    result[tema] = { valor: campo.valor, tipo: campo.tipo, fonte: campo.fonte }
  }
  return result
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
      const incumbents = listIncumbents(db)
      const candidates = listCandidates(db, electionFilter).map((c) =>
        toApiCandidate(c, incumbents.get(c.id)),
      )
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
      const incumbent = listIncumbents(db).get(id)
      sendJson(res, 200, await toApiDetail(row, incumbent))
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