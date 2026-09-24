import type { OptionId, Question, QuestionId } from '../data/quiz.ts'
import { questionMatches } from '../lib/scoring.ts'
import type { RankedEntry } from '../lib/scoring.ts'

interface ResultScreenProps {
  ranked: readonly RankedEntry[]
  totalQuestions: number
  answers: Record<QuestionId, OptionId>
  questions: readonly Question[]
  onRestart: () => void
  onShowFairness: () => void
}

export function ResultScreen({
  ranked,
  totalQuestions,
  answers,
  questions,
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
            <details>
              <summary>
                {candidate.photo && (
                  <img
                    src={candidate.photo}
                    alt={candidate.name}
                    width="120"
                    height="90"
                  />
                )}
                <strong>{candidate.name}</strong> — {matches} de {totalQuestions}
                {index === 0 && <mark>Melhor compatibilidade</mark>}
              </summary>

              <ul>
                {questionMatches(answers, questions, candidate).map(
                  ({ question, user, candidate: expected, matched }) => (
                    <li key={question.id}>
                      <p>
                        <strong>{question.title}</strong>
                      </p>
                      <p>
                        Sua resposta: {user?.label ?? '—'} · Perfil do
                        candidato: {expected?.label ?? '—'} ·{' '}
                        {matched ? (
                          <mark>Concorda</mark>
                        ) : (
                          <strong>Não concorda</strong>
                        )}
                      </p>
                    </li>
                  ),
                )}
              </ul>
            </details>
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