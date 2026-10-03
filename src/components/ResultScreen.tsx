import { isModifiedClick } from '../lib/links.ts'
import type { RankedEntry } from '../lib/scoring.ts'
import { candidatePath } from '../shared/router.ts'
import { partyColor, readableFill, readableOn } from '../shared/party-colors.ts'
import { CandidateGrid, type CandidateItem } from './CandidateGrid.tsx'
import { SpecularButton } from './SpecularButton.tsx'

interface ResultScreenProps {
  ranked: readonly RankedEntry[]
  onRestart: () => void
  onShowFairness: () => void
  onShowCandidate: (candidateId: string) => void
}

const TOP_COUNT = 3

export function ResultScreen({
  ranked,
  onRestart,
  onShowFairness,
  onShowCandidate,
}: ResultScreenProps) {
  const top = ranked.slice(0, TOP_COUNT)
  const first = top[0]
  if (!first) return null

  const items: CandidateItem[] = top.map(({ candidate, score }) => {
    const partido = partyColor(candidate.partyAcronym)
    const textColor = readableOn(partido.primary)
    return {
      image: candidate.photo ?? null,
      placeholder: candidate.ballotNumber,
      title: candidate.name,
      number: candidate.ballotNumber,
      party: candidate.partyAcronym ?? 'Sem partido',
      textColor,
      base: partido.primary,
      fill: readableFill(textColor),
      children: (
        <>
          <p className="result-score">{Math.round(score * 100)}%</p>
          <a
            className="candidate-ficha"
            href={candidatePath(candidate.id)}
            onClick={(event) => {
              if (isModifiedClick(event)) return
              event.preventDefault()
            }}
          >
            Ver ficha
          </a>
        </>
      ),
    }
  })

  return (
    <section className="mx-auto flex w-full flex-col gap-3 px-4">
      <h2 className="font-titulo text-3xl">Resultado</h2>
      <p>
        O candidato mais alinhado concorda em {Math.round(first.score * 100)}%
        das perguntas que têm dado conhecido
        {first.coverage < 0.5
          ? ' (cobertura abaixo da metade: o ranking o deixa atrás de quem tem mais dado)'
          : ''}
        .
      </p>
      <p>
        <small>
          A nota ignora “Tanto faz” e pergunta sem voto ou orientação. Empate:
          mais concordâncias com voto do próprio candidato, depois perfil mais
          raro, depois ordem alfabética.
        </small>
      </p>

      <CandidateGrid
        items={items}
        onSelect={(_item, index) => onShowCandidate(top[index].candidate.id)}
      />

      <div className="flex flex-wrap gap-2">
        <SpecularButton variant="primary" size="md" onClick={onShowFairness}>
          Verificar imparcialidade
        </SpecularButton>
        <SpecularButton variant="primary" size="md" onClick={onRestart}>
          Recomeçar
        </SpecularButton>
      </div>
    </section>
  )
}
