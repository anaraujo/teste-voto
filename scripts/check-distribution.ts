/**
 * Auditoria do quiz (diagnóstico, não corrige nada).
 *
 * Lê o banco local (data/tse.db) e classifica os candidatos reais com os
 * mesmos resolvedores do quiz, verificando:
 *   - cobertura por pergunta/opção (alvo 5%-50%, aviso abaixo de 3%);
 *   - raridade dos perfis completos (usada no desempate);
 *   - heterogeneidade dos vencedores entre as combinações possíveis.
 *
 * Exige `npm run ingest` antes. Regras em docs/quiz-design.md.
 */

import { DatabaseSync } from 'node:sqlite'
import type { Candidate, OptionId } from '../src/data/quiz.ts'
import {
  buildProfile,
  profileKey,
  questionsFor,
  resolveSector,
} from '../src/data/quiz-source.ts'
import { stateByCode } from '../src/data/brazil-map.ts'
import { computeDistribution } from '../src/lib/distribution.ts'

const MIN_SHARE = 0.05
const HARD_FLOOR = 0.03
const MAX_SHARE = 0.5
/** Nenhum candidato deve vencer mais do que isso das combinações. */
const MAX_WIN_SHARE = 0.05

interface DbRow {
  id: string
  ballot_name: string
  occupation: string | null
  birth_date: string | null
  candidacy_type: string | null
  birth_state: string | null
  state: string
}

function loadRows(db: DatabaseSync): DbRow[] {
  const rows = db
    .prepare(
      `SELECT id, ballot_name, occupation, birth_date, candidacy_type, birth_state, state
       FROM candidates WHERE is_active = 1 ORDER BY state, ballot_name`,
    )
    .all() as unknown as DbRow[]
  return rows
}

function percent(share: number): string {
  return `${(share * 100).toFixed(1).padStart(5)}%`
}

function coverageReport(
  profiles: ReadonlyMap<string, Candidate[]>,
  questions: ReturnType<typeof questionsFor>,
): void {
  const total = [...profiles.values()].reduce(
    (sum, group) => sum + group.length,
    0,
  )
  console.log('\nCobertura por pergunta:')
  for (const question of questions) {
    const counts = new Map<OptionId, number>(
      question.options.map((option) => [option.id, 0]),
    )
    for (const profile of profiles.values()) {
      for (const candidate of profile) {
        const optionId = candidate.profile[question.id]
        counts.set(optionId, (counts.get(optionId) ?? 0) + 1)
      }
    }
    console.log(`\n- ${question.title}`)
    for (const option of question.options) {
      const n = counts.get(option.id) ?? 0
      const share = n / total
      const warning =
        share < HARD_FLOOR
          ? ' ⚠ abaixo de 3% (quase sem influência)'
          : share < MIN_SHARE
            ? ' ・ abaixo de 5% (pouca influência)'
            : share > MAX_SHARE
              ? ' ・ acima de 50% (desequilibrada)'
              : ''
      console.log(
        `  ${option.label.padEnd(48)} ${percent(share)} (${String(n).padStart(3)})${warning}`,
      )
    }
  }
}

function auditState(state: string, rows: DbRow[]): boolean {
  const brazil = stateByCode(state)
  if (!brazil) {
    console.error(`UF desconhecida no banco: ${state}`)
    return false
  }
  const questions = questionsFor(brazil)
  console.log(`\n=== ${brazil.code} (${rows.length} candidatos) ===`)

  const profiles = new Map<string, Candidate[]>()
  for (const row of rows) {
    const profile = buildProfile(
      {
        occupation: row.occupation,
        birthDate: row.birth_date,
        candidacyType: row.candidacy_type,
        birthState: row.birth_state,
      },
      state,
    )
    const candidate: Candidate = {
      id: row.id,
      name: row.ballot_name,
      description: '',
      profile,
    }
    const key = profileKey(profile)
    const group = profiles.get(key)
    if (group) group.push(candidate)
    else profiles.set(key, [candidate])
  }

  if (profiles.size === 0) {
    console.error(`Nenhum perfil válido em ${state}.`)
    return false
  }

  console.log(`Perfis completos distintos: ${profiles.size}`)
  const sortedBySize = [...profiles.values()].sort((a, b) => b.length - a.length)
  const topProfile = sortedBySize[0]
  if (topProfile) {
    console.log(
      `Perfil mais repetido: ${topProfile.length} candidatos (${percent(topProfile.length / rows.length)})`,
    )
  }

  coverageReport(profiles, questions)

  const candidates = [...profiles.values()].flat()
  const { entries, totalCombinations } = computeDistribution(questions, candidates)
  const wins = entries.map((entry) => entry.wins)
  const min = Math.min(...wins)
  const max = Math.max(...wins)
  const mean = wins.reduce((sum, value) => sum + value, 0) / wins.length

  console.log('\nAuditoria de combinações de resposta:')
  console.log(`  Combinações possíveis: ${totalCombinations}`)
  console.log(`  Candidatos avaliados: ${entries.length}`)
  console.log(
    `  Vitórias por candidato: min ${min} · média ${mean.toFixed(2)} · máx ${max}`,
  )
  console.log('\n  Top vencedores:')
  for (const entry of entries.slice(0, 8)) {
    console.log(
      `    ${entry.candidate.name.padEnd(28)} ${String(entry.wins).padStart(3)} ${percent(entry.share)}`,
    )
  }

  const sectorCounts = new Map<string, number>()
  for (const row of rows) {
    const sector = resolveSector(row.occupation)
    sectorCounts.set(sector, (sectorCounts.get(sector) ?? 0) + 1)
  }
  console.log('\nDistribuição por setor (ocupação declarada):')
  for (const [sector, n] of [...sectorCounts.entries()].sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(
      `    ${sector.padEnd(20)} ${String(n).padStart(3)} ${percent(n / rows.length)}`,
    )
  }

  const leader = entries[0]
  if (leader && leader.share > MAX_WIN_SHARE) {
    console.error(
      `\n${state}: ${leader.candidate.name} vence ${percent(leader.share)} das combinações (teto ${percent(MAX_WIN_SHARE)}).`,
    )
    return false
  }
  return true
}

function main(): void {
  const db = new DatabaseSync('data/tse.db')
  const rows = loadRows(db)
  db.close()

  console.log(`Candidatos auditados: ${rows.length}`)
  if (rows.length === 0) {
    console.error('Nenhum perfil válido. Rode `npm run ingest`?')
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
    if (!auditState(state, group)) ok = false
  }
  if (!ok) process.exit(1)
}

main()
