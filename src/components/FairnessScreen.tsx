import { useMemo } from 'react'
import type { Candidate, Question } from '../data/quiz.ts'
import { computeDistribution } from '../lib/distribution.ts'

interface FairnessScreenProps {
  questions: readonly Question[]
  candidates: readonly Candidate[]
  onBack: () => void
}

export function FairnessScreen({
  questions,
  candidates,
  onBack,
}: FairnessScreenProps) {
  const distribution = useMemo(
    () => computeDistribution(questions, candidates),
    [questions, candidates],
  )
  const idealPercent =
    (distribution.idealShare / distribution.totalCombinations) * 100

  return (
    <section>
      <h2>Imparcialidade do teste</h2>
      <p>
        O teste avalia todas as {distribution.totalCombinations} combinações
        possíveis de respostas. Em um teste equilibrado, cada candidato vence em
        cerca de {idealPercent.toFixed(1)}% delas.
      </p>

      <table>
        <thead>
          <tr>
            <th>Candidato</th>
            <th>Vitórias</th>
            <th>Proporção</th>
          </tr>
        </thead>
        <tbody>
          {distribution.entries.map((entry) => (
            <tr key={entry.candidate.id}>
              <td>{entry.candidate.name}</td>
              <td>{entry.wins}</td>
              <td>
                <meter
                  min={0}
                  max={1}
                  value={entry.share}
                  title={`${(entry.share * 100).toFixed(1)}%`}
                >
                  {(entry.share * 100).toFixed(1)}%
                </meter>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button type="button" onClick={onBack}>
        Voltar
      </button>
    </section>
  )
}