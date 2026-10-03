import { ArrowLeft } from 'lucide-react'
import { parentPath, showsBackButton, type Route } from '../shared/router.ts'

interface AppHeaderProps {
  route: Route
  onNavigate: (to: string) => void
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
export function AppHeader({ route, onNavigate }: AppHeaderProps) {
  if (!showsBackButton(route)) return null

  const target = parentPath(route)

  return (
    <header>
      <button
        type="button"
        onClick={() => onNavigate(target)}
        className="-ml-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-tse-mist-100 transition-colors hover:bg-tse-ink-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tse-mist-100"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Voltar
      </button>
    </header>
  )
}
