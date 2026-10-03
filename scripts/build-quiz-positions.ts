/**
 * Grava quiz_positions e quiz_metrics a partir de content/quiz/pautas-quiz.json
 * e do plenário já sincronizado.
 *
 * Execução: node --experimental-sqlite --experimental-strip-types
 *   scripts/build-quiz-positions.ts
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import type { VotoValor } from '../src/data-sources/parliament/types.ts'
import {
  openRepository,
  replaceQuizDerived,
  type QuizMetricRow,
  type QuizPositionRow,
} from '../src/data-sources/repository.ts'
import { defaultDataDir } from '../src/data-sources/tse/candidates.ts'
import type { PartyLineage, Stance } from '../src/data-sources/quiz/lineage.ts'
import {
  governoStance,
  resolvePartyStance,
} from '../src/data-sources/quiz/lineage.ts'
import {
  alignmentRate,
  LEG_57_FROM,
  resolvePosition,
  trajetoriaCount,
} from '../src/data-sources/quiz/positions.ts'
import { parsePautasQuiz, type PautaQuiz } from '../src/shared/quiz-pautas.ts'
import { CURRENT_ELECTION } from '../src/shared/elections.ts'

const DATA_DIR = defaultDataDir()
const lineage = JSON.parse(
  await readFile(new URL('../content/quiz/party-lineage.json', import.meta.url), 'utf8'),
) as PartyLineage
const pautas = parsePautasQuiz(
  JSON.parse(
    await readFile(new URL('../content/quiz/pautas-quiz.json', import.meta.url), 'utf8'),
  ),
)

interface CandidateRow {
  id: string
  party_acronym: string | null
  federation: string | null
}

interface OrientationRow {
  votacao_id: string
  sigla: string
  stance: Stance | null
}

function orientationsFor(
  rows: readonly OrientationRow[],
  votacaoId: string,
): { sigla: string; stance: Stance | null }[] {
  return rows
    .filter((row) => row.votacao_id === votacaoId)
    .map((row) => ({ sigla: row.sigla, stance: row.stance }))
}

function stanceMap(
  rows: readonly { sigla: string; stance: Stance | null }[],
): Map<string, Stance> {
  const map = new Map<string, Stance>()
  for (const row of rows) {
    if (row.stance) map.set(row.sigla, row.stance)
  }
  return map
}

function load(db: DatabaseSync) {
  const candidates = db
    .prepare(
      `SELECT id, party_acronym, federation FROM candidates
       WHERE is_active = 1 AND election_year = ? AND state = ? AND office = ?`,
    )
    .all(
      CURRENT_ELECTION.year,
      CURRENT_ELECTION.state,
      CURRENT_ELECTION.office,
    ) as unknown as CandidateRow[]

  const incumbentIds = new Set<string>()
  const camaraByCandidate = new Map<string, number>()
  for (const row of db.prepare(`SELECT candidate_id, camara_id FROM incumbents`).all() as unknown as Array<{
    candidate_id: string
    camara_id: number
  }>) {
    incumbentIds.add(row.candidate_id)
    camaraByCandidate.set(row.candidate_id, row.camara_id)
  }
  for (const row of db
    .prepare(
      `SELECT candidate_id, id_parlamentar FROM parliamentary_mandates WHERE casa = 'camara'`,
    )
    .all() as unknown as Array<{ candidate_id: string; id_parlamentar: number }>) {
    if (!camaraByCandidate.has(row.candidate_id)) {
      camaraByCandidate.set(row.candidate_id, row.id_parlamentar)
    }
  }

  const history = new Map<string, { total: number; currentFederal: number }>()
  for (const row of db
    .prepare(
      `SELECT candidate_id,
              COUNT(*) AS total,
              SUM(CASE WHEN cargo LIKE '%DEPUTADO FEDERAL%' AND ano >= 2022 THEN 1 ELSE 0 END) AS current_federal
       FROM political_mandates GROUP BY candidate_id`,
    )
    .all() as unknown as Array<{
    candidate_id: string
    total: number
    current_federal: number
  }>) {
    history.set(row.candidate_id, {
      total: row.total,
      currentFederal: row.current_federal,
    })
  }

  const pautaIds = pautas.map((pauta) => pauta.votacaoId)
  const placeholders = pautaIds.map(() => '?').join(',')
  const pautaOrientations =
    pautaIds.length === 0
      ? []
      : (db
          .prepare(
            `SELECT votacao_id, sigla, stance FROM plenary_orientations
             WHERE votacao_id IN (${placeholders})`,
          )
          .all(...pautaIds) as unknown as OrientationRow[])

  const personalByVote = new Map<string, Map<number, VotoValor>>()
  if (pautaIds.length > 0) {
    for (const row of db
      .prepare(
        `SELECT votacao_id, camara_id, voto FROM plenary_votes
         WHERE votacao_id IN (${placeholders})`,
      )
      .all(...pautaIds) as unknown as Array<{
      votacao_id: string
      camara_id: number
      voto: VotoValor
    }>) {
      let map = personalByVote.get(row.votacao_id)
      if (!map) {
        map = new Map()
        personalByVote.set(row.votacao_id, map)
      }
      map.set(row.camara_id, row.voto)
    }
  }

  const alignmentVotes = db
    .prepare(
      `SELECT v.id, v.data, o.sigla, o.stance
       FROM plenary_votacoes v
       JOIN plenary_orientations o ON o.votacao_id = v.id
       WHERE v.data >= ? AND o.stance IS NOT NULL`,
    )
    .all(LEG_57_FROM) as unknown as Array<{
    id: string
    data: string
    sigla: string
    stance: Stance
  }>

  const alignmentIds = [...new Set(alignmentVotes.map((row) => row.id))]
  const personalAlignment = new Map<string, Map<number, VotoValor>>()
  const chunk = 400
  for (let offset = 0; offset < alignmentIds.length; offset += chunk) {
    const slice = alignmentIds.slice(offset, offset + chunk)
    const marks = slice.map(() => '?').join(',')
    for (const row of db
      .prepare(
        `SELECT votacao_id, camara_id, voto FROM plenary_votes
         WHERE votacao_id IN (${marks})`,
      )
      .all(...slice) as unknown as Array<{
      votacao_id: string
      camara_id: number
      voto: VotoValor
    }>) {
      let map = personalAlignment.get(row.votacao_id)
      if (!map) {
        map = new Map()
        personalAlignment.set(row.votacao_id, map)
      }
      map.set(row.camara_id, row.voto)
    }
  }

  const alignmentByVote = new Map<
    string,
    { data: string; rows: { sigla: string; stance: Stance | null }[] }
  >()
  for (const row of alignmentVotes) {
    const entry = alignmentByVote.get(row.id)
    const item = { sigla: row.sigla, stance: row.stance }
    if (entry) entry.rows.push(item)
    else alignmentByVote.set(row.id, { data: row.data, rows: [item] })
  }

  return {
    candidates,
    incumbentIds,
    camaraByCandidate,
    history,
    pautaOrientations,
    personalByVote,
    alignmentByVote,
    personalAlignment,
  }
}

function alignmentFor(
  party: string | null,
  camaraId: number | null,
  alignmentByVote: Map<
    string,
    { data: string; rows: { sigla: string; stance: Stance | null }[] }
  >,
  personalAlignment: Map<string, Map<number, VotoValor>>,
): { rate: number | null; origem: 'candidato' | 'partido' | null } {
  const personal: { stance: Stance; governo: Stance }[] = []
  const partyComparisons: { stance: Stance; governo: Stance }[] = []
  for (const [votacaoId, vote] of alignmentByVote) {
    const governo = governoStance(vote.rows)
    if (!governo) continue
    const partySide = resolvePartyStance(
      party,
      stanceMap(vote.rows),
      vote.data,
      lineage,
    )
    if (partySide) partyComparisons.push({ stance: partySide, governo })
    if (camaraId !== null) {
      const voto = personalAlignment.get(votacaoId)?.get(camaraId)
      const side = voto === 'Sim' ? 'sim' : voto === 'Não' ? 'nao' : null
      if (side) personal.push({ stance: side, governo })
    }
  }

  const personalRate = alignmentRate(personal)
  if (personalRate !== null) return { rate: personalRate, origem: 'candidato' }
  const partyRate = alignmentRate(partyComparisons)
  if (partyRate !== null) return { rate: partyRate, origem: 'partido' }
  return { rate: null, origem: null }
}

function positionFor(
  pauta: PautaQuiz,
  party: string | null,
  camaraId: number | null,
  pautaOrientations: OrientationRow[],
  personalByVote: Map<string, Map<number, VotoValor>>,
): QuizPositionRow {
  const rows = orientationsFor(pautaOrientations, pauta.votacaoId)
  const partySide = resolvePartyStance(party, stanceMap(rows), pauta.data, lineage)
  const personal =
    camaraId === null
      ? undefined
      : personalByVote.get(pauta.votacaoId)?.get(camaraId)
  const resolved = resolvePosition(personal, partySide)
  return {
    candidateId: '',
    pautaId: pauta.id,
    value: resolved.value,
    origin: resolved.origin,
    voto: resolved.voto,
    partyAcronym: party,
    sourceUrl: pauta.source,
  }
}

const db = await openRepository(join(DATA_DIR, 'tse.db'))
try {
  const data = load(db)
  const positions: QuizPositionRow[] = []
  const metrics: QuizMetricRow[] = []
  for (const candidate of data.candidates) {
    const camaraId = data.camaraByCandidate.get(candidate.id) ?? null
    for (const pauta of pautas) {
      const row = positionFor(
        pauta,
        candidate.party_acronym,
        camaraId,
        data.pautaOrientations,
        data.personalByVote,
      )
      row.candidateId = candidate.id
      positions.push(row)
    }
    const past = data.history.get(candidate.id)
    const alignment = alignmentFor(
      candidate.party_acronym,
      camaraId,
      data.alignmentByVote,
      data.personalAlignment,
    )
    metrics.push({
      candidateId: candidate.id,
      alinhamentoGoverno: alignment.rate,
      alinhamentoOrigem: alignment.origem,
      trajetoria: trajetoriaCount(
        past?.total ?? 0,
        data.incumbentIds.has(candidate.id) && (past?.currentFederal ?? 0) === 0,
      ),
    })
  }
  replaceQuizDerived(db, positions, metrics)
  console.log(
    `[quiz] ${positions.length} posições e ${metrics.length} métricas para ${pautas.length} pautas`,
  )
} finally {
  db.close()
}
