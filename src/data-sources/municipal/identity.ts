/**
 * Vínculo entre candidato-vereador do TSE (histórico eleitoral) e o cadastro
 * da Câmara (SAPL).
 *
 * Aqui a regra é mais dura que a da camada federal, por um motivo concreto:
 * **o SAPL não publica o número de candidato do TSE**. O campo
 * `numero_gab_parlamentar` é a cadeira na Casa, não o número na urna. Sem
 * `sq_candidato` vindo da Câmara, não existe como *confirmar* uma identidade —
 * e é por isso que este módulo nunca devolve `confirmed`:
 *
 * - `confirmed` exige `sqCandidato` presente nos dois lados;
 * - sem ele, o melhor caso é `probable`, por nome idêntico normalizado **e**
 *   município **e** período compatível;
 * - nome ambíguo, nome parcial ou período contraditório -> `unresolved`, que
 *   a ficha não pode usar para afirmar nada.
 *
 * Dois homônimos podem ter o mesmo nome normalizado. Por isso nomes
 * duplicados dentro do mesmo município ficam `unresolved` em vez de escolher o
 * primeiro — escolher seria inventar.
 */

import { normalizeName } from '../camara/identity.ts'
import type {
  MunicipalLegislator,
  MunicipalLegislatorIdentity,
  MatchingStatus,
} from './types.ts'

/** O que o SAPL sabe de uma pessoa, mais o que o TSE sabe do candidato. */
export interface MunicipalIdentityCandidate {
  candidateId: string
  fullName: string
  municipalityIbgeCode: string
  /** Ano da eleição em que foi candidato a vereador. */
  electionYear: number | null
  sqCandidato: string | null
}

export interface MunicipalIdentitySourcePerson extends MunicipalLegislator {
  /** Período do mandato registrado na Câmara (ISO), quando houver. */
  mandateStartDate: string | null
  /** O SAPL traz o número do candidato do TSE quando a Câmara integra. */
  sqCandidato: string | null
}

function dedupeByPerson(people: MunicipalIdentitySourcePerson[]): MunicipalIdentitySourcePerson[] {
  const byPerson = new Map<string, MunicipalIdentitySourcePerson>()
  for (const person of people) {
    if (!byPerson.has(person.sourcePersonId)) byPerson.set(person.sourcePersonId, person)
  }
  return [...byPerson.values()]
}

/** Margem entre ano da eleição e início do mandato (posse em janeiro). */
const MAX_YEAR_GAP = 1

/**
 * Um ano de eleição é compatível com um início de mandato se a posse caiu no
 * ano da eleição ou no seguinte. Fora disso, o vínculo é implausível.
 */
function isPeriodCompatible(
  electionYear: number | null,
  mandateStartDate: string | null,
): boolean {
  if (electionYear === null || mandateStartDate === null) return true
  const startYear = Number(mandateStartDate.slice(0, 4))
  if (!Number.isFinite(startYear)) return true
  const gap = startYear - electionYear
  return gap >= 0 && gap <= MAX_YEAR_GAP
}

/** Ano de início a partir de uma data ISO (`YYYY-MM-DD` ou `YYYY`). */
function yearOf(iso: string | null): number | null {
  if (iso === null) return null
  const year = Number(iso.slice(0, 4))
  return Number.isFinite(year) ? year : null
}

/**
 * Resolve a identidade de um candidato dentro de uma Câmara.
 *
 * Devolve sempre um resultado; quando não dá para vincular, o status é
 * `unresolved` com `sourcePersonId: null` e a evidência explicando por quê.
 */
