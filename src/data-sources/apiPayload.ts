/**
 * Payload da API, montado a partir do SQLite.
 *
 * Fonte única do formato: o mesmo módulo alimenta a API HTTP
 * (`server/index.ts`) e o build estático (`scripts/prerender.ts`), então a
 * ficha pré-renderizada e a que a API devolve são idênticas — é o que garante
 * que a hidratação do React não encontre markup diferente.
 */

import type { DatabaseSync } from 'node:sqlite'
import {
  getActiveCandidate,
  getParliamentary,
  getPoliticalMandates,
  listCandidates,
  listIncumbents,
  listQuizMetrics,
  listQuizPositions,
  type ElectionFilter,
  type IncumbentRow,
  type QuizMetricRow,
  type QuizPositionRow,
} from './repository.ts'
import { readEditorialFicha } from './parliament/editorial.ts'
import { electionFor, isFederationUnit } from '../shared/elections.ts'
import type {
  ApiCandidate,
  ApiCandidateDetail,
  ApiCandidatesResponse,
  ApiEditorialField,
  ApiMandate,
  ApiParliamentary,
  ApiParliamentaryRecord,
  ApiPoliticalMandate,
  ApiQuizMetrics,
  ApiQuizPosition,
  ApiVote,
} from '../shared/api.ts'
import type { CandidateRecord } from '../shared/domain.ts'

/** Filtro da lista de uma UF. `null` quando a sigla não é uma UF. */
export function filterForState(state: string): ElectionFilter | null {
  if (!isFederationUnit(state)) return null
  const election = electionFor(state)
  return {
    electionYear: election.year,
    state: election.state,
    office: election.office,
  }
}

function toApiQuizPosition(row: QuizPositionRow): ApiQuizPosition {
  return {
    pautaId: row.pautaId,
    value: row.value,
    origin: row.origin,
    voto: row.voto,
    partyAcronym: row.partyAcronym,
    sourceUrl: row.sourceUrl,
  }
}

function toApiQuizMetrics(row: QuizMetricRow | undefined): ApiQuizMetrics | null {
  if (!row) return null
  return {
    alinhamentoGoverno: row.alinhamentoGoverno,
    alinhamentoOrigem: row.alinhamentoOrigem,
    trajetoria: row.trajetoria,
  }
}

export function toApiCandidate(
  candidate: CandidateRecord,
  incumbent: IncumbentRow | undefined,
  positions: readonly QuizPositionRow[] = [],
  metrics?: QuizMetricRow,
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
    quizPositions: positions.map(toApiQuizPosition),
    quizMetrics: toApiQuizMetrics(metrics),
    source: candidate.source,
  }
}

function toApiMandate(
  mandate: ReturnType<typeof getParliamentary>['mandates'][number],
): ApiMandate {
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

function toApiPoliticalMandate(
  mandate: ReturnType<typeof getPoliticalMandates>[number],
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

function toApiRecord(
  record: ReturnType<typeof getParliamentary>['records'][number],
): ApiParliamentaryRecord {
  return {
    casa: record.casa,
    proposicoesPorAno: record.proposicoesPorAno,
    comissoes: record.comissoes.map((comissao) => ({
      sigla: comissao.sigla,
      nome: comissao.nome,
    })),
    despesasPorAno: record.despesasPorAno,
  }
}

function toApiVote(
  vote: ReturnType<typeof getParliamentary>['votes'][number],
): ApiVote {
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

/** Lista da eleição configurada, com a incumbência da Câmara. */
export function buildCandidatesPayload(
  db: DatabaseSync,
  filter: ElectionFilter,
): ApiCandidatesResponse {
  const incumbents = listIncumbents(db)
  const positions = listQuizPositions(db)
  const metrics = listQuizMetrics(db)
  const candidates = listCandidates(db, filter).map((candidate) =>
    toApiCandidate(
      candidate,
      incumbents.get(candidate.id),
      positions.get(candidate.id) ?? [],
      metrics.get(candidate.id),
    ),
  )
  return {
    election: {
      year: filter.electionYear,
      state: filter.state,
      office: filter.office,
    },
    total: candidates.length,
    candidates,
  }
}

/** Ficha completa de um candidato, ou `null` se ele não está na eleição. */
export async function buildCandidateDetailPayload(
  db: DatabaseSync,
  id: string,
): Promise<ApiCandidateDetail | null> {
  const candidate = getActiveCandidate(db, id)
  if (!candidate) return null

  const incumbent = listIncumbents(db).get(id)
  const positions = listQuizPositions(db).get(id) ?? []
  const metrics = listQuizMetrics(db).get(id)
  const { mandates, records, votes } = getParliamentary(db, id)
  const politicalMandates = getPoliticalMandates(db, id)
  const editorial = await readEditorialFicha(id)

  const parliamentary: ApiParliamentary | null =
    mandates.length === 0 && records.length === 0 && votes.length === 0
      ? null
      : {
          mandates: mandates.map(toApiMandate),
          records: records.map(toApiRecord),
          votes: votes.map(toApiVote),
        }

  return {
    ...toApiCandidate(candidate, incumbent, positions, metrics),
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
  }
}
