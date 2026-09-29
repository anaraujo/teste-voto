import { useMemo, useState } from 'react'
import type { ApiCandidate } from '../shared/api.ts'
import type { CandidatesLoadState } from '../hooks/useCandidates.ts'
import { ageAtElection, formatBRL, formatDate } from '../lib/format.ts'
import { buildSearchIndex, searchCandidates } from '../lib/search.ts'

interface CandidatesScreenProps {
  state: CandidatesLoadState
  onRetry: () => void
  onBack: () => void
  onShowCandidate: (candidateId: string) => void
}

/** Agremiação: federação, partido isolado ou tipo de agremiação. */
function formatCandidacy(candidate: ApiCandidate): string | null {
  if (candidate.federation) return `Federação: ${candidate.federation}`
  if (candidate.candidacyType === 'PARTIDO ISOLADO') return 'Partido isolado'
  return candidate.candidacyType
}

export function CandidatesScreen({
  state,
  onRetry,
  onBack,
  onShowCandidate,
}: CandidatesScreenProps) {
  const [query, setQuery] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')

  const index = useMemo(
    () =>
      state.status === 'ready'
        ? buildSearchIndex(state.data.candidates)
        : [],
    [state],
  )

  const filtered = useMemo(
    () => searchCandidates(index, appliedQuery),
    [index, appliedQuery],
  )

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
          <button type="button" onClick={onRetry}>
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
                Rode <code>npm run ingest</code> para carregar os dados oficiais
                do TSE.
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

            <form
              onSubmit={(event) => {
                event.preventDefault()
                setAppliedQuery(query)
              }}
            >
              <label htmlFor="candidate-search">Buscar candidato</label>
              <input
                id="candidate-search"
                type="search"
                placeholder="Nome, número, partido, ocupação, cidade..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <button type="submit">Buscar</button>
              {appliedQuery !== '' && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('')
                    setAppliedQuery('')
                  }}
                >
                  Limpar
                </button>
              )}
            </form>

            {appliedQuery !== '' && (
              <p>
                <small>
                  {filtered.length === 1
                    ? '1 candidato encontrado'
                    : `${filtered.length} candidatos encontrados`}
                </small>
              </p>
            )}

            {filtered.length === 0 ? (
              <div>
                <p>Nenhum candidato encontrado para sua busca.</p>
              </div>
            ) : (
            <ul>
              {filtered.map((candidate) => {
                const birthSource =
                  candidate.birthMunicipality && candidate.birthState
                    ? `${candidate.birthMunicipality} (${candidate.birthState})`
                    : candidate.birthState
                      ? candidate.birthState
                      : null
                const birth =
                  candidate.birthDate
                    ? `${formatDate(candidate.birthDate)}${birthSource ? ` · natural de ${birthSource}` : ''}`
                    : birthSource
                      ? `Natural de ${birthSource}`
                      : null
                const age = ageAtElection(candidate.birthDate)
                const city =
                  candidate.city &&
                  candidate.city.toUpperCase() !== state.data.election.state
                    ? candidate.city
                    : null
                const candidacy = formatCandidacy(candidate)
                return (
                  <li key={candidate.id}>
                    <p>
                      <button type="button" onClick={() => onShowCandidate(candidate.id)}>
                        Ver ficha
                      </button>
                    </p>
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
                    {candidacy && (
                      <p>
                        <small>{candidacy}</small>
                      </p>
                    )}
                    {(candidate.isReelection || candidate.isIncumbent) && (
                      <p>
                        <mark>
                          {candidate.isIncumbent
                            ? 'Deputado(a) federal em exercício'
                            : 'Em campanha de reeleição'}
                          {candidate.isIncumbent &&
                            candidate.camaraPartyAcronym &&
                            ` (${candidate.camaraPartyAcronym})`}
                        </mark>
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
                        {age !== null && (
                          <div>
                            <dt>Idade na eleição</dt>
                            <dd>{age} anos</dd>
                          </div>
                        )}
                        {candidate.quilombola && (
                          <div>
                            <dt>Quilombola</dt>
                            <dd>Sim</dd>
                          </div>
                        )}
                        {candidate.indigenousEthnicity && (
                          <div>
                            <dt>Etnia indígena</dt>
                            <dd>{candidate.indigenousEthnicity}</dd>
                          </div>
                        )}
                        {candidate.totalAssets !== null && (
                          <div>
                            <dt>Bens declarados</dt>
                            <dd>{formatBRL(candidate.totalAssets)}</dd>
                          </div>
                        )}
                        {candidate.accountsDeclared === false && (
                          <div>
                            <dt>Bens</dt>
                            <dd>Não há declaração de bens no TSE</dd>
                          </div>
                        )}
                        {candidate.socialLinks.length > 0 && (
                          <div>
                            <dt>Redes sociais</dt>
                            <dd>
                              <ul>
                                {candidate.socialLinks.map((link) => (
                                  <li key={link}>
                                    <a
                                      href={link}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      {link}
                                    </a>
                                  </li>
                                ))}
                              </ul>
                            </dd>
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
            )}
          </div>
        ))}

      <button type="button" onClick={onBack}>
        Voltar
      </button>
    </section>
  )
}