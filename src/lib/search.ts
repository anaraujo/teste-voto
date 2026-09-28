/**
 * Busca de candidatos (puramente no cliente) sobre a lista já carregada.
 *
 * Prioriza o nome (de urna e completo) e o número de urna; partidos podem ser
 * buscados pela sigla ("PT") ou pelo nome completo ("Partido dos Trabalhadores")
 * e, nesse caso, retornam todos os candidatos da agremiação.
 *
 * Os campos são normalizados uma única vez em `buildSearchIndex` e reaproveitados
 * a cada tecla digitada; o fuzzy (Levenshtein) só roda quando o tamanho do campo
 * está próximo do tamanho da busca, evitando custo quadrático sobre nomes longos.
 */

import type { ApiCandidate } from '../shared/api.ts'

const NON_ALPHANUMERIC = /[^a-z0-9 ]/g
const SPACES = /\s+/g

/** Normaliza texto para comparação: minúsculas, sem acentos/pontuação. */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(NON_ALPHANUMERIC, ' ')
    .replace(SPACES, ' ')
    .trim()
}

/** Distância de edição (Levenshtein) entre duas strings normalizadas. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  let previous = new Array<number>(b.length + 1)
  let current = new Array<number>(b.length + 1)
  for (let j = 0; j <= b.length; j++) previous[j] = j

  for (let i = 1; i <= a.length; i++) {
    current[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost,
      )
    }
    const swap = previous
    previous = current
    current = swap
  }

  return previous[b.length]
}

/**
 * Similaridade (0..1) entre a busca e um valor normalizado, evitando o custo
 * quadrático quando os tamanhos já indicam que não é um erro de digitação.
 */
function similarity(query: string, value: string): number {
  if (Math.abs(value.length - query.length) > MAX_FUZZ_DELTA) return 0
  const distance = levenshtein(query, value)
  const longest = Math.max(query.length, value.length)
  return 1 - distance / longest
}

/**
 * Pontuação de um campo contra a busca, por camadas de confiança:
 * exato > prefixo > subtexto > similaridade (fuzzy).
 */
function fieldScore(query: string, value: string): number {
  if (value === query) return 1
  if (value.startsWith(query)) return 0.95
  if (value.includes(query)) return 0.8
  if (query.length <= 2) return 0
  return similarity(query, value) * 0.6
}

const MAX_FUZZ_DELTA = 3

/** Campos do candidato já normalizados, prontos para comparação. */
export interface CandidateSearchEntry {
  candidate: ApiCandidate
  ballotName: string
  fullName: string
  ballotNumber: string
  partyAcronym: string
  party: string
  federation: string
  coalition: string
  occupation: string
  city: string
  birthMunicipality: string
  /** Chave da agremiação (sigla normalizada; cai no nome quando não há sigla). */
  partyKey: string
}

function partyKeyOf(candidate: ApiCandidate): string {
  if (candidate.partyAcronym) return normalize(candidate.partyAcronym)
  if (candidate.party) return normalize(candidate.party)
  return ''
}

/** Normaliza uma vez cada candidato; o resultado é reutilizado a cada tecla. */
export function buildSearchIndex(
  candidates: readonly ApiCandidate[],
): CandidateSearchEntry[] {
  return candidates.map((candidate) => ({
    candidate,
    ballotName: normalize(candidate.ballotName),
    fullName: normalize(candidate.fullName),
    ballotNumber: candidate.ballotNumber,
    partyAcronym: candidate.partyAcronym ? normalize(candidate.partyAcronym) : '',
    party: candidate.party ? normalize(candidate.party) : '',
    federation: candidate.federation ? normalize(candidate.federation) : '',
    coalition: candidate.coalition ? normalize(candidate.coalition) : '',
    occupation: candidate.occupation ? normalize(candidate.occupation) : '',
    city: candidate.city ? normalize(candidate.city) : '',
    birthMunicipality: candidate.birthMunicipality ? normalize(candidate.birthMunicipality) : '',
    partyKey: partyKeyOf(candidate),
  }))
}

interface Party {
  key: string
  acronymNorm: string
  nameNorm: string
}

function collectParties(entries: readonly CandidateSearchEntry[]): Party[] {
  const byKey = new Map<string, Party>()
  for (const entry of entries) {
    if (!entry.partyKey) continue
    if (byKey.has(entry.partyKey)) continue
    byKey.set(entry.partyKey, {
      key: entry.partyKey,
      acronymNorm: entry.partyAcronym,
      nameNorm: entry.party,
    })
  }
  return [...byKey.values()]
}

/**
 * Detecta se a busca é por partido: sigla exata, nome exato ou prefixo/subtexto
 * do nome que identifique uma única agremiação. Retorna a chave do partido.
 */
function matchParty(entries: readonly CandidateSearchEntry[], query: string): string | null {
  const parties = collectParties(entries)

  for (const party of parties) {
    if (party.acronymNorm && party.acronymNorm === query) return party.key
  }

  const byName = parties.filter((party) => {
    if (!party.nameNorm) return false
    if (party.nameNorm === query) return true
    if (query.length >= 4 && party.nameNorm.startsWith(query)) return true
    if (query.length >= 5 && party.nameNorm.includes(query)) return true
    return false
  })

  return byName.length === 1 ? byName[0].key : null
}

function scoreCandidate(entry: CandidateSearchEntry, query: string): number {
  let best = 0
  const consider = (value: string, weight: number) => {
    if (!value) return
    const score = fieldScore(query, value) * weight
    if (score > best) best = score
  }

  consider(entry.ballotName, 1)
  consider(entry.fullName, 0.9)
  consider(entry.ballotNumber, 0.95)
  consider(entry.partyAcronym, 0.5)
  consider(entry.party, 0.5)
  consider(entry.federation, 0.35)
  consider(entry.coalition, 0.3)
  consider(entry.occupation, 0.4)
  consider(entry.city, 0.4)
  consider(entry.birthMunicipality, 0.35)

  return best
}

function byBallotName(a: ApiCandidate, b: ApiCandidate): number {
  return a.ballotName.localeCompare(b.ballotName, 'pt-BR')
}

const MIN_SCORE = 0.25

/**
 * Filtra e ordena candidatos pela busca. Busca vazia devolve a lista completa
 * em ordem alfabética do nome de urna; busca por partido devolve todos os
 * candidatos da agremiação; o restante é ordenado por relevância decrescente.
 */
export function searchCandidates(
  index: readonly CandidateSearchEntry[],
  query: string,
): ApiCandidate[] {
  const normalizedQuery = normalize(query)
  const sorted = [...index].sort((a, b) => byBallotName(a.candidate, b.candidate))

  if (normalizedQuery === '') return sorted.map((entry) => entry.candidate)

  const party = matchParty(index, normalizedQuery)
  if (party) {
    return sorted
      .filter((entry) => entry.partyKey === party)
      .map((entry) => entry.candidate)
  }

  return sorted
    .map((entry) => ({ candidate: entry.candidate, score: scoreCandidate(entry, normalizedQuery) }))
    .filter((scored) => scored.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score || byBallotName(a.candidate, b.candidate))
    .map((scored) => scored.candidate)
}
