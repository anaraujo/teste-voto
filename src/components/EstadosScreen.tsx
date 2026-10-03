import { BRAZIL_STATES } from '../data/brazil-map.ts'
import { isModifiedClick } from '../lib/links.ts'
import { statePath } from '../shared/router.ts'
import { BrazilMap } from './BrazilMap.tsx'
import './EstadosScreen.css'

interface EstadosScreenProps {
  /** Siglas das UFs que já têm lista. As demais aparecem como "em breve". */
  availableStates: readonly string[]
  /** Chamado ao escolher uma UF disponível (clique simples). */
  onSelectState: (code: string) => void
}

/**
 * Seleção de estado. Cada UF leva à própria lista de candidatos.
 *
 * Duas formas, um breakpoint. Abaixo de `md` (768px) a tela empilha: o mapa
 * primeiro, com no máximo 65svh de altura, e a grade de siglas depois. A página
 * rola, e tudo bem — 27 cartões não cabem na altura de um celular. O mapa vem
 * primeiro porque é o retrato do país e diz em um segundo onde a pessoa está
 * tentando votar; a grade continua sendo a navegação, já que uma malha de 360px
 * é um desenho, não um alvo de clique.
 *
 * De `md` para cima as duas dividem a linha e a tela para de crescer: quem dá a
 * altura é a janela (`h-dvh` no `<main>`) e o mapa encolhe até caber, sem
 * distorcer. O corte fica em `md` e não em `lg` porque é a largura que decide:
 * uma janela de 1280px com o console do navegador ancorado na lateral chega a
 * ~900px e, com o corte em `lg`, caía na forma empilhada — 1270px de página
 * numa janela de 700px. Entre `md` e `lg` a grade fica com três colunas para o
 * mapa não ficar com 130px. A tela inteira cabe a partir de uns 700px de altura
 * de janela — e, com o console do navegador aberto, a compressão de
 * `EstadosScreen.css` leva esse piso para ~490px a partir de `lg` e ~600px na
 * faixa de três colunas. Abaixo disso a página rola, e só para baixo: o `safe
 * center` da grade impede que as linhas transbordem por cima do título.
 */
export function EstadosScreen({
  availableStates,
  onSelectState,
}: EstadosScreenProps) {
  const available = new Set(availableStates)

  return (
    <section className="estados-secao mx-auto flex w-full flex-col gap-8 md:min-h-0 md:flex-1 md:gap-5">
      <header className="flex shrink-0 flex-col gap-2 text-center">
        <h1 className="font-titulo text-2xl font-semibold">
          Selecione seu estado
        </h1>
      </header>

      {/*
       * O mapa é medido pela altura (`height: 100%` em `BrazilMap.css`), então a
       * figura precisa de uma altura definida: ela vem do `md:h-dvh` no `<main>`
       * (altura definida, não `max-height`) somado ao `align-items: stretch`
       * padrão da linha, que estica a figura até a altura da linha. O
       * `justify-center` só mexe no eixo principal (horizontal), então não quebra
       * a cadeia; um `items-center` quebraria, porque a figura pararia de esticar
       * e o `height: 100%` cairia na proporção intrínseca. Quem centraliza o
       * conteúdo é o `align-content: safe center` da grade e o
       * `preserveAspectRatio` do mapa.
       */}
      <div className="flex flex-col gap-6 justify-center md:min-h-0 md:flex-row md:gap-6">
        <figure className="flex-1 mx-auto flex w-full md:w-auto flex-col md:mx-0 md:min-h-0">
          <div className="min-h-0 lg:flex-1">
            <BrazilMap
              availableStates={availableStates}
              hrefForState={statePath}
              onSelectState={onSelectState}
            />
          </div>
          <figcaption className="mt-2 text-center text-xs font-figtree">
            Malha territorial: IBGE, via @svg-maps/brazil (CC BY 4.0).
          </figcaption>
        </figure>

        {/*
         * A grade é de altura própria (quem centraliza é o `align-content: safe
         * center` de `EstadosScreen.css`, não esticá-la): esticar as linhas até
         * o rodapé da tela criaria cartões com ar por dentro. Quem encolhe numa
         * janela baixa é o mapa, que é imagem e se ajusta na caixa sem perder
         * proportionally — daí o cartão ter uma versão compacta a partir de
         * `md`.
         *
         * Três colunas entre `md` e `lg`, quatro a partir de `lg`: com quatro
         * a grade tem 551px de largura e sobra menos de 130px para o mapa aos
         * 768px de janela, e um mapa com 130px não é um mapa. É a única coisa
         * que a largura troca dentro da forma lado a lado.
         */}
        <ul className="flex-1 estados-grade grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-4">
          {BRAZIL_STATES.map((state) => {
            const isAvailable = available.has(state.code)

            return (
              <li key={state.code}>
                {isAvailable ? (
                  <a
                    className="estados-cartao flex h-full flex-col gap-0.5 rounded-lg bg-muted-foreground px-3 py-2 text-tse-mist no-underline transition-colors hover:bg-tse-mist hover:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panel md:gap-0 md:py-1.5"
                    href={statePath(state.code)}
                    onClick={(event) => {
                      if (isModifiedClick(event)) return
                      event.preventDefault()
                      onSelectState(state.code)
                    }}
                  >
                    <span className="estados-sigla font-space-grotesk text-lg font-semibold md:text-base">
                      {state.code}
                    </span>
                    <span className="estados-nome font-sora text-xs md:text-[0.6875rem]">
                      {state.name}
                    </span>
                  </a>
                ) : (
                  <div
                    aria-disabled="true"
                    className="estados-cartao flex h-full flex-col gap-1.5 rounded-lg border border-dashed border-canvas px-3 py-2 text-deep-foreground md:gap-1 md:py-1.5 justify-evenly"
                  >
                    <div className="flex flex-col">
                      <span className="estados-sigla font-space-grotesk text-lg font-semibold md:text-base">
                        {state.code}
                      </span>
                      <span className="estados-nome font-sora text-xs md:text-[0.6875rem] font-semibold">
                        {state.name}
                      </span>
                    </div>
                    <span className="estados-breve font-mono text-[7.5px] uppercase tracking-[2px] md:text-[0.5625rem] md:leading-3">
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
