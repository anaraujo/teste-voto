import { useCallback, useEffect, useState } from 'react'
import type { ApiCandidatesResponse } from '../shared/api.ts'

export type CandidatesLoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: ApiCandidatesResponse }

/** Carrega a lista oficial de candidatos da API local (/api/candidates). */
export function useCandidates(): {
  state: CandidatesLoadState
  retry: () => void
} {
  const [state, setState] = useState<CandidatesLoadState>({
    status: 'loading',
  })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setState({ status: 'loading' })
      try {
        const response = await fetch('/api/candidates')
        if (!response.ok) {
          throw new Error(`erro ao carregar candidatos (${response.status})`)
        }
        const data = (await response.json()) as ApiCandidatesResponse
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
  }, [attempt])

  const retry = useCallback(() => setAttempt((value) => value + 1), [])

  return { state, retry }
}
