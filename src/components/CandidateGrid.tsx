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

import { type CSSProperties, type ReactNode } from 'react'
import './CandidateGrid.css'

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
   * Cor do preenchimento listrado da pílula "Ver ficha". Precisa contrastar
   * com a `textColor` acima, porque o texto da pílula é o mesmo do card e
   * passa por cima das listras. Vem de `readableFill`, que parte da cor
   * secundária do partido e a afasta da tinta até passar em AA.
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
  return (
    <div className={`candidate-grid ${className}`}>
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
            <span className="head-label">Nº</span>
            {item.number && <span className="head-value">{item.number}</span>}
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
            {item.party && <p className="party">{item.party}</p>}
          </div>
          <footer className="candidate-foot">{item.children}</footer>
        </article>
      ))}
    </div>
  )
}
