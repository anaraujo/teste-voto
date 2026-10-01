/*
 * Candidate Grid — experimental, em avaliação visual.
 *
 * Grade de cards de candidato. O card é chapado na cor primária do partido
 * e o texto usa a tinta que `readableOn` escolhe para essa cor, o que faz as
 * 30 cores passarem em AA sem nenhum ajuste por partido.
 *
 * O componente nasceu como uma porta do ChromaGrid do reactbits (open source,
 * DavidHDev/react-bits — public/r/ChromaGrid-TS-CSS.json), que revelava a cor
 * num disco de `backdrop-filter` seguindo o mouse. Isso saiu: o filtro levava
 * a cor do partido a um cinza médio onde nenhuma das duas tintas candidatas
 * tem contraste, e nenhuma combinação de `grayscale`/`brightness` resolvia.
 * O que restou do original foi o card quebrado em header, corpo e footer. O
 * `onSelect` substitui o `window.open` do demo, que existia porque os cards
 * apontavam para perfil de rede social — aqui o card leva para a ficha.
 *
 * O único efeito é o highlight de hover/foco, em CSS.
 */

import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react'
import './CandidateGrid.css'

/** 0.95rem — o tamanho de desenho do nome, o maior que ele pode ter. */
const NAME_MAX_PX = 15.2
/** 0.78rem — o piso. Abaixo disso o nome não compete com a sigla. */
const NAME_MIN_PX = 12.48

/*
 * A tela é renderizada no servidor (`entry-server.tsx`) e `useLayoutEffect` não
 * tem o que medir lá. Escolher o hook pela existence do `window` mantém a
 * ordem dos hooks igual nos dois lados e não dispara o aviso do React; no
 * cliente ele roda antes da pintura, então o nome já aparece no tamanho
 * certo e não há salto.
 */
const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect

/*
 * Encolhe o nome de urna até caber em uma linha, elemento por elemento.
 *
 * A medida é do elemento renderizado, não uma contagem de letras: "MARISA
 * LOBO - PSICÓLOGA CRISTÃ" e "JOÃO DA SILVA JR." têm 30 caracteres e larguras
 * bem diferentes. O truque é que a largura do texto é proporcional ao
 * `font-size` — o tracking é `0.05em`, então encolhe junto — e por isso uma
 * única medição no tamanho máximo já diz o tamanho que cabe:
 *
 *     alvo = MÁX × disponível / natural
 *
 * O que obriga a passar por navegador em vez de cálculo é o `text-transform:
 * uppercase` e o arredondamento do rasterizador, por isso a última fase
 * confere e, se ainda transbordar, deixa quebrar em duas linhas como antes.
 *
 * O custo é de layout, e é por isso que as fases são agrupadas: escrever o
 * tamanho e ler `scrollWidth` alternados forçam um layout por elemento, o
 * que em 428 cards seria segundo(s) de jank. Escritas de um lado, leituras do
 * outro, são três layouts para o grid inteiro.
 *
 * As colunas do grid são fixas em `--card-width`, então a largura disponível do
 * nome não muda com o resize da janela: uma medição por nome serve até a lista
 * de candidatos mudar, e não há listener de `resize` para manter.
 *
 * A fonte é a Inter, com `font-display: swap`, então ela chega depois da
 * pintura. Medir antes faria o cálculo inteiro valer para a fonte do sistema e
 * o nome ficaria grande demais ou pequeno demais para sempre. Por isso o
 * efeito espera `document.fonts.ready`.
 */
function fitNames(grid: HTMLElement): void {
  const names = Array.from(
    grid.querySelectorAll<HTMLHeadingElement>('.candidate-info .name'),
  )
  if (names.length === 0) {
    return
  }

  const available = names.map((el) => el.clientWidth)

  // Fase 1: todos no máximo e sem quebra, e uma única leitura.
  for (const el of names) {
    el.style.setProperty('--name-size', `${NAME_MAX_PX}px`)
    el.style.whiteSpace = 'nowrap'
  }
  const natural = names.map((el) => el.scrollWidth)

  // Fase 2: a estimativa. O piso entra aqui.
  const wanted = names.map((_, index) =>
    natural[index] <= available[index]
      ? NAME_MAX_PX
      : Math.max(
          NAME_MIN_PX,
          (NAME_MAX_PX * available[index]) / natural[index],
        ),
  )

  // Fase 3: aplica tudo e confere de uma vez.
  for (const [index, el] of names.entries()) {
    el.style.setProperty('--name-size', `${wanted[index]}px`)
  }
  const measured = names.map((el) => el.scrollWidth)

  const overflowing = names
    .map((_, index) => (measured[index] > available[index] ? index : -1))
    .filter((index) => index >= 0)
  if (overflowing.length === 0) {
    return
  }

  // Fase 4: os que ainda passam batem na medida real, refazem a conta sobre
  // ela. Só estes são medidos de novo — quem coube sai da conta.
  for (const index of overflowing) {
    if (wanted[index] > NAME_MIN_PX) {
      names[index].style.setProperty(
        '--name-size',
        `${Math.max(NAME_MIN_PX, (wanted[index] * available[index]) / measured[index])}px`,
      )
    }
  }
  const corrected = overflowing.map((index) => names[index].scrollWidth)

  // Fase 5: o que ainda transborda no piso volta a quebrar em duas linhas, que
  // é o que acontecia antes de este ajuste existir.
  overflowing.forEach((index, position) => {
    if (corrected[position] > available[index]) {
      names[index].style.whiteSpace = ''
    }
  })
}

