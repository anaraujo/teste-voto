import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

export function Input({ className, type, ...props }: ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        /*
         * `bg-card` e não `bg-background`: o `--background` é o canvas, e um
         * campo com a mesma cor da página é um buraco no layout. O shadcn usa
         * `bg-background` porque o canvas dele é quase branco e a borda sozinha
         * basta; com o canvas no `ink-200` o campo desaparece. Na superfície
         * elevada ele fica a 2,03:1 da página e o texto a 14,36:1.
         *
         * O `min-w` é `0` no celular e `sm:min-w-85` (340px) do breakpoint
         * para cima. O piso existe para o campo não virar uma fresta quando a
         * busca divide a linha com a alternância de cargo, e esse é o arranjo
         * só a partir de 640px — abaixo disso a `.candidates-header` embrulha e a
         * busca fica com a linha inteira, onde o `w-full` já resolve. Como piso
         * fixo, os 340px transbordavam sozinhos abaixo de ~372px de viewport.
         */
        'flex h-8 w-full min-w-0 rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-85',
        className,
      )}
      {...props}
    />
  )
}
