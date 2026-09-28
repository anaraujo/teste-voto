/**
 * Busca de candidatos (puramente no cliente) sobre a lista já carregada.
 *
 * Prioriza o nome (de urna e completo) e o número de urna; partidos podem ser
 * buscados pela sigla ("PT") ou pelo nome completo ("Partido dos Trabalhadores")
 * e, nesse caso, retornam todos os candidatos da agremiação.
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

  const previous = new Array<number>(b.length + 1)
  const current = new Array<number>(b.length + 1)
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
    for (let j = 0; j <= b.length; j++) previous[j] = current[j]
  }

  return current[b.length]
}

/** Similaridade (0..1) entre a busca e um valor normalizado. */
function similarity(query: string, value: string): number {
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

interface Party {
  key: string
  acronymNorm: string
  nameNorm: string
}

function partyKeyOf(candidate: ApiCandidate): string {
  if (candidate.partyAcronym) return normalize(candidate.partyAcronym)
  if (candidate.party) return normalize(candidate.party)
  return ''
}

function collectParties(candidates: readonly ApiCandidate[]): Party[] {
  const byKey = new Map<string, Party>()
  for (const candidate of candidates) {
    const key = partyKeyOf(candidate)
    if (!key) continue
    if (byKey.has(key)) continue
    byKey.set(key, {
      key,
      acronymNorm: candidate.partyAcronym ? normalize(candidate.partyAcronym) : '',
      nameNorm: candidate.party ? normalize(candidate.party) : '',
    })
  }
  return [...byKey.values()]
}

/**
 * Detecta se a busca é por partido: sigla exata, nome exato ou prefixo/subtexto
 * do nome que identifique uma única agremiação. Retorna a chave do partido.
 */
function matchParty(candidates: readonly ApiCandidate[], query: string): string | null {
  const parties = collectParties(candidates)

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

function scoreCandidate(candidate: ApiCandidate, query: string): number {
  let best = 0
  const consider = (value: string | null, weight: number) => {
    if (!value) return
    const score = fieldScore(query, normalize(value)) * weight
    if (score > best) best = score
  }

  consider(candidate.ballotName, 1)
  consider(candidate.fullName, 0.9)
  consider(candidate.ballotNumber, 0.95)
  consider(candidate.partyAcronym, 0.5)
  consider(candidate.party, 0.5)
  consider(candidate.federation, 0.35)
  consider(candidate.coalition, 0.3)
  consider(candidate.occupation, 0.4)
  consider(candidate.city, 0.4)
  consider(candidate.birthMunicipality, 0.35)

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
  candidates: readonly ApiCandidate[],
  query: string,
): ApiCandidate[] {
  const normalizedQuery = normalize(query)
  const sorted = [...candidates].sort(byBallotName)

  if (normalizedQuery === '') return sorted

  const party = matchParty(candidates, normalizedQuery)
  if (party) {
    return sorted.filter((candidate) => partyKeyOf(candidate) === party)
  }

  return sorted
    .map((candidate) => ({ candidate, score: scoreCandidate(candidate, normalizedQuery) }))
    .filter((entry) => entry.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score || byBallotName(a.candidate, b.candidate))
    .map((entry) => entry.candidate)
}
