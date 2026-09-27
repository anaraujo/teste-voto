import { useCallback, useEffect, useState } from 'react'
import type { ApiCandidateDetail } from '../shared/api.ts'

export type CandidateDetailState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: ApiCandidateDetail }

/** Carrega a ficha de um candidato específico (/api/candidates/:id). */
export function useCandidateDetail(candidateId: string): {
  state: CandidateDetailState
  retry: () => void
} {
  const [state, setState] = useState<CandidateDetailState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setState({ status: 'loading' })
      try {
        const response = await fetch(`/api/candidates/${encodeURIComponent(candidateId)}`)
        if (!response.ok) {
          throw new Error(`erro ao carregar a ficha (${response.status})`)
        }
        const data = (await response.json()) as ApiCandidateDetail
        if (!cancelled) setState({ status: 'ready', data })
      } catch (error) {
        if (!cancelled) {
          setState({
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
  }, [candidateId, attempt])

  const retry = useCallback(() => setAttempt((value) => value + 1), [])

  return { state, retry }
}