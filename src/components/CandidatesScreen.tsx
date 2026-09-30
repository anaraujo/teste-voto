import type { ApiCandidate } from '../shared/api.ts'
import { candidatePath } from '../shared/router.ts'
import type { CandidatesLoadState } from '../hooks/useCandidates.ts'
import { partyColor, readableOn } from '../shared/party-colors.ts'
import { CandidateGrid, type CandidateItem } from './CandidateGrid.tsx'

interface CandidatesScreenProps {
  state: CandidatesLoadState
  onRetry: () => void
  onShowCandidate: (candidateId: string) => void
}

/** Clique com modificador (abrir em nova aba) não é interceptado. */
function isModifiedClick(event: {
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
  button: number
}): boolean {
  return (
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.button !== 0
  )
}

function toCandidateItem(candidate: ApiCandidate): CandidateItem {
  const partido = partyColor(candidate.partyAcronym)
  const base = partido.primary

  return {
    image: candidate.photoUrl,
    placeholder: candidate.ballotNumber,
    // Nome de urna, não o completo. O nome completo tem até 46 caracteres e
    // empurrava 8 dos 428 cards para 4 linhas; o de urna tem no máximo 30, e
    // 425 dos 428 cabem em duas.
    title: candidate.ballotName,
    number: candidate.ballotNumber,
    party: candidate.partyAcronym ?? 'Sem partido',
    // A tinta vem da cor, não do partido: `readableOn` escolhe entre branco e
    // #111 pelo contraste. Sobre as 30 primárias a escolha passa em AA, com
    // CIDADANIA como pior caso (4,66:1).
    textColor: readableOn(base),
    // Cor chapada. O texto fica sempre sobre ela, então um gradiente
    // deslocaria a luminância do fundo e o contraste medido acima deixaria de
    // valer na parte mais clara.
    base,
    children: (
      <a
        className="candidate-ficha"
        href={candidatePath(candidate.id)}
        onClick={(event) => {
          if (isModifiedClick(event)) return
          event.preventDefault()
        }}
      >
        Ver ficha
      </a>
    ),
  }
}

export function CandidatesScreen({
  state,
  onRetry,
  onShowCandidate,
}: CandidatesScreenProps) {
  if (state.status === 'loading') return <p>Carregando candidatos...</p>

  if (state.status === 'error') {
    return (
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
    )
  }

  if (state.data.candidates.length === 0) {
    return (
      <div>
        <p>Nenhum candidato encontrado para esta eleição.</p>
        <p>
          <small>
            Rode <code>npm run ingest</code> para carregar os dados oficiais do
            TSE.
          </small>
        </p>
      </div>
    )
  }

  const candidates = state.data.candidates

  return (
    <section>
      <h2>Candidatos</h2>
      <p>
        <small>
          {state.data.total} candidatos a {state.data.election.office} em{' '}
          {state.data.election.state} ({state.data.election.year}). Fonte:{' '}
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

      {/* Os 428 candidatos entram de uma vez. Não há paginação na API — o
        seed já vem inteiro — e as fotos são `loading="lazy"`, então o custo
        de render fica no navegador, não na rede. */}
      <CandidateGrid
        items={candidates.map(toCandidateItem)}
        onSelect={(_item, index) => onShowCandidate(candidates[index].id)}
      />
    </section>
  )
}
