import { BRAZIL_STATES } from '../data/brazil-map.ts'
import { isModifiedClick } from '../lib/links.ts'
import { CANDIDATES_PATH } from '../shared/router.ts'
import { BrazilMap } from './BrazilMap.tsx'

interface EstadosScreenProps {
  /** Siglas das UFs que já têm lista. As demais aparecem como "em breve". */
  availableStates: readonly string[]
  /** Chamado ao escolher uma UF disponível (clique simples). */
  onSelectState: (code: string) => void
}

/**
 * Seleção de estado. Hoje só o Paraná tem dados, então ele é a única UF
 * clicável; as demais já aparecem no mapa e na grade, marcadas como "em breve",
 * para que a expansão futura seja só liberar a sigla — nada de refazer a tela.
 *
 * O mapa some no celular (a malha fica ilegível em tela pequena) e a grade de
 * siglas, que funciona em qualquer largura, continua sendo a navegação — a
 * mesma decisão do exemplo que inspirou esta tela.
 */
export function EstadosScreen({
  availableStates,
  onSelectState,
}: EstadosScreenProps) {
  const available = new Set(availableStates)

  return (
    <section className="mx-auto flex w-full flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-semibold">Escolha o seu estado</h1>
      </header>

      <div className="flex gap-6">
        <figure className="grow hidden sm:block">
          <BrazilMap
            availableStates={availableStates}
            hrefForState={() => CANDIDATES_PATH}
            onSelectState={onSelectState}
          />
          <figcaption className="mt-2 text-center text-xs text-muted-foreground">
            Malha territorial: IBGE, via @svg-maps/brazil (CC BY 4.0).
          </figcaption>
        </figure>

        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {BRAZIL_STATES.map((state) => {
            const isAvailable = available.has(state.code)

            return (
              <li key={state.code}>
                {isAvailable ? (
                  <a
                    className="flex h-full flex-col gap-0.5 rounded-lg bg-primary px-3 py-2 text-primary-foreground no-underline transition-colors hover:bg-logo-yellow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panel"
                    href={CANDIDATES_PATH}
                    onClick={(event) => {
                      if (isModifiedClick(event)) return
                      event.preventDefault()
                      onSelectState(state.code)
                    }}
                  >
                    <span className="text-lg font-semibold">{state.code}</span>
                    <span className="text-xs">{state.name}</span>
                  </a>
                ) : (
                  <div
                    aria-disabled="true"
                    className="flex h-full flex-col gap-0.5 rounded-lg border border-dashed border-border px-3 py-2 text-muted-foreground"
                  >
                    <span className="text-lg font-semibold">{state.code}</span>
                    <span className="text-xs">{state.name}</span>
                    <span className="text-[0.625rem] uppercase tracking-wide">
                      Em breve
                    </span>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
