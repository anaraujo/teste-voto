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
 * Duas formas, um breakpoint. Abaixo de `lg` a tela empilha: o mapa primeiro,
 * com no máximo 65svh de altura, e a grade de siglas depois. A página rola, e
 * tudo bem — 27 cartões não cabem na altura de um celular. O mapa vem primeiro
 * porque é o retrato do país e diz em um segundo onde a pessoa está tentando
 * votar; a grade continua sendo a navegação, já que uma malha de 360px é um
 * desenho, não um alvo de clique.
 *
 * De `lg` para cima as duas dividem a linha e a tela para de crescer: quem dá a
 * altura é a janela (`max-h-dvh` no `<main>`) e o mapa encolhe até caber, sem
 * distorcer. Com as sete linhas compactas de cartão, a tela inteira cabe a
 * partir de uns 670px de altura de janela; abaixo disso a página só ganha um
 * pouco de rolagem, sem cortar nada.
 */
export function EstadosScreen({
  availableStates,
  onSelectState,
}: EstadosScreenProps) {
  const available = new Set(availableStates)

  return (
    <section className="mx-auto flex w-full flex-col gap-8 lg:min-h-0 lg:flex-1 lg:gap-5">
      <header className="flex shrink-0 flex-col gap-2 text-center">
        <h1 className="text-2xl font-semibold">Selecione seu estado</h1>
      </header>

      <div className="flex flex-col gap-6 lg:min-h-0 lg:flex-1 lg:flex-row lg:gap-6">
        <figure className="mx-auto flex w-full flex-col lg:mx-0 lg:min-h-0 lg:flex-1">
          <div className="min-h-0 lg:flex-1">
            <BrazilMap
              availableStates={availableStates}
              hrefForState={() => CANDIDATES_PATH}
              onSelectState={onSelectState}
            />
          </div>
          <figcaption className="mt-2 shrink-0 text-center text-xs text-muted-foreground">
            Malha territorial: IBGE, via @svg-maps/brazil (CC BY 4.0).
          </figcaption>
        </figure>

        {/*
         * A grade é de altura própria (`content-center` só a centraliza na
         * linha): sete linhas de cartão cabem a partir de ~670px de altura de
         * janela, e esticá-la até o rodapé da tela só criaria cartões com ar
         * por dentro. Quem encolhe numa janela baixa é o mapa, que é imagem e
         * se ajusta na caixa sem perder proportionally — daí o cartão ter uma
         * versão compacta a partir de `lg`.
         */}
        <ul className="grid content-center grid-cols-3 gap-2 sm:grid-cols-4 lg:w-auto lg:shrink-0">
          {BRAZIL_STATES.map((state) => {
            const isAvailable = available.has(state.code)

            return (
              <li key={state.code}>
                {isAvailable ? (
                  <a
                    className="flex h-full flex-col gap-0.5 rounded-lg bg-tse-mist px-3 py-2 text-muted-foreground no-underline transition-colors hover:bg-muted-foreground hover:text-tse-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panel lg:gap-0 lg:py-1.5"
                    href={CANDIDATES_PATH}
                    onClick={(event) => {
                      if (isModifiedClick(event)) return
                      event.preventDefault()
                      onSelectState(state.code)
                    }}
                  >
                    <span className="text-lg font-semibold lg:text-base">
                      {state.code}
                    </span>
                    <span className="text-xs lg:text-[0.6875rem]">
                      {state.name}
                    </span>
                  </a>
                ) : (
                  <div
                    aria-disabled="true"
                    className="flex h-full flex-col gap-1.5 rounded-lg border border-dashed border-canvas px-3 py-2 text-deep-foreground lg:gap-1 lg:py-1.5"
                  >
                    <div className="flex flex-col">
                      <span className="text-lg font-semibold lg:text-base">
                        {state.code}
                      </span>
                      <span className="text-xs lg:text-[0.6875rem]">
                        {state.name}
                      </span>
                    </div>
                    <span className="text-[0.625rem] uppercase tracking-wide lg:text-[0.5625rem] lg:leading-3">
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
