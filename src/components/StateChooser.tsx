import type { MouseEvent, ReactNode } from 'react'
import * as HoverCard from '@radix-ui/react-hover-card'
import { officeFor, type OfficeKind } from '../shared/elections.ts'
import { statePath } from '../shared/router.ts'
import { isModifiedClick } from '../lib/links.ts'
import { TileButton } from './ui/tile-button.tsx'

interface StateChooserProps {
  /** Sigla da UF, para montar os caminhos de cada cargo. */
  uf: string
  /** Chamado no clique simples (sem modificador) de um dos dois cargos. */
  onSelectState: (code: string, office: OfficeKind) => void
  /** Elemento-gatilho (o cartão/forma da UF). Precisa aceitar ref e foco. */
  children: ReactNode
  /** Força o seletor aberto (dev/estilo). Padrão: abre no hover/foco. */
  open?: boolean
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
  open,
}: StateChooserProps) {
  const federalLabel = 'Deputado Federal'
  const estadualLabel =
    officeFor(uf, 'estadual') === 'DEPUTADO DISTRITAL'
      ? 'Deputado Distrital'
      : 'Deputado Estadual'

  const navigate = (office: OfficeKind) => {
    return (event: MouseEvent<HTMLAnchorElement>) => {
      if (isModifiedClick(event)) return
      event.preventDefault()
      onSelectState(uf, office)
    }
  }

  return (
    <HoverCard.Root open={open} openDelay={150} closeDelay={150}>
      <HoverCard.Trigger asChild>{children}</HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          sideOffset={6}
          className="z-50 flex flex-col w-52 gap-1.5 rounded-lg border border-input bg-background/90 p-1.5 text-left shadow-md"
        >
          <span className="text-cyan-950 font-mono text-[10px] leading-2.5 text-center uppercase tracking-[1.5px]">Quero encontrar um</span>
          <div className="flex gap-1.5 font-mono text-[10px] leading-2.5 text-center uppercase tracking-[1.5px]">
            <TileButton
              tone="ink"
              href={statePath(uf, 'federal')}
              onClick={navigate('federal')}
              className="rounded-sm flex-1 justify-center px-4 py-1 font-medium"
            >
              {federalLabel}
            </TileButton>
            <TileButton
              tone="ink"
              href={statePath(uf, 'estadual')}
              onClick={navigate('estadual')}
              className="rounded-sm flex-1 justify-center px-4 py-1 font-medium"
            >
              {estadualLabel}
            </TileButton>
          </div>
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  )
}
