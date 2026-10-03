import { useMemo, useState } from 'react'
import type { ApiCandidate } from '../shared/api.ts'
import { candidatePath, statePath } from '../shared/router.ts'
import type { OfficeKind } from '../shared/elections.ts'
import type { CandidatesLoadState } from '../hooks/useCandidates.ts'
import { isModifiedClick } from '../lib/links.ts'
import { cn } from '../lib/utils.ts'
import { buildSearchIndex, searchCandidates } from '../lib/search.ts'
import { partyColor, readableFill, readableOn } from '../shared/party-colors.ts'
import { CandidateGrid, type CandidateItem } from './CandidateGrid.tsx'
// O esqueleto de carregamento usa a classe `.candidate-grid`, e no estado de
// carregamento o `CandidateGrid` não é montado para trazer o CSS junto.
import './CandidateGrid.css'
import './CandidatesScreen.css'
import { Button } from './ui/button.tsx'
import { Card } from './ui/card.tsx'
import { Input } from './ui/input.tsx'
import { Skeleton } from './ui/skeleton.tsx'
import { TileButton } from './ui/tile-button.tsx'

interface CandidatesScreenProps {
  state: CandidatesLoadState
  /** UF da lista, para montar o link do outro cargo. */
  uf: string
  /** Cargo atual da lista (federal ou estadual). */
  office: OfficeKind
  /** true enquanto busca um cargo que ainda não tem dado fresco em tela. */
  refetching: boolean
  /** Navega para a lista do outro cargo (federal ⇄ estadual). */
  onShowOffice: (office: OfficeKind) => void
  onRetry: () => void
  onShowCandidate: (candidateId: string) => void
}

/** Rótulo amigável do cargo de uma UF (distrital no DF). */
function officeLabelFor(uf: string, office: OfficeKind): string {
  if (office === 'federal') return 'Deputados federais'
  return uf === 'DF' ? 'Deputados distritais' : 'Deputados estaduais'
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
        {/* Decorativa: o link já diz "Ver ficha". `aria-hidden` porque repetir
            a informação no leitor de tela só encarece a navegação de 428 itens. */}
        <span className="candidate-ficha__arrow" aria-hidden="true">
          →
        </span>
        Ver ficha
      </a>
    ),
  }
}

