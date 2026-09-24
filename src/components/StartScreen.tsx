interface StartScreenProps {
  questionCount: number
  candidateCount: number
  onStart: () => void
  onShowCandidates: () => void
}

export function StartScreen({
  questionCount,
  candidateCount,
  onStart,
  onShowCandidates,
}: StartScreenProps) {
  return (
    <section>
      <h1>Teste de Voto</h1>
      <p>
        Descubra qual dos {candidateCount} candidatos combina melhor com as suas
        prioridades respondendo {questionCount} perguntas rápidas.
      </p>
      <button type="button" onClick={onStart}>
        Começar
      </button>
      <button type="button" onClick={onShowCandidates}>
        Ver candidatos
      </button>
    </section>
  )
}