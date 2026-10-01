import type { ApiCandidate } from '../shared/api.ts'
import { candidatePath } from '../shared/router.ts'
import type { CandidatesLoadState } from '../hooks/useCandidates.ts'
import { isModifiedClick } from '../lib/links.ts'
import { partyColor, readableFill, readableOn } from '../shared/party-colors.ts'
import { CandidateGrid, type CandidateItem } from './CandidateGrid.tsx'
// O esqueleto de carregamento usa a classe `.candidate-grid`, e no estado de
// carregamento o `CandidateGrid` não é montado para trazer o CSS junto.
import './CandidateGrid.css'
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
        className="mx-auto flex w-full flex-col gap-3 px-4"
      >
        <h2 className="text-xl font-semibold tracking-tight">Candidatos</h2>
        <span className="sr-only">Carregando candidatos...</span>
        {/*
         * O esqueleto usa a classe do grid de verdade em vez de contar
         * colunas no Tailwind. `grid-cols` com `lg:` é um degrau de viewport,
         * e o grid real resolve as colunas contra o próprio `--max-columns`. Os
         * dois nunca casavam.
         *
         * O número de esqueletos é 8 na mão porque o `--max-columns` é uma
         * custom property do CSS, e o JS não a lê. Numa tela estreita sobram
         * esqueletos fora da vista, que é a mesma coisa que acontece com o
         * grid real. Precisa acompanhar o `--max-columns` do CSS à mão.
         *
         * A altura é a da foto (`aspect-161/225`), não a do card inteiro: um
         * card real tem header, foto, nome e a pílula "Ver ficha" empilhados.
         * Este esqueleto é só a caixa da foto, então ele é mais curto que o
         * card que substitui e a página sobe quando os dados chegam.
         *
         * A largura não é fixada: vem da coluna do grid, que é o que o
         * esqueleto precisa acompanhar. Fixar os dois lados aqui faria o
         * esqueleto discordar do grid real de novo em cada ajuste de tamanho.
         */}
        <div className="candidate-grid" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="aspect-161/225 rounded-[20px]" />
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
    /*
     * Sem `max-w-*`: o teto de colunas mora no `CandidateGrid.css`, em
     * `--max-columns`, e a section só cede a largura que sobra. Ver o
     * comentário do `.candidate-grid`.
     */
    <section className="mx-auto flex w-full flex-col gap-3 px-4">
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
