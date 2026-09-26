import { useCallback, useEffect, useState } from 'react'
import type { ApiCandidatesResponse, ApiCandidate } from '../shared/api.ts'

interface CandidatesScreenProps {
  onBack: () => void
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: ApiCandidatesResponse }

/** Converte data ISO "AAAA-MM-DD" em "DD/MM/AAAA". */
function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}

/** Agremiação: federação, partido isolado ou tipo de agremiação. */
function formatCandidacy(candidate: ApiCandidate): string | null {
  if (candidate.federation) return `Federação: ${candidate.federation}`
  if (candidate.candidacyType === 'PARTIDO ISOLADO') return 'Partido isolado'
  return candidate.candidacyType
}

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
              {state.data.candidates.map((candidate) => {
                const birth =
                  candidate.birthDate && candidate.birthState
                    ? `${formatDate(candidate.birthDate)} (natural de ${candidate.birthState})`
                    : candidate.birthDate
                      ? formatDate(candidate.birthDate)
                      : null
                const city =
                  candidate.city &&
                  candidate.city.toUpperCase() !== state.data.election.state
                    ? candidate.city
                    : null
                const candidacy = formatCandidacy(candidate)
                return (
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
                          {candidate.party
                            ? ` - ${candidate.party}`
                            : ''}
                        </small>
                      </p>
                    )}
                    {candidacy && (
                      <p>
                        <small>{candidacy}</small>
                      </p>
                    )}
                    {candidate.occupation && (
                      <p>
                        <small>Ocupação: {candidate.occupation}</small>
                      </p>
                    )}
                    {city && (
                      <p>
                        <small>Município: {city}</small>
                      </p>
                    )}
                    <details>
                      <summary>
                        <small>Mais informações</small>
                      </summary>
                      <dl>
                        {candidate.education && (
                          <div>
                            <dt>Escolaridade</dt>
                            <dd>{candidate.education}</dd>
                          </div>
                        )}
                        {candidate.maritalStatus && (
                          <div>
                            <dt>Estado civil</dt>
                            <dd>{candidate.maritalStatus}</dd>
                          </div>
                        )}
                        {birth && (
                          <div>
                            <dt>Nascimento</dt>
                            <dd>{birth}</dd>
                          </div>
                        )}
                        {candidate.gender && (
                          <div>
                            <dt>Sexo</dt>
                            <dd>{candidate.gender}</dd>
                          </div>
                        )}
                        {candidate.race && (
                          <div>
                            <dt>Cor/raça</dt>
                            <dd>{candidate.race}</dd>
                          </div>
                        )}
                      </dl>
                    </details>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}

      <button type="button" onClick={onBack}>
        Voltar
      </button>
    </section>
  )
}