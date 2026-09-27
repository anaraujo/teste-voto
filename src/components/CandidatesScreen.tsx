import type { ApiCandidate } from '../shared/api.ts'
import type { CandidatesLoadState } from '../hooks/useCandidates.ts'

interface CandidatesScreenProps {
  state: CandidatesLoadState
  onRetry: () => void
  onBack: () => void
}

/** Converte data ISO "AAAA-MM-DD" em "DD/MM/AAAA". */
function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}

/** Idade em 04/10/2026 (data da eleição), a partir da data de nascimento. */
function ageAtElection(birthDate: string | null): number | null {
  if (!birthDate) return null
  const birth = new Date(birthDate)
  if (Number.isNaN(birth.getTime())) return null
  const election = new Date('2026-10-04T00:00:00Z')
  let age = election.getUTCFullYear() - birth.getUTCFullYear()
  const birthdayThisYear = new Date(election)
  birthdayThisYear.setUTCFullYear(birth.getUTCFullYear())
  if (birthdayThisYear.getTime() < birth.getTime()) age -= 1
  return age
}

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

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
}: CandidatesScreenProps) {
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

            <ul>
              {state.data.candidates.map((candidate) => {
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
                            <dd>{brl.format(candidate.totalAssets)}</dd>
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
          </div>
        ))}

      <button type="button" onClick={onBack}>
        Voltar
      </button>
    </section>
  )
}