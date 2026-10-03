/**
 * Lista curta de votações para o quiz, só com critérios objetivos.
 * Lê o plenário já gravado por `npm run sync:votacoes`.
 *
 * Saída: data/quiz/shortlist.json
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { openRepository } from '../src/data-sources/repository.ts'
import { defaultDataDir } from '../src/data-sources/tse/candidates.ts'
import type { PartyLineage, Stance } from '../src/data-sources/quiz/lineage.ts'
import { selectShortlist, type RankVote } from '../src/data-sources/quiz/rank.ts'
import { CURRENT_ELECTION } from '../src/shared/elections.ts'

const DATA_DIR = defaultDataDir()
const lineage = JSON.parse(
  await readFile(new URL('../content/quiz/party-lineage.json', import.meta.url), 'utf8'),
) as PartyLineage

function loadVotes(db: DatabaseSync): RankVote[] {
  const votacoes = db
    .prepare(
      `SELECT id, data, descricao, votos_sim, votos_nao, source_url
       FROM plenary_votacoes`,
    )
    .all() as unknown as Array<{
    id: string
    data: string
    descricao: string
    votos_sim: number
    votos_nao: number
    source_url: string
  }>

  const proposicoes = db
    .prepare(
      `SELECT votacao_id, sigla_tipo, numero, ano, titulo, ementa
       FROM plenary_proposicoes`,
    )
    .all() as unknown as Array<{
    votacao_id: string
    sigla_tipo: string | null
    numero: string | null
    ano: string | null
    titulo: string | null
    ementa: string | null
  }>

  const orientations = db
    .prepare(
      `SELECT votacao_id, sigla, stance FROM plenary_orientations
       WHERE stance IS NOT NULL`,
    )
    .all() as unknown as Array<{
    votacao_id: string
    sigla: string
    stance: Stance
  }>

  const byProposicao = new Map<string, typeof proposicoes>()
  for (const row of proposicoes) {
    const list = byProposicao.get(row.votacao_id)
    if (list) list.push(row)
    else byProposicao.set(row.votacao_id, [row])
  }
  const byOrientation = new Map<string, Map<string, Stance>>()
  for (const row of orientations) {
    let map = byOrientation.get(row.votacao_id)
    if (!map) {
      map = new Map()
      byOrientation.set(row.votacao_id, map)
    }
    map.set(row.sigla, row.stance)
  }

  return votacoes.map((vote) => {
    const props = byProposicao.get(vote.id) ?? []
    const primary =
      props.find((item) => item.sigla_tipo === 'PEC') ??
      props.find((item) => item.sigla_tipo === 'PLP') ??
      props.find((item) => item.sigla_tipo === 'MPV') ??
      props[0]
    const label = primary?.sigla_tipo
      ? `${primary.sigla_tipo} ${primary.numero ?? ''}/${primary.ano ?? ''}`.trim()
      : null
    return {
      id: vote.id,
      data: vote.data,
      descricao: vote.descricao,
      votosSim: vote.votos_sim,
      votosNao: vote.votos_nao,
      siglasTipo: props.map((item) => item.sigla_tipo ?? '').filter(Boolean),
      ementa: primary?.ementa ?? null,
      proposicaoLabel: label,
      sourceUrl: vote.source_url,
      orientations: byOrientation.get(vote.id) ?? new Map(),
    }
  })
}

const db = await openRepository(join(DATA_DIR, 'tse.db'))
try {
  const parties = (
    db
      .prepare(
        `SELECT party_acronym FROM candidates
         WHERE is_active = 1 AND election_year = ? AND state = ? AND office = ?`,
      )
      .all(
        CURRENT_ELECTION.year,
        CURRENT_ELECTION.state,
        CURRENT_ELECTION.office,
      ) as unknown as Array<{ party_acronym: string | null }>
  ).map((row) => row.party_acronym)

  const shortlist = selectShortlist(loadVotes(db), parties, lineage)
  const output = join(DATA_DIR, 'quiz', 'shortlist.json')
  await mkdir(join(DATA_DIR, 'quiz'), { recursive: true })
  await writeFile(output, JSON.stringify(shortlist, null, 2))
  console.log(`[rank] ${shortlist.length} votações em ${output}`)
  for (const entry of shortlist.slice(0, 15)) {
    console.log(
      `  ${entry.data} ${entry.votacaoId} sim=${(entry.simShare * 100).toFixed(0)}% cobertura=${(entry.partyCoverage * 100).toFixed(0)}% ${entry.proposicaoLabel ?? ''} ${entry.descricao.slice(0, 80)}`,
    )
  }
} finally {
  db.close()
}
