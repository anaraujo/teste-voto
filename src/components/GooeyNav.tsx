import { useCallback, useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import './GooeyNav.css'

/**
 * GooeyNav — a navegação de abas, com a pílula que "derrete" (port do
 * componente homônimo do react-bits).
 *
 * A pílula é um elemento sob `filter: blur(7px) contrast(100) blur(0)` com
 * `mix-blend-mode: lighten`; o efeito gooey sai do contraste depois do blur. Ao
 * clicar, cada partícula é um `span` solto que voa do item para fora e some, e o
 * texto repetido por cima é o que parece escorrer junto com a pílula.
 *
 * Três mudanças em relação ao original:
 *
 * 1. **Controlada.** O original guarda `activeIndex` em estado próprio e só o
 *    define na montagem. Aqui a aba mora na URL (`?tab=`), então o item ativo
 *    vem por prop — inclusive quando muda pelo teclado, e não só por clique.
 * 2. **`button` em vez de `a href`.** As abas não são links: são `role="tab"`
 *    dentro de um `tablist`, e um `href="#"` só custaria um salto de página.
 * 3. **Superfície escura.** O original compõe sobre preto, e é isso que faz o
 *    `lighten` funcionar: partícula clara sobre fundo escuro. Sobre o canvas
 *    da ficha elas sumiriam, então a cápsula escura é da própria navegação.
 *    A cor vem do partido, escurecida para o branco da pílula ter contraste.
 * 4. **Partículas em camada própria.** No original elas moram dentro do
 *    elemento filtrado, e o `contrast(100)` as esmaga para preto/branco. Aqui
 *    elas vivem num `span` à parte, sem filtro, para manter a cor sólida do
 *    partido.
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
  /**
   * Paleta das partículas, em ordem de precedência. Sem ela, as partículas
   * usam só o `accentColor` — é o que a ficha faz, para o estouro sair sempre
   * na primária do partido.
   *
   * As partículas vivem numa camada própria, sem o `contrast` do filtro, então
   * a cor chega sólida ao `--color` de cada uma — nada de clarear.
   */
  palette?: string[]
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
  /** Peso de cada cor da paleta, em índices 1-based, repetíveis. */
  colors?: number[]
  ariaLabel?: string
  className?: string
}

export function GooeyNav({
  items,
  activeIndex,
  accentColor,
  palette,
  particleCount = 15,
  particleDistances = [90, 10],
  particleR = 100,
  animationTime = 600,
  timeVariance = 300,
  colors,
  ariaLabel = 'Abas da ficha',
  className = '',
}: GooeyNavProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const navRef = useRef<HTMLUListElement>(null)
  const filterRef = useRef<HTMLSpanElement>(null)
  const particlesRef = useRef<HTMLSpanElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const activeRef = useRef(activeIndex)

  /**
   * Move a pílula borrada e o texto por cima para cima do item ativo.
   *
   * Depende só de refs, então a identidade é estável e o efeito que a chama não
   * precisa de `activeIndex` na lista de dependências para não se refazer a
   * cada quadro.
   */
  const updateEffectPosition = useCallback((element: HTMLElement) => {
    const container = containerRef.current
    const filter = filterRef.current
    const particles = particlesRef.current
    const text = textRef.current
    if (!container || !filter || !particles || !text) return

    const containerRect = container.getBoundingClientRect()
    const pos = element.getBoundingClientRect()
    Object.assign(filter.style, {
      left: `${pos.x - containerRect.x}px`,
      top: `${pos.y - containerRect.y}px`,
      width: `${pos.width}px`,
      height: `${pos.height}px`,
    })
    Object.assign(particles.style, {
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
    const particles = particlesRef.current
    const text = textRef.current
    if (!nav || !filter || !particles || !text) return

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

    for (const particle of particles.querySelectorAll('.particle')) {
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

    /**
     * As cores que as partículas podem assumir. Sem paleta, a única cor é a do
     * `accentColor` — a primária do partido —, sólida.
     */
    const cores = palette?.length ? palette : [accentColor ?? '#7a3ea3']

    /**
     * Cor da i-ésima partícula. Com `colors` o índice sai ponderado pela lista
     * (1-based, repetível); sem ele, as cores se alternam para a paleta inteira
     * aparecer. O índice dá a volta na paleta para uma lista longa não estourar.
     */
    const corDaParticula = (i: number) => {
      const peso = colors?.length
        ? colors[Math.floor(Math.random() * colors.length)]
        : null
      const indice = peso ?? (i % cores.length) + 1
      return cores[(indice - 1 + cores.length) % cores.length] ?? '#ffffff'
    }

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
        // Cor sólida do partido: as partículas não passam mais pelo `contrast`
        // do filtro (vivem numa camada própria), então a cor não é clareada.
        particle.style.setProperty('--color', corDaParticula(i))
        particle.style.setProperty(
          '--rotate',
          `${rotate > 0 ? (rotate + particleR / 20) * 10 : (rotate - particleR / 20) * 10}deg`,
        )

        point.className = 'point'
        particle.appendChild(point)
        particles.appendChild(particle)
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
    accentColor,
    colors,
    palette,
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
      <span className="effect filter" ref={filterRef} aria-hidden="true" />
      <span
        className="effect particles"
        ref={particlesRef}
        aria-hidden="true"
      />
      <span className="effect text" ref={textRef} aria-hidden="true" />
    </div>
  )
}
