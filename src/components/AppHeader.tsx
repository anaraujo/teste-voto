import { ArrowLeft } from 'lucide-react'
import { parentPath, showsBackButton, type Route } from '../shared/router.ts'

interface AppHeaderProps {
  route: Route
  onNavigate: (to: string) => void
  /** Destino de voltar opcional (ex.: ficha sabe o cargo e quer voltar a ele). */
  parent?: string
}

/**
 * Cabeçalho com o botão de voltar. O destino é determinístico (ver
 * `parentPath`), então o botão nunca depende de um histórico guardado em estado.
 *
 * Ele vive direto no fundo da página, que é o teal do TSE, e é por isso que as
 * cores saem da paleta `tse-*` em vez do kit `Button`: o `--color-ink` que o kit
 * usa como anel de foco dá 2,58:1 sobre esse teal — abaixo do mínimo de 3:1 da
 * WCAG para indicador não textual, e o anel de teclado é a única pista de quem
 * não usa mouse. Aqui o anel é a própria tinta da página (`tse-mist-100`, que dá
 * 5,08:1) e o texto usa a mesma, com o `ink-700` de fundo no hover para marcar o
 * alvo sem precisar de borda.
 *
 * O `-ml-2` devolve ao texto o alinhamento da margem da página: o `px` do botão
 * é área de clique, não recuo.
 */

/*
 * Título de cada tela, para o cabeçalho. As que não têm título próprio — a
 * seleção de estado (que não mostra o cabeçalho), a ficha (o nome do candidato
 * vive no bloco da foto) e a pergunta (o título é o conteúdo) — ficam de fora.
 *
 * A lista de candidatos varia com o cargo; as demais são fixas por tela.
 */
const TITLES: Partial<Record<Route['name'], string>> = {
  result: 'Resultado',
  fairness: 'Imparcialidade do teste',
  'not-found': 'Página não encontrada',
}

function titleFor(route: Route): string | null {
  if (route.name === 'candidates') {
    if (route.office === 'federal') return 'Deputados Federais'
    return route.uf === 'DF' ? 'Deputados Distritais' : 'Deputados Estaduais'
  }
  return TITLES[route.name] ?? null
}

export function AppHeader({ route, onNavigate, parent }: AppHeaderProps) {
  if (!showsBackButton(route)) return null

  const target = parent ?? parentPath(route)
  const title = titleFor(route)
  // A lista de candidatos e a ficha de cada candidato compartilham o fundo
  // âmbar, então as duas usam a mesma tinta escura no cabeçalho.
  const onGreen = route.name === 'candidates'
  const onAmber = route.name === 'candidate'

  return (
    /*
     * Três colunas `1fr auto 1fr`: o botão fica no início, o título no meio e
     * as duas pontas de `1fr` são iguais, então o título fica no centro de
     * verdade — sem `absolute`, que deixaria o título por cima do botão em
     * telas estreitas. Sem título (ficha, pergunta), o botão continua no
     * início e as outras duas células ficam vazias.
     */
    <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-1">
      <button
        type="button"
        onClick={() => onNavigate(target)}
        className={`justify-self-start -ml-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tse-mist-100 ${
          onAmber
            ? 'text-muted-foreground hover:bg-tse-mist-100'
            : onGreen
              ? 'text-primary-on hover:bg-white/20'
              : 'text-tse-mist-100 hover:bg-tse-ink-700'
        }`}
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Voltar
      </button>
      {title && (
        <h1
          className={`font-titulo text-2xl font-semibold tracking-tight${
            onAmber
              ? ' text-muted-foreground'
              : onGreen
                ? ' text-primary-on'
                : ''
          }`}
        >
          {title}
        </h1>
      )}
      <span aria-hidden="true" />
    </header>
  )
}
