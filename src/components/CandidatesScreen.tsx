import { useCallback, useEffect, useState } from 'react'
import type { ApiCandidatesResponse } from '../shared/api.ts'

interface CandidatesScreenProps {
  onBack: () => void
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: ApiCandidatesResponse }

export function CandidatesScreen({ onBack }: CandidatesScreenProps) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
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

  return (
    <section>
      <h2>Candidatos</h2>

      {state.status === 'loading' && <p>Carregando candidatos...</p>}

      {state.status === 'error' && (
        <div>
          <p>Não foi possível carregar a lista de candidatos.</p>
          <p>
            <small>
              Verifique se os dados do TSE foram carregados com{' '}
              <code>npm run ingest</code> e se a API está rodando.
            </small>
          </p>
          <p>
            <small>({state.message})</small>
          </p>
          <button type="button" onClick={retry}>
            Tentar novamente
          </button>
        </div>
      )}

      {state.status === 'ready' &&
        (state.data.candidates.length === 0 ? (
          <div>
            <p>Nenhum candidato encontrado para esta eleição.</p>
            <p>
              <small>
                Rode <code>npm run ingest</code> para carregar os dados
                oficiais do TSE.
              </small>
            </p>
          </div>
        ) : (
          <div>
            <p>
              <small>
                {state.data.total} candidatos a {state.data.election.office}{' '}
                em {state.data.election.state} ({state.data.election.year}).
                Fonte:{' '}
                <a
                  href="https://dadosabertos.tse.jus.br/"
                  target="_blank"
                  rel="noreferrer"
                >
                  dados abertos do TSE
                </a>
                .
              </small>
            </p>

            <ul>
              {state.data.candidates.map((candidate) => (
                <li key={candidate.id}>
                  {candidate.photoUrl && (
                    <img
                      src={candidate.photoUrl}
                      alt={candidate.ballotName}
                      width="120"
                      height="150"
                      loading="lazy"
                    />
                  )}
                  <p>
                    <strong>{candidate.ballotName}</strong>
                    {candidate.ballotNumber && (
                      <span> ({candidate.ballotNumber})</span>
                    )}
                  </p>
                  {candidate.partyAcronym && (
                    <p>
                      <small>
                        {candidate.partyAcronym}
                        {candidate.party ? ` - ${candidate.party}` : ''}
                      </small>
                    </p>
                  )}
                  {candidate.coalition && (
                    <p>
                      <small>Coligação: {candidate.coalition}</small>
                    </p>
                  )}
                  {candidate.status && (
                    <p>
                      <small>Situação: {candidate.status}</small>
                    </p>
                  )}
                  {candidate.city && (
                    <p>
                      <small>Município: {candidate.city}</small>
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}

      <button type="button" onClick={onBack}>
        Voltar
      </button>
    </section>
  )
}