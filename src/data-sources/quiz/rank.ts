/**
 * Critérios objetivos para a lista curta de votações do quiz.
 * Nenhum critério aqui classifica candidato nem tema.
 */

import type { Stance } from './lineage.ts'
import {
  resolvePartyStance,
  type PartyLineage,
} from './lineage.ts'

export const QUIZ_VOTE_FROM = '2019-02-01'
export const QUIZ_VOTE_TO = '2027-01-31'
export const MERIT_SIGLAS = new Set(['PEC', 'PL', 'PLP', 'MPV', 'PDC', 'PLV'])

const PROCEDURAL =
  /requerimento|urg[eê]ncia|adiamento|prefer[eê]ncia|encerramento|invers[aã]o|retirada|quebra de interst[ií]cio/i

const MERIT =
  /\b(texto-base|texto base|substitutivo|emenda|reda[cç][aã]o final|medida provis[oó]ria|projeto de lei|pec)\b/i

export interface RankVote {
  id: string
  data: string
  descricao: string
  votosSim: number
  votosNao: number
  siglasTipo: readonly string[]
  ementa: string | null
  proposicaoLabel: string | null
  sourceUrl: string
  orientations: ReadonlyMap<string, Stance>
}

export interface ShortlistEntry {
  votacaoId: string
  data: string
  descricao: string
  ementa: string | null
  proposicaoLabel: string | null
  votosSim: number
  votosNao: number
  simShare: number
  partyCoverage: number
  sourceUrl: string
}

export function isProcedural(descricao: string): boolean {
  return PROCEDURAL.test(descricao)
}

export function isMerit(descricao: string, siglasTipo: readonly string[]): boolean {
  if (isProcedural(descricao)) return false
  if (MERIT.test(descricao)) return true
  return siglasTipo.some((sigla) => MERIT_SIGLAS.has(sigla.toUpperCase()))
}

export function isContested(votosSim: number, votosNao: number): boolean {
  const total = votosSim + votosNao
  if (total <= 0) return false
  const share = votosSim / total
  return share >= 0.25 && share <= 0.75
}

export function inQuizWindow(data: string): boolean {
  return data >= QUIZ_VOTE_FROM && data <= QUIZ_VOTE_TO
}

export function selectShortlist(
  votes: readonly RankVote[],
  parties: readonly (string | null)[],
  lineage: PartyLineage,
  limit = 50,
  minCoverage = 0.8,
): ShortlistEntry[] {
  const selected: ShortlistEntry[] = []
  for (const vote of votes) {
    if (!inQuizWindow(vote.data)) continue
    if (!isMerit(vote.descricao, vote.siglasTipo)) continue
    if (!isContested(vote.votosSim, vote.votosNao)) continue
    if (parties.length === 0) continue

    let covered = 0
    let simParties = 0
    let naoParties = 0
    const seen = new Set<string>()
    for (const party of parties) {
      const stance = resolvePartyStance(
        party,
        vote.orientations,
        vote.data,
        lineage,
      )
      if (!stance) continue
      covered++
      if (party && !seen.has(party)) {
        seen.add(party)
        if (stance === 'sim') simParties++
        else naoParties++
      }
    }
    const partyCoverage = covered / parties.length
    if (partyCoverage < minCoverage) continue
    if (simParties === 0 || naoParties === 0) continue

    const total = vote.votosSim + vote.votosNao
    selected.push({
      votacaoId: vote.id,
      data: vote.data,
      descricao: vote.descricao,
      ementa: vote.ementa,
      proposicaoLabel: vote.proposicaoLabel,
      votosSim: vote.votosSim,
      votosNao: vote.votosNao,
      simShare: total > 0 ? vote.votosSim / total : 0,
      partyCoverage,
      sourceUrl: vote.sourceUrl,
    })
  }

  selected.sort(
    (a, b) =>
      Math.abs(a.simShare - 0.5) - Math.abs(b.simShare - 0.5) ||
      a.votacaoId.localeCompare(b.votacaoId),
  )
  return selected.slice(0, limit)
}