export function CandidatesScreen({
  state,
  uf,
  office,
  refetching,
  onShowOffice,
  onRetry,
  onShowCandidate,
}: CandidatesScreenProps) {
  /*
   * A busca filtra no submit, não a cada tecla, e o índice normalizado é
   * memoizado para a digitação não recusturar os 428 nomes. `searchCandidates`
   * com busca vazia devolve a lista inteira, então o mesmo caminho serve à
   * lista completa e ao resultado filtrado.
   */
  const [query, setQuery] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')

  const index = useMemo(
    () =>
      state.status === 'ready' ? buildSearchIndex(state.data.candidates) : [],
    [state],
  )

  const filtered = useMemo(
    () => searchCandidates(index, appliedQuery),
    [index, appliedQuery],
  )

  /*
   * A busca e a alternância de cargo são a estrutura em comum que fica montada
   * o tempo todo. Ao trocar de cargo, só o corpo troca (lista → esqueleto →
   * lista), em vez de desmontar a página inteira e piscar no carregamento.
   */
  const searchForm = (
    <form
      className="inline-flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        setAppliedQuery(query)
      }}
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <label className="text-sm font-medium" htmlFor="candidate-search">
          Buscar candidato
        </label>
        <Input
          id="candidate-search"
          type="search"
          placeholder="Nome, número, partido, ocupação, cidade..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <Button type="submit">Buscar</Button>
      {appliedQuery !== '' && (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setQuery('')
            setAppliedQuery('')
          }}
        >
          Limpar
        </Button>
      )}
    </form>
  )

  const toggleNav = (
    <nav aria-label="Cargo" className="flex flex-wrap gap-2">
      <TileButton
        asChild
        size="sm"
        tone={office === 'federal' ? 'primary' : 'outline'}
      >
        <a
          href={statePath(uf, 'federal')}
          aria-current={office === 'federal' ? 'page' : undefined}
          onClick={(event) => {
            if (isModifiedClick(event)) return
            event.preventDefault()
            onShowOffice('federal')
          }}
        >
          Deputados federais
        </a>
      </TileButton>
      <TileButton
        asChild
        size="sm"
        tone={office === 'estadual' ? 'primary' : 'outline'}
      >
        <a
          href={statePath(uf, 'estadual')}
          aria-current={office === 'estadual' ? 'page' : undefined}
          onClick={(event) => {
            if (isModifiedClick(event)) return
            event.preventDefault()
            onShowOffice('estadual')
          }}
        >
          {officeLabelFor(uf, 'estadual')}
        </a>
      </TileButton>
    </nav>
  )

  /*
   * `aria-live` faz a troca de estado ser anunciada: sem ele, quem navega pelo
   * teclado só perceberia a mudança de contexto pelo título da aba.
   */
  if (state.status === 'error') {
    return (
      <section
        aria-live="assertive"
        className="candidates-section candidates-section--message"
      >
        {toggleNav}
        <Card>
          <h2 className="text-base font-semibold">
            Não foi possível carregar a lista de candidatos.
          </h2>
          <p className="text-sm">
            Verifique se os dados do TSE foram carregados com{' '}
            <code>npm run ingest</code> e se a API está rodando.
          </p>
          <p className="text-xs">({state.message})</p>
          <div>
            <Button variant="outline" onClick={onRetry}>
              Tentar novamente
            </Button>
          </div>
        </Card>
      </section>
    )
  }

  if (state.status === 'ready' && state.data.candidates.length === 0) {
    return (
      <section
        aria-live="polite"
        className="candidates-section candidates-section--message"
      >
        {toggleNav}
        <Card>
          <h2 className="text-base font-semibold">
            Nenhum candidato encontrado para esta eleição.
          </h2>
          <p className="text-sm">
            Rode <code>npm run ingest</code> para carregar os dados oficiais do
            TSE.
          </p>
        </Card>
      </section>
    )
  }

  return (
    /*
     * Sem `max-w-*`: o teto de colunas mora no `CandidateGrid.css`, em
     * `--max-columns`, e a section só cede a largura que sobra. Ver o
     * comentário do `.candidate-grid`.
     */
    <section className="candidates-section">
      <div className="candidates-header">
        {searchForm}
        {toggleNav}
      </div>

      {state.status === 'loading' ? (
        <div aria-busy="true">
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
        </div>
      ) : (
        <div
          aria-busy={refetching || undefined}
          className={cn(
            'flex flex-col gap-3 transition-opacity duration-200',
            refetching && 'opacity-60',
          )}
        >
          <p className="text-sm">
            Ao todo, temos <strong>{state.data.total}</strong> candidatos a{' '}
            <strong>{state.data.election.office}</strong> em{' '}
            <strong>
              {state.data.election.year} ({state.data.election.state})
            </strong>
            . Fonte:{' '}
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

          {appliedQuery !== '' && filtered.length > 0 && (
            <p className="text-sm">
              {filtered.length === 1
                ? '1 candidato encontrado'
                : `${filtered.length} candidatos encontrados`}
            </p>
          )}

          {appliedQuery !== '' && filtered.length === 0 ? (
            <Card>
              <p className="text-sm">
                Nenhum candidato encontrado para sua busca.
              </p>
            </Card>
          ) : (
            /* A lista não pagina e as fotos são `loading="lazy"`, então o custo de
               render fica no navegador, não na rede. É essa lista que a busca
               filtra. */
            <CandidateGrid
              items={filtered.map(toCandidateItem)}
              onSelect={(_item, index) => onShowCandidate(filtered[index].id)}
            />
          )}
        </div>
      )}
    </section>
  )
}
