import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import './LineSidebar.css'

/**
 * Trilho lateral de seções (port do componente homônimo do react-bits).
 *
 * A lista de itens chega pronta do componente pai: a ficha monta um item por
 * seção da aba ativa, e só o que existe naquela aba entra aqui.
 *
 * O efeito visual é um `--effect` (0..1) por item, animado num único laço de
 * rAF com suavização exponencial independente da taxa de quadros. Por isso cor,
 * deslocamento e escala andam juntos, sem transição CSS que dê para escalonar.
 */

const FALLOFF_CURVES: Record<string, (p: number) => number> = {
  linear: (p) => p,
  smooth: (p) => p * p * (3 - 2 * p),
  sharp: (p) => p * p * p,
}

export type LineSidebarFalloff = keyof typeof FALLOFF_CURVES

export interface SectionAnchor {
  /** Aponta para o `id` da <section> correspondente no conteúdo. */
  id: string
  label: string
}

export interface LineSidebarProps {
  items: SectionAnchor[]
  /** Cor de destaque; a ficha passa a cor do partido. */
  accentColor?: string
  textColor?: string
  markerColor?: string
  showIndex?: boolean
  showMarker?: boolean
  proximityRadius?: number
  maxShift?: number
  falloff?: LineSidebarFalloff
  markerLength?: number
  markerGap?: number
  tickScale?: number
  scaleTick?: boolean
  itemGap?: number
  fontSize?: number
  /** Constante de tempo da suavização, em ms. */
  smoothing?: number
  /** Item ativo, para o trilho deriving do scroll do conteúdo. */
  activeIndex?: number | null
  onItemClick?: (index: number, item: SectionAnchor) => void
  className?: string
}

export function LineSidebar({
  items,
  accentColor,
  textColor,
  markerColor,
  showIndex = false,
  showMarker = true,
  proximityRadius = 100,
  maxShift = 30,
  falloff = 'smooth',
  markerLength = 56,
  markerGap = 0,
  tickScale = 0.5,
  scaleTick = true,
  itemGap = 20,
  fontSize = 1.05,
  smoothing = 100,
  activeIndex = null,
  onItemClick,
  className = '',
}: LineSidebarProps) {
  const listRef = useRef<HTMLUListElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const targetsRef = useRef<number[]>([])
  const currentRef = useRef<number[]>([])
  const rafRef = useRef<number | null>(null)
  const lastRef = useRef(0)
  const activeRef = useRef<number | null>(activeIndex)
  const smoothingRef = useRef(smoothing)
  const reducedRef = useRef(false)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  /**
   * O laço lê `activeRef` e `smoothingRef` porque o `rAF` é assíncrono e não
   * pode depender de props. Os espelhos são escritos em efeito, e não durante
   * a renderização, para não desalinhar do que a tela mostra.
   */
  useEffect(() => {
    activeRef.current = hoveredIndex ?? activeIndex
  }, [activeIndex, hoveredIndex])

  useEffect(() => {
    smoothingRef.current = smoothing
  }, [smoothing])

  /**
   * Com movimento reduzido o laço nem roda: cada `--effect` recebe o alvo na
   * hora. Sem isto a ficha animaria a cor do item mesmo com a pessoa pedindo
   * para não ver animação.
   */
  const applyDirect = useCallback(() => {
    const nodes = itemRefs.current
    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i]
      if (!el) continue
      const target = Math.max(
        targetsRef.current[i] || 0,
        activeRef.current === i ? 1 : 0,
      )
      currentRef.current[i] = target
      el.style.setProperty('--effect', target.toFixed(4))
    }
    rafRef.current = null
  }, [])

  /**
   * Função nomeada, e não arrow: o laço se reagenda chamando a si mesmo, e só
   * uma expressão nomeada pode se referenciar dentro do próprio corpo.
   */
  const runFrame = useCallback(function frame(now: number) {
    const dt = Math.min((now - lastRef.current) / 1000, 0.05)
    lastRef.current = now
    const tau = Math.max(smoothingRef.current, 1) / 1000
    const k = 1 - Math.exp(-dt / tau)

    let moving = false
    const nodes = itemRefs.current
    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i]
      if (!el) continue
      const target = Math.max(
        targetsRef.current[i] || 0,
        activeRef.current === i ? 1 : 0,
      )
      const cur = currentRef.current[i] || 0
      const next = cur + (target - cur) * k
      const settled = Math.abs(target - next) < 0.0015
      const value = settled ? target : next
      currentRef.current[i] = value
      el.style.setProperty('--effect', value.toFixed(4))
      if (!settled) moving = true
    }

    rafRef.current = moving ? requestAnimationFrame(frame) : null
  }, [])

  const startLoop = useCallback(() => {
    if (reducedRef.current) {
      applyDirect()
      return
    }
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    lastRef.current = performance.now()
    rafRef.current = requestAnimationFrame(runFrame)
  }, [applyDirect, runFrame])

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLUListElement>) => {
      const list = listRef.current
      if (!list) return
      const rect = list.getBoundingClientRect()
      const pointerY = event.clientY - rect.top
      const ease = FALLOFF_CURVES[falloff] ?? FALLOFF_CURVES.linear
      const nodes = itemRefs.current
      for (let i = 0; i < nodes.length; i++) {
        const el = nodes[i]
        if (!el) continue
        const center = el.offsetTop + el.offsetHeight / 2
        const distance = Math.abs(pointerY - center)
        targetsRef.current[i] = ease(
          Math.max(0, 1 - distance / proximityRadius),
        )
      }
      startLoop()
    },
    [falloff, proximityRadius, startLoop],
  )

  const handlePointerLeave = useCallback(() => {
    setHoveredIndex(null)
    targetsRef.current = targetsRef.current.map(() => 0)
    startLoop()
  }, [startLoop])

  useEffect(() => {
    startLoop()
  }, [activeIndex, hoveredIndex, startLoop])

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => {
      reducedRef.current = query.matches
      startLoop()
    }
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [startLoop])

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    },
    [],
  )

  const style = {
    ...(accentColor ? { '--accent-color': accentColor } : {}),
    ...(textColor ? { '--text-color': textColor } : {}),
    ...(markerColor ? { '--marker-color': markerColor } : {}),
    '--marker-length': `${markerLength}px`,
    '--marker-gap': `${markerGap}px`,
    '--tick-scale': tickScale,
    '--max-shift': `${maxShift}px`,
    '--item-gap': `${itemGap}px`,
    '--font-size': `${fontSize}rem`,
    '--smoothing': `${smoothing}ms`,
  } as CSSProperties

  return (
    <nav
      className={
        `line-sidebar${showMarker ? ' line-sidebar--markers' : ''}` +
        `${scaleTick ? ' line-sidebar--scale-tick' : ''}` +
        `${className ? ` ${className}` : ''}`
      }
      style={style}
      aria-label="Seções desta aba"
    >
      <ul
        ref={listRef}
        className="line-sidebar__list"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        {items.map((item, index) => (
          <li key={item.id}>
            <button
              type="button"
              ref={(el) => {
                itemRefs.current[index] = el
              }}
              className="line-sidebar__item"
              onPointerEnter={() => setHoveredIndex(index)}
              onClick={() => onItemClick?.(index, item)}
            >
              {showMarker && (
                <span className="line-sidebar__marker" aria-hidden="true" />
              )}
              <span className="line-sidebar__label">
                {showIndex && (
                  <span className="line-sidebar__index">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                )}
                <span className="line-sidebar__text">{item.label}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
