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
  /**
   * UF do parlamentar, quando a casa a publica (a Câmara traz `siglaUf` por
   * legislatura). Só entra como desempate: ver `matchHistoryPeople`.
   */
  uf?: string | null
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
 *
 * **Desempate por UF.** Sem isto a regra pegava o primeiro candidato da lista
 * quando mais de um tinha o mesmo nome normalizado, e com o pool nacional isso
 * deixou de ser um caso de canto: 19 mil candidatos têm homônimos. A UF que a
 * Câmara publica passa a decidir, e o desempate tem de ser único: havendo mais
 * de um candidato para a mesma UF, a pessoa vai para `unmatched` em vez de uma
 * escolha arbitrária — a regra de ouro da ficha é o padrão ser "não encontrei
 * evidência suficiente", e um casamento errado contamina mandato, métrica e voto
 * de uma pessoa que não é aquela.
 *
 * O índice de nomes é montado uma vez. Antes o `filter` normalizava os dois
 * nomes de cada candidato para cada pessoa, o que com o pool nacional daria
 * ~20 milhões de normalizações; assim o custo é linear no total de candidatos.
 */
export function matchHistoryPeople(
  candidates: CandidateRecord[],
  people: HistoryPerson[],
): HistoryMatchResult {
  const matched = new Map<number, string>()
  const unmatched: HistoryPerson[] = []
  const used = new Set<string>()

  /*
   * Dois índices, e não um só: as regras dealgam de o nome ter vindo do nome
   * completo ou do nome de urna, e o nome curto (menos de 5 letras) só casa
   * pelo nome de urna quando a data de nascimento bate. Com um índice único os
   * dois caminhos se misturariam.
   */
  const byFullName = new Map<string, CandidateRecord[]>()
  const byBallotName = new Map<string, CandidateRecord[]>()
  for (const candidate of candidates) {
    add(byFullName, normalizeName(candidate.fullName), candidate)
    add(byBallotName, normalizeName(candidate.ballotName), candidate)
  }

  for (const person of people) {
    const personName = normalizeName(person.nome)
    const personUf = person.uf?.trim().toUpperCase() || null

    const livres = (bucket: CandidateRecord[] | undefined) =>
      (bucket ?? []).filter((candidate) => !used.has(candidate.id))

    // Nome completo casa sempre, com qualquer tamanho.
    const named = livres(byFullName.get(personName))

    // Nome de urna: sozinho a partir de 5 letras; abaixo disso só com a data.
    const byUrna = livres(byBallotName.get(personName))
    if (personName.length >= 5) {
      for (const candidate of byUrna) {
        if (!named.includes(candidate)) named.push(candidate)
      }
    } else if (person.dataNascimento !== null) {
      for (const candidate of byUrna) {
        if (
          candidate.birthDate === person.dataNascimento &&
          !named.includes(candidate)
        ) {
          named.push(candidate)
        }
      }
    }

    if (named.length === 0) {
      unmatched.push(person)
      continue
    }

    /*
     * A data de nascimento só confirma quando a pessoa tem data. Sem isso o
     * `null === null` de quem não tem data casa com o primeiro candidato que
     * também não tem, e o desempate por UF nem chega a rodar — foi o que os
     * testes pegaram.
     */
    const withBirth =
      person.dataNascimento === null
        ? undefined
        : named.find(
            (candidate) => candidate.birthDate === person.dataNascimento,
          )
    const chosen = withBirth ?? desempatePorUf(named, personUf)

    if (!chosen) {
      // Mesmo nome, mais de um candidato, e a UF não separa: não há evidência.
      unmatched.push(person)
      continue
    }

    used.add(chosen.id)
    matched.set(person.id, chosen.id)
  }

  return { matched, unmatched }
}

function add(
  index: Map<string, CandidateRecord[]>,
  key: string,
  candidate: CandidateRecord,
): void {
  if (key === '') return
  const bucket = index.get(key)
  if (bucket) {
    if (!bucket.includes(candidate)) bucket.push(candidate)
  } else {
    index.set(key, [candidate])
  }
}

/**
 * Escolhe entre candidatos com o mesmo nome normalizado usando a UF, e só
 * aceita quando a UF deixa um único candidato de pé.
 *
 * Havendo UF da pessoa, ela é **exigida** — inclusive quando o nome é único no
 * país inteiro. Antes o atalho "nome único, então é esse" deixava passar o caso
 * mais perigoso dos dois: um deputado de nome comum que encontra, em outra UF, o
 * único candidato com aquele nome. Na validação nacional foram 14 assim, e entre
 * eles um deputado do RJ casado com uma candidata homônima de SC e outro com uma
 * de SP. Nome único não é prova de que é a mesma pessoa; a UF é.
 *
 * Sem UF, o atalho continua valendo, porque aí não há o que comparar.
 */
function desempatePorUf(
  named: CandidateRecord[],
  personUf: string | null,
): CandidateRecord | null {
  if (!personUf) return named.length === 1 ? named[0] : null
  const naUf = named.filter(
    (candidate) => candidate.state.toUpperCase() === personUf,
  )
  return naUf.length === 1 ? naUf[0] : null
}
