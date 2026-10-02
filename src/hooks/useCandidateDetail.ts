import { useCallback, useEffect, useState } from 'react'
import type { ApiCandidateDetail } from '../shared/api.ts'

export type CandidateDetailState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: ApiCandidateDetail }

/**
 * Carrega a ficha de um candidato específico (/api/candidates/:id).
 *
 * `seed` são os dados embutidos no HTML pré-renderizado da ficha: quando vêm,
 * a página aparece pronta na primeira pintura e nenhuma requisição é feita.
 */
export function useCandidateDetail(
  candidateId: string,
  seed?: ApiCandidateDetail,
): {
  state: CandidateDetailState
  retry: () => void
} {
  const [fetched, setFetched] = useState<CandidateDetailState | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (seed) return

    let cancelled = false

    async function load() {
      try {
        const response = await fetch(
          `/api/candidates/${encodeURIComponent(candidateId)}`,
        )
        if (!response.ok) {
          throw new Error(`erro ao carregar a ficha (${response.status})`)
        }
        const data = (await response.json()) as ApiCandidateDetail
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
  }, [attempt, candidateId, seed])

  const state: CandidateDetailState = seed
    ? { status: 'ready', data: seed }
    : (fetched ?? { status: 'loading' })

  const retry = useCallback(() => {
    setFetched(null)
    setAttempt((value) => value + 1)
  }, [])

  return { state, retry }
}
