/*
 * Chroma Grid — experimental, em avaliação visual.
 *
 * Porta de https://www.reactbits.dev/c/components/chroma-grid (o componente é
 * open source, do repositório DavidHDev/react-bits, arquivo
 * public/r/ChromaGrid-TS-CSS.json), com três mudanças para caber no projeto:
 *
 *  1. Sem gsap. A versão original usa o gsap para duas coisas: mover as
 *     variáveis CSS `--x`/`--y` (o spot que segue o mouse) e o fade do
 *     overlay. O spot virou um rAF com suavização exponencial e o fade ficou
 *     com `transition` do próprio CSS — mesmo efeito, uma dependência a
 *     menos.
 *  2. `onSelect` no lugar do `window.open` do demo, que existia só porque os
 *     cards apontavam para perfil de rede social. Aqui o card leva para a
 *     ficha, dentro do app.
 *  3. `items` é obrigatório, sem dados de demonstração.
 *  4. O efeito foi invertido. No original a grade começa
 *     `grayscale(1) brightness(0.78)` e o mouse *revela* a cor; aqui a grade
 *     já começa colorida e o mouse só *intensifica* a região em volta do
 *     ponteiro. O realce é um `backdrop-filter` de saturação/brilho com
 *     máscara radial, que em repouso fica em `opacity: 0` — ou seja, sem
 *     filtro nenhum.
 *
 * Os dados de demonstração do site saíram; o que sobrou foi o efeito, regravado.
 */

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import './ChromaGrid.css'

export interface ChromaItem {
  /** Foto (URL absoluta ou relativa a /photos). Sem foto, cai no placeholder. */
  image: string | null
  title: string
  /** Sigla do partido, no fim da linha do nome. */
  party?: string
  /** Linha abaixo do nome (número de urna). */
  handle?: string
  /** Gradiente de fundo do card. */
  gradient?: string
  /**
   * Cor do texto sobre o gradiente. Precisa vir declarada junto com a cor do
   * card (os tokens `-on` do index.css), senão o texto fixo #fff some sobre
   * cor clara.
   */
  textColor?: string
  /** Rótulo do placeholder quando não há foto. */
  placeholder?: string
  /** Conteúdo extra dentro do card (o resto dos dados do candidato). */
  children?: ReactNode
}

export interface ChromaGridProps {
  items: ChromaItem[]
  className?: string
  /** Raio do spot que segue o mouse, em px. */
  radius?: number
  columns?: number
  /** Tempo (s) até o spot chegar no ponteiro. */
  damping?: number
  /** Tempo (s) para o realce voltar ao normal quando o mouse sai. */
  release?: number
  onSelect?: (item: ChromaItem, index: number) => void
}

export function ChromaGrid({
  items,
  className = '',
  radius = 480,
  columns = 6,
  damping = 0.6,
  release = 2,
  onSelect,
}: ChromaGridProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const boostRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef(0)
  const spot = useRef({ x: 0, y: 0, targetX: 0, targetY: 0, ready: false })

  const setSpot = (el: HTMLElement, x: number, y: number): void => {
    el.style.setProperty('--x', `${x}px`)
    el.style.setProperty('--y', `${y}px`)
  }

  const boost = (
    el: HTMLElement | null,
    opacity: number,
    seconds: number,
  ): void => {
    const target = el ? boostRef.current : null
    if (!target) return
    target.style.transitionDuration = `${seconds}s`
    target.style.opacity = String(opacity)
  }

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    spot.current = {
      x: width / 2,
      y: height / 2,
      targetX: width / 2,
      targetY: height / 2,
      ready: true,
    }
    setSpot(el, width / 2, height / 2)
  }, [])

  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  /** Suaviza o spot até o ponteiro e para o rAF quando chega perto. */
  const approach = (el: HTMLElement): void => {
    cancelAnimationFrame(rafRef.current)
    let last = performance.now()
    const step = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      const s = spot.current
      // Mesmo formato da ease-out do gsap: chega rápido e desacelera.
      const k = 1 - Math.exp(-dt / Math.max(damping, 0.01))
      s.x += (s.targetX - s.x) * k
      s.y += (s.targetY - s.y) * k
      setSpot(el, s.x, s.y)
      const dist = Math.hypot(s.targetX - s.x, s.targetY - s.y)
      if (dist > 0.5) {
        rafRef.current = requestAnimationFrame(step)
      }
    }
    rafRef.current = requestAnimationFrame(step)
  }

  const handleMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    const el = rootRef.current
    if (!el || !spot.current.ready) return
    const rect = el.getBoundingClientRect()
    spot.current.targetX = event.clientX - rect.left
    spot.current.targetY = event.clientY - rect.top
    approach(el)
    boost(el, 1, 0.15)
  }

  const handleLeave = (): void => {
    boost(rootRef.current, 0, release)
  }

  return (
    <div
      ref={rootRef}
      className={`chroma-grid ${className}`}
      style={{ '--r': `${radius}px`, '--cols': columns } as CSSProperties}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
    >
      {items.map((item, index) => (
        <article
          key={`${item.title}-${index}`}
          className="chroma-card"
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
              '--card-gradient': item.gradient,
              cursor: onSelect ? 'pointer' : 'default',
            } as CSSProperties
          }
        >
          <div className="chroma-img-wrapper">
            {item.image ? (
              <img src={item.image} alt={item.title} loading="lazy" />
            ) : (
              <span className="chroma-img-placeholder" aria-hidden="true">
                {item.placeholder ?? ''}
              </span>
            )}
          </div>
          <footer className="chroma-info">
            {/*
             * A sigla vem antes do nome no DOM de propósito. Ela é um float
             * para cair no fim da primeira linha do nome, e um float só sobe
             * para o topo do bloco se aparecer antes do texto: depois, ele
             * desce para a linha seguinte — que foi o que aconteceu nas
             * medidas, com a sigla embaixo do nome em 415 dos 428 cards.
             */}
            <p className="name">
              {item.party && <span className="party">{item.party}</span>}
              <span className="name-text">{item.title}</span>
            </p>
            {item.handle && <span className="handle">{item.handle}</span>}
            {item.children}
          </footer>
        </article>
      ))}
      <div ref={boostRef} className="chroma-boost" />
    </div>
  )
}
