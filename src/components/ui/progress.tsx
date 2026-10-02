import * as ProgressPrimitive from '@radix-ui/react-progress'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

/**
 * Barra de progresso. A cor de preenchimento acompanha a pergunta atual, para
 * o passo acompanhar a identidade (`--color-primary` / `-secondary` /
 * `-tertiary` na ordem das perguntas do quiz).
 */
export function Progress({
  className,
  value,
  tone = 'primary',
  ...props
}: ComponentProps<typeof ProgressPrimitive.Root> & {
  tone?: 'primary' | 'secondary' | 'tertiary'
}) {
  const toneClass = {
    primary: 'bg-primary',
    secondary: 'bg-secondary',
    tertiary: 'bg-tertiary',
  }[tone]

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        'relative h-2 w-full overflow-hidden rounded-full bg-muted',
        className,
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn('h-full w-full flex-1 transition-transform', toneClass)}
        style={{ transform: `translateX(-${100 - (value ?? 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}
