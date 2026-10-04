import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

/**
 * Superfície chapada para escolhas de navegação em bloco — o cartão de UF e a
 * alternância federal/estadual. Cor cheia, cantos arredondados, sem sombra.
 *
 * A cor vem do tom (`tone`), sempre um token do projeto. O layout (coluna,
 * altura, padding fino) fica com o chamador via `className`: o componente só
 * entrega a casca de cor, raio, foco e transição.
 */
const tileButtonVariants = cva(
  ' text-sora text-sm font-semibold uppercase border border-tse-ink-900 inline-flex rounded-lg no-underline transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2',
  {
    variants: {
      tone: {
        ink: 'bg-muted-foreground text-tse-mist hover:bg-tse-mist hover:text-muted-foreground focus-visible:outline-panel',
        primary:
          'text-flag-blue bg-tse-ink-200 hover:bg-tse-soft focus-visible:outline-ring',
        outline:
          'bg-white/20 text-flag-blue hover:bg-accent hover:text-accent-foreground focus-visible:outline-ring',
      },
      size: {
        sm: 'h-8 items-center justify-center gap-2 px-3 text-[0.85rem] font-medium',
        md: '',
      },
    },
    defaultVariants: { tone: 'ink', size: 'md' },
  },
)

export interface TileButtonProps
  extends ComponentProps<'a'>, VariantProps<typeof tileButtonVariants> {
  /** Renderiza o elemento filho no lugar do `<a>`, mantendo o estilo. */
  asChild?: boolean
}

export function TileButton({
  className,
  tone,
  size,
  asChild = false,
  ...props
}: TileButtonProps) {
  const Comp = asChild ? Slot : 'a'
  return (
    <Comp
      data-slot="tile-button"
      className={cn(tileButtonVariants({ tone, size }), className)}
      {...props}
    />
  )
}
