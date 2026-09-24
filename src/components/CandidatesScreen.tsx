import type { Candidate } from '../data/quiz.ts'

interface CandidatesScreenProps {
  candidates: readonly Candidate[]
  onBack: () => void
}

export function CandidatesScreen({
  candidates,
  onBack,
}: CandidatesScreenProps) {
  return (
    <section>
      <h2>Candidatos</h2>

      <ul>
        {candidates.map((candidate) => (
          <li key={candidate.id}>
            {candidate.photo && (
              <img
                src={candidate.photo}
                alt={candidate.name}
                width="120"
                height="90"
              />
            )}
            <p>
              <strong>{candidate.name}</strong>
            </p>
            <p>{candidate.description}</p>
          </li>
        ))}
      </ul>

      <button type="button" onClick={onBack}>
        Voltar
      </button>
    </section>
  )
}