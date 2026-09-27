interface StartScreenProps {
  questionCount: number
  candidateCount: number
  loading: boolean
  error: string | null
  onRetry: () => void
  onStart: () => void
  onShowCandidates: () => void
}

export function StartScreen({
  questionCount,
  candidateCount,
  loading,
  error,
  onRetry,
  onStart,
  onShowCandidates,
}: StartScreenProps) {
  const canStart = !loading && candidateCount > 0

  return (
    <section>
      <h1>Teste de Voto</h1>
      <p>
        Descubra qual dos {candidateCount} candidatos a deputado federal combina
        melhor com as suas prioridades respondendo {questionCount} perguntas
        rápidas.
      </p>

      {loading && <p>Carregando candidatos...</p>}

      {error && (
        <div>
          <p>Não foi possível carregar os dados dos candidatos.</p>
          <p>
            <small>
              Verifique se os dados do TSE foram carregados com{' '}
              <code>npm run ingest</code> e se a API está rodando.
            </small>
          </p>
          <p>
            <small>({error})</small>
          </p>
          <button type="button" onClick={onRetry}>
            Tentar novamente
          </button>
        </div>
      )}

      <button type="button" onClick={onStart} disabled={!canStart}>
        Começar
      </button>
      <button type="button" onClick={onShowCandidates}>
        Ver candidatos
      </button>
    </section>
  )
}