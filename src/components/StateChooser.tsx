import type { MouseEvent, ReactNode } from 'react'
import * as HoverCard from '@radix-ui/react-hover-card'
import { officeFor, type OfficeKind } from '../shared/elections.ts'
import { statePath } from '../shared/router.ts'
import { isModifiedClick } from '../lib/links.ts'

interface StateChooserProps {
  /** Sigla da UF, para montar os caminhos de cada cargo. */
  uf: string
  /** Chamado no clique simples (sem modificador) de um dos dois cargos. */
  onSelectState: (code: string, office: OfficeKind) => void
  /** Elemento-gatilho (o cartão/forma da UF). Precisa aceitar ref e foco. */
  children: ReactNode
}

/**
 * Escolha de cargo ao passar o mouse (ou focar) numa UF.
 *
 * Substitui o clique direto na UF: a pessoa primeiro escolhe entre deputado
 * federal e estadual. Os dois destinos são `<a>` de verdade (SEO + nova aba),
 * e o gatilho continua link para o federal — o clique simples abre a escolha
 * em vez de navegar, mas Ctrl/Cmd+clique ainda abre o federal numa aba nova.
 */
export function StateChooser({
  uf,
  onSelectState,
  children,
}: StateChooserProps) {
  const estadualLabel =
    officeFor(uf, 'estadual') === 'DEPUTADO DISTRITAL'
      ? 'Deputado distrital'
      : 'Deputado estadual'

  const navigate = (office: OfficeKind) => {
    return (event: MouseEvent<HTMLAnchorElement>) => {
      if (isModifiedClick(event)) return
      event.preventDefault()
      onSelectState(uf, office)
    }
  }

  return (
    <HoverCard.Root openDelay={150} closeDelay={150}>
      <HoverCard.Trigger asChild>{children}</HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          sideOffset={6}
          className="z-50 flex w-44 flex-col gap-1 rounded-lg border border-input bg-card p-1.5 text-left shadow-md"
        >
          <a
            className="rounded-md px-2.5 py-2 text-sm font-medium text-foreground no-underline transition-colors hover:bg-muted"
            href={statePath(uf, 'federal')}
            onClick={navigate('federal')}
          >
            Deputado federal
          </a>
          <a
            className="rounded-md px-2.5 py-2 text-sm font-medium text-foreground no-underline transition-colors hover:bg-muted"
            href={statePath(uf, 'estadual')}
            onClick={navigate('estadual')}
          >
            {estadualLabel}
          </a>
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  )
}
