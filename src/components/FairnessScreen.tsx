import { useMemo } from 'react'
import type { Candidate, Question } from '../data/quiz.ts'
import { AUDIT_SAMPLES, computeDistribution } from '../lib/distribution.ts'

interface FairnessScreenProps {
  questions: readonly Question[]
  candidates: readonly Candidate[]
}

const UI_SAMPLES = 4_000

export function FairnessScreen({ questions, candidates }: FairnessScreenProps) {
  const distribution = useMemo(
    () => computeDistribution(questions, candidates, { samples: UI_SAMPLES }),
    [questions, candidates],
  )
  const idealPercent =
    candidates.length > 0 ? (1 / candidates.length) * 100 : 0

  return (
    <section>
      <p>
        O teste sorteia {distribution.totalCombinations.toLocaleString('pt-BR')}{' '}
        combinações de respostas (a auditoria completa usa{' '}
        {AUDIT_SAMPLES.toLocaleString('pt-BR')}). Em um teste equilibrado, cada
        candidato vence em cerca de {idealPercent.toFixed(1)}% delas.
      </p>

      <h3>Vitórias por partido</h3>
      <p>
        <small>
          A orientação do partido repete o mesmo perfil entre candidatos da
          mesma legenda. A proporção de vitórias deve ficar perto da proporção
          de candidatos.
        </small>
      </p>
      <table>
        <thead>
          <tr>
            <th>Partido</th>
            <th>Candidatos</th>
            <th>Vitórias</th>
          </tr>
        </thead>
        <tbody>
          {distribution.partyShares.map((party) => (
            <tr key={party.party}>
              <td>{party.party}</td>
              <td>{(party.candidateShare * 100).toFixed(1)}%</td>
              <td>{(party.winShare * 100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>

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
    </section>
  )
}
