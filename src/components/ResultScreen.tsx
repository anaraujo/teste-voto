import type { RankedEntry } from '../lib/scoring.ts'

interface ResultScreenProps {
  ranked: readonly RankedEntry[]
  totalQuestions: number
  onRestart: () => void
  onShowFairness: () => void
}

export function ResultScreen({
  ranked,
  totalQuestions,
  onRestart,
  onShowFairness,
}: ResultScreenProps) {
  const first = ranked[0]

  return (
    <section>
      <h2>Resultado</h2>
      <p>
        Você concordou em {first.matches} de {totalQuestions} questões com o
        candidato mais alinhado.
      </p>

      <ol>
        {ranked.map(({ candidate, matches }, index) => (
          <li key={candidate.id}>
            {candidate.photo && (
              <img
                src={candidate.photo}
                alt={candidate.name}
                width="120"
                height="90"
              />
            )}
            <strong>{candidate.name}</strong> — {matches} de {totalQuestions}
            {index === 0 && <mark>Melhor correspondência</mark>}
          </li>
        ))}
      </ol>

      <button type="button" onClick={onShowFairness}>
        Verificar imparcialidade
      </button>
      <button type="button" onClick={onRestart}>
        Recomeçar
      </button>
    </section>
  )
}