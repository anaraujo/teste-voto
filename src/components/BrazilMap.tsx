import { useId, type CSSProperties } from 'react'
import { BRAZIL_MAP_VIEWBOX, BRAZIL_STATES } from '../data/brazil-map.ts'
import { isModifiedClick } from '../lib/links.ts'
import './BrazilMap.css'

interface BrazilMapProps {
  /** Siglas das UFs que já têm lista. As demais entram como "em breve". */
  availableStates: readonly string[]
  /** URL real de cada UF disponível — sustenta nova aba, SEO e o `<a>`. */
  hrefForState: (code: string) => string
  /** Chamado no clique simples (sem modificador) de uma UF disponível. */
  onSelectState: (code: string) => void
}

/**
 * Mapa do Brasil por unidade federativa.
 *
 * A geometria é estática (ver `src/data/brazil-map.ts`): nenhuma biblioteca de
 * mapa nem projeção roda em tempo de execução. Cada UF é um `<path>`; as
 * disponíveis são um `<a>` de verdade, então abrir em nova aba com modificador
 * funciona como em qualquer link; as demais ficam com a hachura de "em breve"
 * e fora da ordem de foco.
 *
 * O SVG **não** leva `role="img"`: isso achataria os links das UFs e eles
 * sumiriam da árvore de acessibilidade. O nome do mapa vem do
 * `<title>`/`<desc>` e o de cada UF, do `aria-label` do próprio link.
 */
export function BrazilMap({
  availableStates,
  hrefForState,
  onSelectState,
}: BrazilMapProps) {
  // O `useId` gera ids estáveis entre servidor e cliente; os `:` não são
  // válidos em `url(#...)`, então saem antes de virar referência do padrão.
  const uid = useId().replace(/:/g, '')
  const titleId = `${uid}-titulo`
  const descId = `${uid}-descricao`
  const hatchId = `${uid}-hachura`
  const available = new Set(availableStates)

  return (
    <svg
      className="brazil-map"
      viewBox={BRAZIL_MAP_VIEWBOX}
      aria-labelledby={`${titleId} ${descId}`}
      style={{ '--map-hatch': `url(#${hatchId})` } as CSSProperties}
    >
      <title id={titleId}>Mapa do Brasil por unidade federativa</title>
      <desc id={descId}>
        As 27 unidades federativas. As que já têm lista levam para os
        candidatos; as demais ainda não estão disponíveis. A mesma navegação
        está na lista de estados.
      </desc>

      <defs>
        <pattern
          id={hatchId}
          width="7"
          height="7"
          patternTransform="rotate(45)"
          patternUnits="userSpaceOnUse"
        >
          <rect width="7" height="7" fill="var(--color-tse-success)" />
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="7"
            stroke="var(--color-tse-ink-700)"
            strokeWidth="2.5"
          />
        </pattern>
      </defs>

      <g className="brazil-map-estados">
        {BRAZIL_STATES.map((state) =>
          available.has(state.code) ? (
            <a
              key={state.code}
              className="uf uf--available"
              href={hrefForState(state.code)}
              aria-label={`${state.name} — ver candidatos`}
              onClick={(event) => {
                if (isModifiedClick(event)) return
                event.preventDefault()
                onSelectState(state.code)
              }}
            >
              <path className="uf-forma" d={state.path} />
            </a>
          ) : (
            <g key={state.code} className="uf uf--soon" aria-hidden="true">
              <path className="uf-forma" d={state.path} />
            </g>
          ),
        )}
      </g>
    </svg>
  )
}
