/**
 * Auditoria do quiz por amostragem (diagnóstico, não corrige nada).
 *
 * Com as perguntas de votação, enumerar todas as combinações deixou de caber.
 * Para cada UF no banco, sorteia 50 mil respostas com semente fixa e verifica:
 *   - nenhum candidato vence mais de ~5% das amostras;
 *   - a fatia de vitórias de cada partido fica perto da fatia de candidatos;
 *   - cobertura por opção, com "sem dado" explícito.
 */

import { DatabaseSync } from 'node:sqlite'
import type { Candidate, OptionId } from '../src/data/quiz.ts'
import {
  buildFacts,
  buildProfile,
  questionsFor,
} from '../src/data/quiz-source.ts'
import { stateByCode } from '../src/data/brazil-map.ts'
import {
  AUDIT_SAMPLES,
  computeDistribution,
} from '../src/lib/distribution.ts'
import type { ApiQuizMetrics, ApiQuizPosition } from '../src/shared/api.ts'

const MAX_WIN_SHARE = 0.05
const MAX_PARTY_GAP = 0.05

interface DbRow {
  id: string
  ballot_name: string
  party_acronym: string | null
  occupation: string | null
  birth_date: string | null
  candidacy_type: string | null
  birth_state: string | null
  state: string
}

function percent(share: number): string {
  return `${(share * 100).toFixed(1).padStart(5)}%`
}

function loadPositions(db: DatabaseSync): Map<string, ApiQuizPosition[]> {
  const map = new Map<string, ApiQuizPosition[]>()
  const tables = db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'quiz_positions'`,
    )
    .get()
  if (!tables) return map
  const rows = db.prepare(`SELECT * FROM quiz_positions`).all() as unknown as Array<{
    candidate_id: string
    pauta_id: string
    value: 'sim' | 'nao' | null
    origin: 'candidato' | 'partido' | null
    voto: string | null
    party_acronym: string | null
    source_url: string | null
  }>
  for (const row of rows) {
    const item: ApiQuizPosition = {
      pautaId: row.pauta_id,
      value: row.value,
      origin: row.origin,
      voto: row.voto,
      partyAcronym: row.party_acronym,
      sourceUrl: row.source_url,
    }
    const list = map.get(row.candidate_id)
    if (list) list.push(item)
    else map.set(row.candidate_id, [item])
  }
  return map
}

function loadMetrics(db: DatabaseSync): Map<string, ApiQuizMetrics> {
  const map = new Map<string, ApiQuizMetrics>()
  const tables = db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'quiz_metrics'`,
    )
    .get()
  if (!tables) return map
  const rows = db.prepare(`SELECT * FROM quiz_metrics`).all() as unknown as Array<{
    candidate_id: string
    alinhamento_governo: number | null
    alinhamento_origem: 'candidato' | 'partido' | null
    trajetoria: number
  }>
  for (const row of rows) {
    map.set(row.candidate_id, {
      alinhamentoGoverno: row.alinhamento_governo,
      alinhamentoOrigem: row.alinhamento_origem,
      trajetoria: row.trajetoria,
    })
  }
  return map
}

function auditState(
  state: string,
  rows: DbRow[],
  positions: Map<string, ApiQuizPosition[]>,
  metrics: Map<string, ApiQuizMetrics>,
): boolean {
  const brazil = stateByCode(state)
  if (!brazil) {
    console.error(`UF desconhecida no banco: ${state}`)
    return false
  }
  const questions = questionsFor(brazil)
  console.log(`\n=== ${brazil.code} (${rows.length} candidatos) ===`)

  const candidates: Candidate[] = rows.map((row) => {
    const source = {
      occupation: row.occupation,
      birthDate: row.birth_date,
      candidacyType: row.candidacy_type,
      birthState: row.birth_state,
      partyAcronym: row.party_acronym,
      quizPositions: positions.get(row.id) ?? [],
      quizMetrics: metrics.get(row.id) ?? null,
    }
    return {
      id: row.id,
      name: row.ballot_name,
      description: '',
      partyAcronym: row.party_acronym,
      profile: buildProfile(source, state),
      facts: buildFacts(source, state),
    }
  })

  console.log('\nCobertura por pergunta:')
  for (const question of questions) {
    const counts = new Map<string, number>()
    for (const candidate of candidates) {
      const optionId = candidate.profile[question.id] ?? 'sem-dado'
      counts.set(optionId, (counts.get(optionId) ?? 0) + 1)
    }
    console.log(`\n- ${question.title}`)
    const labels = new Map(
      question.options.map((option) => [option.id, option.label]),
    )
    for (const [optionId, n] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
      const label =
        optionId === 'sem-dado'
          ? 'Sem dado'
          : optionId.endsWith(':sim')
            ? 'Sim (voto ou orientação)'
            : optionId.endsWith(':nao')
              ? 'Não (voto ou orientação)'
              : (labels.get(optionId as OptionId) ?? optionId)
      console.log(
        `  ${label.padEnd(52)} ${percent(n / rows.length)} (${String(n).padStart(3)})`,
      )
    }
  }

  console.log(`\nAmostra: ${AUDIT_SAMPLES} combinações`)
  const { entries, partyShares } = computeDistribution(questions, candidates, {
    samples: AUDIT_SAMPLES,
  })
  const top = entries[0]
  console.log('\nTop vencedores:')
  for (const entry of entries.slice(0, 8)) {
    console.log(
      `    ${entry.candidate.name.padEnd(28)} ${String(entry.wins).padStart(5)} ${percent(entry.share)}`,
    )
  }
  console.log('\nVitórias por partido:')
  let partyGap = false
  for (const party of partyShares) {
    const gap = party.winShare - party.candidateShare
    if (party.candidates >= 5 && gap > MAX_PARTY_GAP) partyGap = true
    console.log(
      `    ${party.party.padEnd(16)} candidatos ${percent(party.candidateShare)} vitórias ${percent(party.winShare)}`,
    )
  }

  if (partyGap) {
    console.warn(
      `\nAviso (${state}): algum partido com 5 ou mais candidatos vence mais de 5 pontos percentuais acima da sua fatia.`,
    )
  }
  if (top && top.share > MAX_WIN_SHARE) {
    console.error(
      `\n${state}: ${top.candidate.name} vence ${percent(top.share)} das amostras (teto ${percent(MAX_WIN_SHARE)}).`,
    )
    return false
  }
  return true
}

function main(): void {
  const db = new DatabaseSync('data/tse.db')
  const rows = db
    .prepare(
      `SELECT id, ballot_name, party_acronym, occupation, birth_date, candidacy_type, birth_state, state
       FROM candidates
       WHERE is_active = 1
       ORDER BY state, ballot_name`,
    )
    .all() as unknown as DbRow[]
  const positions = loadPositions(db)
  const metrics = loadMetrics(db)
  db.close()

  console.log(`Candidatos auditados: ${rows.length}`)
  if (rows.length === 0) {
    console.error('Nenhum candidato. Rode `npm run ingest`?')
    process.exit(1)
  }

  const byState = new Map<string, DbRow[]>()
  for (const row of rows) {
    const group = byState.get(row.state)
    if (group) group.push(row)
    else byState.set(row.state, [row])
  }

  let ok = true
  for (const [state, group] of byState) {
    if (!auditState(state, group, positions, metrics)) ok = false
  }
  if (!ok) process.exit(1)
}

main()
