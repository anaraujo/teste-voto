/**
 * Identificação de incumbentes: casa os deputados federais do Paraná em
 * exercício (API da Câmara) com os candidatos da eleição (lista do TSE).
 *
 * A comparação é feita pelo nome normalizado (sem acentos, sem pontuação,
 * em minúsculas) do nome de urna ou do nome completo. Quando existem vários
 * candidatos com o mesmo nome, ou o nome de urna é curto (<= 4 letras,
 * ex.: "ANA"), a data de nascimento é usada como confirmação — quando o
 * deputado e o candidato informam a mesma data, a correspondência é aceita.
 */

import type { CandidateRecord } from '../../shared/domain.ts'
import type { CamaraDeputy } from './deputados.ts'

export interface IncumbentMatch {
  candidateId: string
  camaraId: number
  camaraName: string
  camaraPartyAcronym: string
  camaraPhotoUrl: string | null
}

export interface IdentityMatchResult {
  matches: IncumbentMatch[]
  matchedCount: number
  unmatchedDeputies: CamaraDeputy[]
}

const NON_LETTERS = /[^a-z0-9 ]/g
const SPACES = /\s+/g

/** Normaliza um nome para comparação: minúsculas, sem acentos/pontuação. */
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(NON_LETTERS, ' ')
    .replace(SPACES, ' ')
    .trim()
}

function sortKey(candidate: CandidateRecord): string {
  return `${candidate.id}`.padStart(8, '0')
}

/**
 * Casa deputados da legislatura atual com candidatos. Cada deputado só pode
 * corresponder a um candidato; candidatos que não casam ficam de fora.
 */
export function matchIncumbents(
  candidates: CandidateRecord[],
  deputies: CamaraDeputy[],
): IdentityMatchResult {
  const usedCandidates = new Set<string>()
  const matches: IncumbentMatch[] = []
  const unmatchedDeputies: CamaraDeputy[] = []

  for (const deputy of deputies) {
    const deputyName = normalizeName(deputy.nome)

    const named = candidates.filter((item) => {
      if (usedCandidates.has(item.id)) return false
      const fullName = normalizeName(item.fullName)
      const ballotName = normalizeName(item.ballotName)
      if (deputyName === fullName) return true
      if (deputyName === ballotName && deputyName.length >= 5) return true
      if (deputyName === ballotName) {
        // Nome de urna curto: exige confirmação da data de nascimento.
        return (
          deputy.dataNascimento !== null &&
          deputy.dataNascimento === item.birthDate
        )
      }
      return false
    })

    if (named.length === 0) {
      unmatchedDeputies.push(deputy)
      continue
    }

    // Prioriza quem confirma a data de nascimento; senão, o primeiro por ordem estável.
    const withBirth = named.find(
      (item) => item.birthDate === deputy.dataNascimento,
    )
    const candidate = withBirth ?? named.sort((a, b) => sortKey(a).localeCompare(sortKey(b)))[0]
    usedCandidates.add(candidate.id)

    matches.push({
      candidateId: candidate.id,
      camaraId: deputy.id,
      camaraName: deputy.nome,
      camaraPartyAcronym: deputy.siglaPartido,
      camaraPhotoUrl: deputy.urlFoto,
    })
  }

  return { matches, matchedCount: matches.length, unmatchedDeputies }
}