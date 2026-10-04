import { useCallback, useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import './GooeyNav.css'

/**
 * GooeyNav — a navegação de abas, com a pílula que "derrete" (port do
 * componente homônimo do react-bits).
 *
 * A pílula e as partículas são **a mesma camada filtrada**, e é isso que produz
 * o efeito: `blur(7px)` seguido de `contrast(100)` é a técnica de metaball, e
 * ela só cria fusão e filamento onde duas formas borradas se tocam. Com uma
 * forma só dentro do blur, o blur arredonda e o contraste reendurece, e o
 * resultado é exatamente a mesma forma — um círculo, sem nada derretido.
 *
 * Por isso as partículas são filhas do elemento com `filter`, e não uma camada
 * irmã: fora do filtro elas viram pontinhos sólidos que voam e somem, que é o
 * oposto de goo. A cor delas vem da pílula (`--gooey-pill`) pelo mesmo motivo —
 * o `contrast(100)` é um limiar duro, e um tom médio sai preto (que o `lighten`
 * esconde) ou branco. O `::before` preto com 75px de folga é o que dá tela para
 * o `lighten` comparar e o que impede o filtro de tosar as partículas na borda.
 *
 * Quatro mudanças em relação ao original:
 *
 * 1. **Controlada.** O original guarda `activeIndex` em estado próprio e só o
 *    define na montagem. Aqui a aba mora na URL (`?tab=`), então o item ativo
 *    vem por prop — inclusive quando muda pelo teclado, e não só por clique.
 * 2. **`button` em vez de `a href`.** As abas não são links: são `role="tab"`
 *    dentro de um `tablist`, e um `href="#"` só custaria um salto de página.
 * 3. **Superfície escura.** O original compõe sobre preto, e é isso que faz o
 *    `lighten` funcionar: partícula clara sobre fundo escuro. Sobre o canvas da
 *    ficha elas sumiriam, então a cápsula escura é da própria navegação. A cor
 *    vem do partido, escurecida para o branco da pílula ter contraste.
 * 4. **Sem `palette`/`colors`.** O original deixa o JS escolher a cor de cada
 *    partícula; aqui a cor é a da pílula, porque dentro do filtro uma cor de
 *    partido não sobrevive ao `contrast(100)` — ver o `.point` no CSS.
 */

export interface GooeyNavItem {
  /** `id` do elemento, para o `aria-labelledby` do painel de cada aba. */
  id: string
  label: string
  /** Nome completo da aba, lido por leitor de tela. */
  description: string
  onClick: () => void
}

export interface GooeyNavProps {
  items: GooeyNavItem[]
  /** Índice do item ativo. Controlado pela tela. */
  activeIndex: number
  /** Cor de destaque; a ficha passa a cor do partido. */
  accentColor?: string
  /** Quantas partículas por clique. */
  particleCount?: number
  /** Distâncias, em px, de origem e destino de cada partícula. */
  particleDistances?: [number, number]
  /** Raio que espalha o ângulo das partículas. */
  particleR?: number
  /** Duração base da animação, em ms. */
  animationTime?: number
  /** Variação aleatória do tempo, em ms. */
  timeVariance?: number
  ariaLabel?: string
  className?: string
}

export function GooeyNav({
  items,
  activeIndex,
  accentColor,
  particleCount = 10,
  particleDistances = [60, 0],
  particleR = 100,
  animationTime = 300,
  timeVariance = 300,
  ariaLabel = 'Abas da ficha',
  className = '',
}: GooeyNavProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const navRef = useRef<HTMLUListElement>(null)
  const filterRef = useRef<HTMLSpanElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const activeRef = useRef(activeIndex)

  /**
   * Move a pílula borrada e o texto por cima para cima do item ativo.
   *
   * Só dois elementos são posicionados: o filtrado — que agora carrega as
   * partículas dentro de si — e a cópia do texto. Não há mais uma camada de
   * partículas para acertar.
   *
   * Depende só de refs, então a identidade é estável e o efeito que a chama não
   * precisa de `activeIndex` na lista de dependências para não se refazer a
   * cada quadro.
   */
  const updateEffectPosition = useCallback((element: HTMLElement) => {
    const container = containerRef.current
    const filter = filterRef.current
    const text = textRef.current
    if (!container || !filter || !text) return

    const containerRect = container.getBoundingClientRect()
    const pos = element.getBoundingClientRect()
    Object.assign(filter.style, {
      left: `${pos.x - containerRect.x}px`,
      top: `${pos.y - containerRect.y}px`,
      width: `${pos.width}px`,
      height: `${pos.height}px`,
    })
    Object.assign(text.style, {
      left: `${pos.x - containerRect.x}px`,
      top: `${pos.y - containerRect.y}px`,
      width: `${pos.width}px`,
      height: `${pos.height}px`,
    })
    text.innerText = element.innerText
  }, [])

  /**
   * Troca de aba. O original só dispara a animação no clique; aqui ela roda
   * sempre que o índice muda, para que as setas do teclado derretem a pílula
   * também.
   *
   * `Math.random` aparece em `noise`, então nada daqui pode rodar durante a
   * renderização: só dentro de efeito, nunca no servidor.
   */
  useEffect(() => {
    const nav = navRef.current
    const filter = filterRef.current
    const text = textRef.current
    if (!nav || !filter || !text) return

    const activeLi = nav.querySelectorAll('li')[activeIndex]
    if (!activeLi) return

    updateEffectPosition(activeLi)
    text.classList.add('active')

    if (activeRef.current === activeIndex) return
    activeRef.current = activeIndex

    // Com movimento reduzido a pílula se move, mas sem o estouro de partículas.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    /** Desvio aleatório de -n/2 a n/2, para espalhar as partículas. */
    const noise = (n = 1) => n / 2 - Math.random() * n

    const getXY = (
      distance: number,
      pointIndex: number,
      totalPoints: number,
    ): [number, number] => {
      const angle =
        ((360 + noise(8)) / totalPoints) * pointIndex * (Math.PI / 180)
      return [distance * Math.cos(angle), distance * Math.sin(angle)]
    }

    for (const particle of filter.querySelectorAll('.particle')) {
      particle.remove()
    }
    text.classList.remove('active')
    // Reflow: sem isto, tirar e repor a classe caberia num único quadro e o
    // texto não reiniciaria a transição.
    void text.offsetWidth
    text.classList.add('active')

    const bubbleTime = animationTime * 2 + timeVariance
    filter.style.setProperty('--time', `${bubbleTime}ms`)

    // Reinicia a pílula: sem remover o `active` aqui, o `add` do rAF lá embaixo
    // é um no-op e a animação `gooey-pill` só roda na primeira troca de aba.
    filter.classList.remove('active')

    for (let i = 0; i < particleCount; i++) {
      const t = animationTime * 2 + noise(timeVariance * 2)
      const rotate = noise(particleR / 10)
      const start = getXY(
        particleDistances[0],
        particleCount - i,
        particleCount,
      )
      const end = getXY(
        particleDistances[1] + noise(7),
        particleCount - i,
        particleCount,
      )

      setTimeout(() => {
        const particle = document.createElement('span')
        const point = document.createElement('span')
        particle.className = 'particle'
        particle.style.setProperty('--start-x', `${start[0]}px`)
        particle.style.setProperty('--start-y', `${start[1]}px`)
        particle.style.setProperty('--end-x', `${end[0]}px`)
        particle.style.setProperty('--end-y', `${end[1]}px`)
        particle.style.setProperty('--time', `${t}ms`)
        particle.style.setProperty('--scale', `${1 + noise(0.2)}`)
        particle.style.setProperty(
          '--rotate',
          `${rotate > 0 ? (rotate + particleR / 20) * 10 : (rotate - particleR / 20) * 10}deg`,
        )

        point.className = 'point'
        particle.appendChild(point)
        /*
         * A partícula é filha do elemento com `filter`, e é isso que a faz
         * participar do goo: o `blur` da camada já a alcança, o `contrast(100)`
         * a solda na pílula quando as duas se cruzam, e o `lighten` só deixa
         * passar o que é claro. Fora daqui ela seria um ponto sólido voando
         * sozinho — o que o componente parecia ser antes.
         */
        filter.appendChild(particle)
        requestAnimationFrame(() => {
          filter.classList.add('active')
        })
        setTimeout(() => {
          particle.remove()
        }, t)
      }, 30)
    }
  }, [
    activeIndex,
    animationTime,
    particleCount,
    particleDistances,
    particleR,
    timeVariance,
    updateEffectPosition,
  ])

  useEffect(() => {
    const container = containerRef.current
    const nav = navRef.current
    if (!container || !nav) return

    const resizeObserver = new ResizeObserver(() => {
      const activeLi = nav.querySelectorAll('li')[activeIndex]
      if (activeLi) updateEffectPosition(activeLi)
    })
    resizeObserver.observe(container)
    return () => resizeObserver.disconnect()
  }, [activeIndex, updateEffectPosition])

  return (
    <div
      className={`gooey-nav-container${className ? ` ${className}` : ''}`}
      ref={containerRef}
      style={
        accentColor
          ? ({ '--gooey-accent': accentColor } as CSSProperties)
          : undefined
      }
    >
      <nav aria-label={ariaLabel}>
        <ul ref={navRef} role="tablist" aria-orientation="horizontal">
          {items.map((item, index) => (
            <li key={item.id} className={activeIndex === index ? 'active' : ''}>
              <button
                type="button"
                role="tab"
                id={item.id}
                aria-label={item.description}
                aria-selected={activeIndex === index}
                aria-controls={`${item.id}-painel`}
                onClick={item.onClick}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      {/*
       * Uma camada só. A pílula é o `::after` do `filter` e as partículas são
       * filhas dele — precisam estar no mesmo `filter` para que o blur as
       * alcance e o `contrast` as funda com a pílula. O texto é a única coisa
       * que fica de fora, acima, porque precisa ser nítida.
       */}
      <span className="effect filter" ref={filterRef} aria-hidden="true" />
      <span className="effect text" ref={textRef} aria-hidden="true" />
    </div>
  )
}
