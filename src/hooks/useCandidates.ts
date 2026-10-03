import { useCallback, useEffect, useState } from 'react'
import type { ApiCandidatesResponse } from '../shared/api.ts'

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
 * Carrega a lista oficial de candidatos da UF (`/api/candidates?state=`).
 *
 * `seed` são os dados embutidos no HTML pré-renderizado: quando batem com a
 * UF, a tela já aparece pronta e nenhuma requisição é feita.
 */
export function useCandidates(
  uf: string | null,
  seed?: ApiCandidatesResponse,
): {
  state: CandidatesLoadState
  retry: () => void
} {
  const matchingSeed =
    seed && uf && seed.election.state === uf ? seed : undefined
  const [fetched, setFetched] = useState<{
    uf: string
    state: CandidatesLoadState
  } | null>(null)
  const [attempt, setAttempt] = useState(0)

  if (fetched && fetched.uf !== uf) setFetched(null)

  useEffect(() => {
    if (!uf || matchingSeed) return
    const stateCode = uf

    let cancelled = false

    async function load() {
      try {
        const response = await fetch(
          `/api/candidates?state=${encodeURIComponent(stateCode)}`,
        )
        if (!response.ok) {
          throw new Error(`erro ao carregar candidatos (${response.status})`)
        }
        const data = (await response.json()) as ApiCandidatesResponse
        if (!cancelled) {
          setFetched({ uf: stateCode, state: { status: 'ready', data } })
        }
      } catch (error) {
        if (!cancelled) {
          setFetched({
            uf: stateCode,
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
  }, [attempt, matchingSeed, uf])

  const retry = useCallback(() => {
    setFetched(null)
    setAttempt((value) => value + 1)
  }, [])

  if (!uf) return { state: { status: 'ready', data: EMPTY }, retry }
  if (matchingSeed) return { state: { status: 'ready', data: matchingSeed }, retry }

  const state: CandidatesLoadState =
    fetched?.uf === uf ? fetched.state : { status: 'loading' }

  return { state, retry }
}
