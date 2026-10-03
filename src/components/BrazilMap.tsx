import { useId, type CSSProperties } from 'react'
import { BRAZIL_MAP_VIEWBOX, BRAZIL_STATES } from '../data/brazil-map.ts'
import { isModifiedClick } from '../lib/links.ts'
import type { OfficeKind } from '../shared/elections.ts'
import { statePath } from '../shared/router.ts'
import { StateChooser } from './StateChooser.tsx'
import './BrazilMap.css'

interface BrazilMapProps {
  /** Siglas das UFs que já têm lista. As demais entram como "em breve". */
  availableStates: readonly string[]
  /** Chamado no clique simples (sem modificador) de um cargo de uma UF. */
  onSelectState: (code: string, office: OfficeKind) => void
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
export function BrazilMap({ availableStates, onSelectState }: BrazilMapProps) {
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
        As 27 unidades federativas. Cada uma leva à lista de candidatos daquele
        estado. A mesma navegação está na lista de estados.
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
            <StateChooser
              key={state.code}
              uf={state.code}
              onSelectState={onSelectState}
            >
              <a
                className="uf uf--available"
                href={statePath(state.code)}
                aria-label={`${state.name} — escolher cargo`}
                onClick={(event) => {
                  if (isModifiedClick(event)) return
                  event.preventDefault()
                }}
              >
                <path className="uf-forma" d={state.path} />
              </a>
            </StateChooser>
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