export interface CandidateItem {
  /** Foto (URL absoluta ou relativa a /photos). Sem foto, cai no placeholder. */
  image: string | null
  title: string
  /** Número de urna, no header. */
  number?: string
  /** Sigla do partido, abaixo do nome. */
  party?: string
  /**
   * Cor de fundo do card. Chapada, sem gradiente: o texto fica sempre sobre
   * ela, e qualquer variação de luminosidade quebraria o contraste que a
   * `textColor` abaixo garante.
   */
  base?: string
  /**
   * Cor do texto sobre a cor do card. Precisa vir declarada junto com a cor
   * do card (os tokens `-on` do index.css), senão o texto fixo #fff some
   * sobre cor clara.
   */
  textColor?: string
  /**
   * Cor das listras da pílula "Ver ficha". É a tinta contrária à `textColor`
   * acima, porque o texto da pílula é o mesmo do card e passa por cima delas.
   * Vem de `readableFill`.
   */
  fill?: string
  /** Rótulo do placeholder quando não há foto. */
  placeholder?: string
  /** Conteúdo extra dentro do card (o resto dos dados do candidato). */
  children?: ReactNode
}

export interface CandidateGridProps {
  items: CandidateItem[]
  className?: string
  onSelect?: (item: CandidateItem, index: number) => void
}

export function CandidateGrid({
  items,
  className = '',
  onSelect,
}: CandidateGridProps) {
  const gridRef = useRef<HTMLDivElement | null>(null)

  /*
   * A chave é o nome de urna em vez de `items`, que `CandidatesScreen` reconstrói
   * a cada render. Sem isto o ajuste rodaria em toda renderização, e cada uma
   * custa três layouts de 428 cards para não mudar nada.
   */
  const namesKey = items.map((item) => item.title).join('\u0000')

  useIsomorphicLayoutEffect(() => {
    const grid = gridRef.current
    if (!grid) {
      return
    }

    /*
     * A Inter entra com `font-display: swap`, ou seja depois da primeira
     * pintura. Medir na hora mediria a fonte do sistema, e o tamanho escolhido
     * a partir dessa medida errada ficaria no card para sempre. Por isso a
     * espera.
     *
     * `document.fonts.ready` resolve uma vez só, quando todas as fontes da
     * página acabaram. Se já tiver resolvido — segunda navegação, ou fonte vinda
     * do cache — a promessa resolve no próximo microtask e o custo é zero.
     */
    let cancelled = false
    void document.fonts.ready.then(() => {
      if (!cancelled && gridRef.current) {
        fitNames(gridRef.current)
      }
    })

    return () => {
      cancelled = true
    }
  }, [namesKey])

  return (
    <div ref={gridRef} className={`candidate-grid ${className}`}>
      {items.map((item, index) => (
        <article
          key={`${item.title}-${index}`}
          className="candidate-card"
          onClick={(event) => {
            // Com modificador, quem abre em nova aba é o <a> da ficha; não
            // navega o app junto.
            if (
              event.metaKey ||
              event.ctrlKey ||
              event.shiftKey ||
              event.altKey ||
              event.button !== 0
            ) {
              return
            }
            onSelect?.(item, index)
          }}
          style={
            {
              '--card-on': item.textColor ?? '#fff',
              '--card-base': item.base,
              '--card-fill': item.fill,
              cursor: onSelect ? 'pointer' : 'default',
            } as CSSProperties
          }
        >
          <header className="candidate-head">
            {item.number && <span className="head-value">{item.number}</span>}
            {item.party && <p className="party">{item.party}</p>}
          </header>
          <div className="candidate-img-wrapper">
            {item.image ? (
              <img src={item.image} alt={item.title} loading="lazy" />
            ) : (
              <span className="candidate-img-placeholder" aria-hidden="true">
                {item.placeholder ?? ''}
              </span>
            )}
          </div>
          <div className="candidate-info">
            <h3 className="name">{item.title}</h3>
          </div>
          <footer className="candidate-foot">{item.children}</footer>
        </article>
      ))}
    </div>
  )
}
