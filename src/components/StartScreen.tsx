interface StartScreenProps {
  questionCount: number
  candidateCount: number
  onStart: () => void
}

export function StartScreen({
  questionCount,
  candidateCount,
  onStart,
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
    </section>
  )
}