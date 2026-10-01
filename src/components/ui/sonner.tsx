import { Toaster as Sonner, type ToasterProps } from 'sonner'

/**
 * Aviso efêmero. As mensagens do app são poucas e nunca bloqueantes — o
 * resultado, a ficha e o quiz são todos navegáveis sem toast — então isto serve
 * para o mérito de uma ação (copiar um link, reenviar os dados), não para
 * erros: erro fica na tela, com o texto e o botão de tentar de novo.
 *
 * Montar uma vez, perto da raiz.
 */
export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="bottom-center"
      toastOptions={{
        classNames: {
          toast:
            'rounded-lg border border-border bg-card text-card-foreground shadow-lg',
          description: 'text-muted-foreground',
        },
      }}
      {...props}
    />
  )
}