export function resolveIdentity(
  candidate: MunicipalIdentityCandidate,
  people: readonly MunicipalIdentitySourcePerson[],
  verifiedAt: string,
): MunicipalLegislatorIdentity {
  const base = {
    candidateId: candidate.candidateId,
    fullName: candidate.fullName,
    municipalityIbgeCode: candidate.municipalityIbgeCode,
    verifiedAt,
  }

  const unresolved = (reason: string): MunicipalLegislatorIdentity => ({
    ...base,
    sourceId: '',
    sourcePersonId: null,
    matchingStatus: 'unresolved',
    matchingMethod: 'other',
    matchingEvidence: reason,
  })

  // 1. sq_candidato presente dos dois lados é a única forma de confirmar.
  if (candidate.sqCandidato !== null) {
    const bySqp = people.find((p) => p.sqCandidato === candidate.sqCandidato)
    if (bySqp !== undefined) {
      return {
        ...base,
        sourceId: bySqp.sourceId,
        sourcePersonId: bySqp.sourcePersonId,
        matchingStatus: 'confirmed',
        matchingMethod: 'sq-candidato',
        matchingEvidence:
          `sq_candidato ${candidate.sqCandidato} idêntico na Câmara e no TSE`,
      }
    }
  }

  const target = normalizeName(candidate.fullName)
  if (target.length < 5) {
    return unresolved(
      `nome "${candidate.fullName}" curto demais para comparar com segurança`,
    )
  }

  // Casar nos dois nomes: a Câmara pode publicar só o nome de gabinete (Castro
  // tem os 32 cadastros com `nome_completo` vazio) ou só o civil. Se um nome
  // casa com uma pessoa e o outro com outra, são duas pessoas e não dá para
  // escolher — daí a deduplicação por `sourcePersonId` antes de contar.
  const named = dedupeByPerson(
    people.filter(
      (p) =>
        p.municipalityIbgeCode === candidate.municipalityIbgeCode &&
        [p.fullName, p.alternateName].some((nome) => nome !== null && normalizeName(nome) === target),
    ),
  )

  if (named.length === 0) {
    return unresolved(
      `nenhum cadastro da Câmara de ${candidate.municipalityIbgeCode} tem o nome ` +
        `"${candidate.fullName}"`,
    )
  }

  if (named.length > 1) {
    return unresolved(
      `${named.length} cadastros com o mesmo nome em ${candidate.municipalityIbgeCode}; ` +
        'sem sq_candidato não dá para escolher',
    )
  }

  const person = named[0]
  if (!isPeriodCompatible(candidate.electionYear, person.mandateStartDate)) {
    return unresolved(
      `nome idêntico, mas o mandato na Câmara começa em ` +
        `${person.mandateStartDate ?? 'data desconhecida'} e a eleição foi ` +
        `${candidate.electionYear ?? 'desconhecida'}`,
    )
  }

  const startYear = yearOf(person.mandateStartDate)
  const periodNote =
    startYear === null
      ? 'período não informado pela Câmara'
      : `mandato desde ${startYear}, compatível com a eleição de ${candidate.electionYear ?? 'ano desconhecido'}`

  const status: MatchingStatus = 'probable'
  return {
    ...base,
    sourceId: person.sourceId,
    sourcePersonId: person.sourcePersonId,
    matchingStatus: status,
    matchingMethod: 'exact-name-plus-context',
    matchingEvidence:
      `nome idêntico após normalização + mesmo município (${candidate.municipalityIbgeCode}) + ` +
      `${periodNote}. Sem sq_candidato na Câmara: não é confirmação.`,
  }
}

/**
 * Vincula todos os candidatos de uma Câmara aos cadastros, sem repetir pessoa.
 *
 * Duas pessoas com o mesmo nome normalizado no mesmo município não podem ser
 * ambas: a segunda fica `unresolved`, porque o SAPL não traz nada que
 * diferencie.
 */
export function resolveChamberIdentities(
  candidates: readonly MunicipalIdentityCandidate[],
  people: readonly MunicipalIdentitySourcePerson[],
  sourceId: string,
  verifiedAt: string,
): MunicipalLegislatorIdentity[] {
  const taken = new Set<string>()

  return candidates.map((candidate) => {
    const resolved = resolveIdentity(candidate, people, verifiedAt)
    const personId = resolved.sourcePersonId

    if (personId !== null && taken.has(personId)) {
      return {
        ...resolved,
        sourceId,
        sourcePersonId: null,
        matchingStatus: 'unresolved',
        matchingEvidence:
          'outro candidato do TSE já usou este cadastro da Câmara; ' +
          'mesmo nome, sem sq_candidato para desempatar',
      }
    }
    if (personId !== null) taken.add(personId)

    return { ...resolved, sourceId }
  })
}
