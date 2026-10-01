import type { ApiCandidate } from '../shared/api.ts'
import { candidatePath } from '../shared/router.ts'
import type { CandidatesLoadState } from '../hooks/useCandidates.ts'
import { isModifiedClick } from '../lib/links.ts'
import { partyColor, readableFill, readableOn } from '../shared/party-colors.ts'
import { CandidateGrid, type CandidateItem } from './CandidateGrid.tsx'
import { Button } from './ui/button.tsx'
import { Card } from './ui/card.tsx'
import { Skeleton } from './ui/skeleton.tsx'

interface CandidatesScreenProps {
  state: CandidatesLoadState
  onRetry: () => void
  onShowCandidate: (candidateId: string) => void
}

function toCandidateItem(candidate: ApiCandidate): CandidateItem {
  const partido = partyColor(candidate.partyAcronym)
  const base = partido.primary
  const textColor = readableOn(base)
  const fill = readableFill(textColor)

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
    textColor,
    // Cor chapada. O texto fica sempre sobre ela, então um gradiente
    // deslocaria a luminância do fundo e o contraste medido acima deixaria de
    // valer na parte mais clara.
    base,
    // O preenchimento da pílula é a outra tinta, para as listras brigarem com
    // o texto em vez de se esconderem atrás dele. Ver `readableFill`.
    fill,
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
  /*
   * As três telas abaixo — carregando, erro e vazio — são as únicas que ainda
   * não tinham contêiner visual. `aria-live` faz a troca de uma para outra ser
   * anunciada: sem ele, quem navega pelo teclado só perceberia a mudança de
   * contexto pelo título da aba.
   */
  if (state.status === 'loading') {
    return (
      <section
        aria-live="polite"
        aria-busy="true"
        className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4"
      >
        <h2 className="text-xl font-semibold tracking-tight">Candidatos</h2>
        <span className="sr-only">Carregando candidatos...</span>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-lg" />
          ))}
        </div>
      </section>
    )
  }

  if (state.status === 'error') {
    return (
      <section
        aria-live="assertive"
        className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4"
      >
        <Card>
          <h2 className="text-base font-semibold">
            Não foi possível carregar a lista de candidatos.
          </h2>
          <p className="text-sm text-muted-foreground">
            Verifique se os dados do TSE foram carregados com{' '}
            <code>npm run ingest</code> e se a API está rodando.
          </p>
          <p className="text-xs text-muted-foreground">({state.message})</p>
          <div>
            <Button variant="outline" onClick={onRetry}>
              Tentar novamente
            </Button>
          </div>
        </Card>
      </section>
    )
  }

  if (state.data.candidates.length === 0) {
    return (
      <section
        aria-live="polite"
        className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4"
      >
        <Card>
          <h2 className="text-base font-semibold">
            Nenhum candidato encontrado para esta eleição.
          </h2>
          <p className="text-sm text-muted-foreground">
            Rode <code>npm run ingest</code> para carregar os dados oficiais do
            TSE.
          </p>
        </Card>
      </section>
    )
  }

  const candidates = state.data.candidates

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4">
      <h2 className="text-xl font-semibold tracking-tight">Candidatos</h2>
      <p className="text-sm text-muted-foreground">
        {state.data.total} candidatos a {state.data.election.office} em{' '}
        {state.data.election.state} ({state.data.election.year}). Fonte:{' '}
        <a
          className="underline underline-offset-4 hover:text-foreground"
          href="https://dadosabertos.tse.jus.br/"
          target="_blank"
          rel="noreferrer"
        >
          dados abertos do TSE
        </a>
        .
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
