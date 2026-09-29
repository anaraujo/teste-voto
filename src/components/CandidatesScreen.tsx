import { useState } from 'react'
import type { ApiCandidate } from '../shared/api.ts'
import { candidatePath } from '../shared/router.ts'
import type { CandidatesLoadState } from '../hooks/useCandidates.ts'
import { partyColor, readableOn } from '../shared/party-colors.ts'
import { ChromaGrid, type ChromaItem } from './ChromaGrid.tsx'

interface CandidatesScreenProps {
  state: CandidatesLoadState
  onRetry: () => void
  onShowCandidate: (candidateId: string) => void
}

/** Quantos cards entram por vez, para a página não ficar com 428 de uma vez. */
const PAGE = 50

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

function toChromaItem(candidate: ApiCandidate): ChromaItem {
  const partido = partyColor(candidate.partyAcronym)
  const base = partido.primary

  return {
    image: candidate.photoUrl,
    placeholder: candidate.ballotNumber,
    // Nome completo, não o nome de urna: os dois são quase sempre diferentes
    // ("MARCO BRASIL" na urna, "MARCO AURELIO RIBEIRO" no registro). Nos 428
    // candidatos nenhum `full_name` vem vazio, e 24 são iguais ao nome de urna
    // — nesse caso mostrar os dois seria repetir a mesma linha.
    title: candidate.fullName || candidate.ballotName,
    party: candidate.partyAcronym ?? 'Sem partido',
    handle: candidate.ballotNumber ? `Nº ${candidate.ballotNumber}` : undefined,
    // A tinta vem da cor, não do partido: `readableOn` escolhe entre branco e
    // #111 pelo contraste, e nas 30 cores a escolha passa em AA.
    textColor: readableOn(base),
    // Sem preto: um tom mais claro da própria cor no topo (a moldura em volta
    // da foto) e a cor cheia embaixo, onde fica o texto. A versão anterior
    // terminava em `rgb(0 0 0 / 0.6)`, que lavava o card.
    gradient: `linear-gradient(160deg, color-mix(in srgb, ${base} 22%, white), ${base})`,
    children: (
      <a
        className="chroma-ficha"
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
  const [limit, setLimit] = useState(PAGE)

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
  const visible = candidates.slice(0, limit)

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

      <ChromaGrid
        items={visible.map(toChromaItem)}
        onSelect={(_item, index) => onShowCandidate(visible[index].id)}
      />

      {limit < candidates.length && (
        <p>
          <button type="button" onClick={() => setLimit(limit + PAGE)}>
            Mostrar mais {Math.min(PAGE, candidates.length - limit)} de{' '}
            {candidates.length - visible.length} restantes
          </button>
        </p>
      )}
    </section>
  )
}
