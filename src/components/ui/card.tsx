import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn(
        'flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground',
        className,
      )}
      {...props}
    />
  )
}
