import { useState } from 'react'
import type { OptionId, Question, QuestionId } from '../data/quiz.ts'
import { questionProvenance } from '../data/quiz-source.ts'
import { questionMatches } from '../lib/scoring.ts'
import type { RankedEntry } from '../lib/scoring.ts'

interface ResultScreenProps {
  ranked: readonly RankedEntry[]
  totalQuestions: number
  answers: Record<QuestionId, OptionId>
  questions: readonly Question[]
  onRestart: () => void
  onShowFairness: () => void
  onShowCandidate: (candidateId: string) => void
}

const TOP_COUNT = 10

export function ResultScreen({
  ranked,
  totalQuestions,
  answers,
  questions,
  onRestart,
  onShowFairness,
  onShowCandidate,
}: ResultScreenProps) {
  const [showAll, setShowAll] = useState(false)
  const first = ranked[0]
  const visible = showAll ? ranked : ranked.slice(0, TOP_COUNT)

  return (
    <section>
      <h2>Resultado</h2>
      <p>
        Você concordou em {first.matches} de {totalQuestions} questões com o
        candidato mais alinhado.
      </p>

      <p>
        <small>
          Empates são desfeitos por perfil mais raro (quem menos repete o
          conjunto de respostas) e, em seguida, por ordem alfabética.
        </small>
      </p>

      <ol>
        {visible.map(({ candidate, matches }, index) => (
          <li key={candidate.id}>
            <details>
              <summary>
                {candidate.photo && (
                  <img
                    src={candidate.photo}
                    alt={candidate.name}
                    width="120"
                    height="90"
                    loading="lazy"
                  />
                )}
                <strong>{candidate.name}</strong> — {matches} de {totalQuestions}
                {index === 0 && <mark>Melhor compatibilidade</mark>}
              </summary>
              <p>
                <small>{candidate.description}</small>
              </p>
              <p>
                <button type="button" onClick={() => onShowCandidate(candidate.id)}>
                  Ver ficha do candidato
                </button>
              </p>
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
                      <p>
                        <small>{questionProvenance(question.id)}</small>
                      </p>
                    </li>
                  ),
                )}
              </ul>
            </details>
          </li>
        ))}
      </ol>

      {!showAll && ranked.length > TOP_COUNT && (
        <button type="button" onClick={() => setShowAll(true)}>
          Ver a lista completa ({ranked.length} candidatos)
        </button>
      )}
      {showAll && (
        <button type="button" onClick={() => setShowAll(false)}>
          Mostrar apenas os {TOP_COUNT} mais alinhados
        </button>
      )}

      <button type="button" onClick={onShowFairness}>
        Verificar imparcialidade
      </button>
      <button type="button" onClick={onRestart}>
        Recomeçar
      </button>
    </section>
  )
}