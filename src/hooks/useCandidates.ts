import { useCallback, useEffect, useState } from 'react'
import type { ApiCandidatesResponse } from '../shared/api.ts'

export type CandidatesLoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: ApiCandidatesResponse }

/**
 * Carrega a lista oficial de candidatos da API local (/api/candidates).
 *
 * `seed` são os dados embutidos no HTML pré-renderizado: quando vêm, a tela já
 * aparece pronta na primeira pintura e nenhuma requisição é feita.
 */
export function useCandidates(seed?: ApiCandidatesResponse): {
  state: CandidatesLoadState
  retry: () => void
} {
  const [fetched, setFetched] = useState<CandidatesLoadState | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (seed) return

    let cancelled = false

    async function load() {
      try {
        const response = await fetch('/api/candidates')
        if (!response.ok) {
          throw new Error(`erro ao carregar candidatos (${response.status})`)
        }
        const data = (await response.json()) as ApiCandidatesResponse
        if (!cancelled) setFetched({ status: 'ready', data })
      } catch (error) {
        if (!cancelled) {
          setFetched({
            status: 'error',
            message: error instanceof Error ? error.message : String(error),
          })
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [attempt, seed])

  const state: CandidatesLoadState = seed
    ? { status: 'ready', data: seed }
    : (fetched ?? { status: 'loading' })

  const retry = useCallback(() => {
    setFetched(null)
    setAttempt((value) => value + 1)
  }, [])

  return { state, retry }
}
