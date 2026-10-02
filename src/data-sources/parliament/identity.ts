/**
 * Identificação de parlamentares históricos (ex-deputados e ex-senadores)
 * entre os candidatos, para preencher o histórico de mandato na ficha.
 *
 * Reusa a mesma regra de nomes da identificação de incumbentes: nome
 * normalizado; para nomes de urna curtos, confirmação pela data de
 * nascimento.
 */

import type { CandidateRecord } from '../../shared/domain.ts'
import { normalizeName } from '../camara/identity.ts'

export interface HistoryPerson {
  /** Id do parlamentar na casa (idDeputado / codigoParlamentar). */
  id: number
  nome: string
  dataNascimento: string | null
}

export interface HistoryMatchResult {
  /** Mapa parlamentarId -> candidateId. */
  matched: Map<number, string>
  /** Parlamentares sem candidato correspondente. */
  unmatched: HistoryPerson[]
}

/**
 * Casa cada pessoa (única por id) com no máximo um candidato.
 * A comparação usa o nome completo ou o nome de urna (>= 5 letras);
 * nomes curtos exigem confirmação pela data de nascimento.
 */
export function matchHistoryPeople(
  candidates: CandidateRecord[],
  people: HistoryPerson[],
): HistoryMatchResult {
  const matched = new Map<number, string>()
  const unmatched: HistoryPerson[] = []
  const used = new Set<string>()

  for (const person of people) {
    const personName = normalizeName(person.nome)

    const named = candidates.filter((candidate) => {
      if (used.has(candidate.id)) return false
      const fullName = normalizeName(candidate.fullName)
      const ballotName = normalizeName(candidate.ballotName)
      if (personName === fullName) return true
      if (personName === ballotName && personName.length >= 5) return true
      if (personName === ballotName) {
        return (
          person.dataNascimento !== null &&
          person.dataNascimento === candidate.birthDate
        )
      }
      return false
    })

    if (named.length === 0) {
      unmatched.push(person)
      continue
    }

    const withBirth = named.find(
      (candidate) => candidate.birthDate === person.dataNascimento,
    )
    const candidate = withBirth ?? named[0]
    used.add(candidate.id)
    matched.set(person.id, candidate.id)
  }

  return { matched, unmatched }
}
