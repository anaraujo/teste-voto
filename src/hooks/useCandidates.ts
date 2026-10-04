import { useCallback, useEffect, useState } from 'react'
import type { ApiCandidatesResponse } from '../shared/api.ts'
import { officeFor, type OfficeKind } from '../shared/elections.ts'

export type CandidatesLoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: ApiCandidatesResponse }

const EMPTY: ApiCandidatesResponse = {
  election: { year: 0, state: '', office: '' },
  total: 0,
  candidates: [],
}

/**
 * Carrega a lista oficial de candidatos da UF (`/api/candidates?state=&office=`).
 *
 * `seed` são os dados embutidos no HTML pré-renderizado: quando batem com a
 * UF e o cargo, a tela já aparece pronta e nenhuma requisição é feita.
 *
 * Ao trocar de cargo, a lista anterior fica no lugar (com `refetching = true`)
 * até o novo dado chegar: a transição troca só o conteúdo, sem piscar a página.
 */
export function useCandidates(
  uf: string | null,
  office: OfficeKind,
  seed?: ApiCandidatesResponse,
): {
  state: CandidatesLoadState
  retry: () => void
  /** true enquanto busca um cargo que ainda não tem dado fresco em tela. */
  refetching: boolean
} {
  const officeName = uf ? officeFor(uf, office) : ''
  const matchingSeed =
    seed &&
    uf &&
    seed.election.state === uf &&
    seed.election.office === officeName
      ? seed
      : undefined
  const [fetched, setFetched] = useState<{
    uf: string
    office: string
    state: CandidatesLoadState
  } | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!uf || matchingSeed) return
    const stateCode = uf

    let cancelled = false

    async function load() {
      try {
        const response = await fetch(
          `/api/candidates?state=${encodeURIComponent(stateCode)}&office=${encodeURIComponent(office)}`,
        )
        if (!response.ok) {
          throw new Error(`erro ao carregar candidatos (${response.status})`)
        }
        const data = (await response.json()) as ApiCandidatesResponse
        if (!cancelled) {
          setFetched({
            uf: stateCode,
            office: officeName,
            state: { status: 'ready', data },
          })
        }
      } catch (error) {
        if (!cancelled) {
          setFetched({
            uf: stateCode,
            office: officeName,
            state: {
              status: 'error',
              message: error instanceof Error ? error.message : String(error),
            },
          })
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [attempt, matchingSeed, office, officeName, uf])

  const retry = useCallback(() => {
    setFetched(null)
    setAttempt((value) => value + 1)
  }, [])

  if (!uf)
    return { state: { status: 'ready', data: EMPTY }, retry, refetching: false }
  if (matchingSeed)
    return {
      state: { status: 'ready', data: matchingSeed },
      retry,
      refetching: false,
    }

  const isCurrent = fetched?.uf === uf && fetched?.office === officeName
  if (isCurrent && fetched) {
    return { state: fetched.state, retry, refetching: false }
  }

  // Sem dado fresco do cargo atual: segura o anterior (transição suave) e
  // marca `refetching` para a tela escurecer e indicar o carregamento.
  if (fetched?.state.status === 'ready') {
    return { state: fetched.state, retry, refetching: true }
  }

  return { state: { status: 'loading' }, retry, refetching: true }
}
