import { SpecularButton } from './SpecularButton.tsx'
import { Button } from './ui/button.tsx'
import { Card } from './ui/card.tsx'

interface StartScreenProps {
  questionCount: number
  candidateCount: number
  loading: boolean
  error: string | null
  onRetry: () => void
  onStart: () => void
  onShowCandidates: () => void
  onShowStates: () => void
}

export function StartScreen({
  questionCount,
  candidateCount,
  loading,
  error,
  onRetry,
  onStart,
  onShowCandidates,
  onShowStates,
}: StartScreenProps) {
  const canStart = !loading && candidateCount > 0

  return (
    <section className="flex flex-col items-center justify-center gap-4">
      <h1>Teste de Voto</h1>
      <p>
        Descubra qual dos {candidateCount} candidatos a deputado federal combina
        melhor com as suas prioridades respondendo {questionCount} perguntas
        rápidas.
      </p>

      {loading && (
        <p aria-live="polite" className="text-sm text-muted-foreground">
          Carregando candidatos...
        </p>
      )}

      {error && (
        <Card className="max-w-md text-left">
          <p className="text-sm font-medium">
            Não foi possível carregar os dados dos candidatos.
          </p>
          <p className="text-sm text-muted-foreground">
            Verifique se os dados do TSE foram carregados com{' '}
            <code>npm run ingest</code> e se a API está rodando.
          </p>
          <p className="text-xs text-muted-foreground">({error})</p>
          <div>
            <Button variant="outline" size="sm" onClick={onRetry}>
              Tentar novamente
            </Button>
          </div>
        </Card>
      )}

      {/*
       * `flex-wrap` porque os três `SpecularButton` têm 172px de largura mínima
       * (ver `MIN_WIDTH`): em três colunas eles somam 548px e estouravam a tela
       * em qualquer celular, com "Começar" cortado de um lado e "Escolher
       * estado" do outro. Quebrem a linha a partir de uns 620px de largura (onde
       * 3 × 172 + 2 × 16 = 548 cabe na área útil); abaixo disso são duas ou uma
       * por linha, e um por vez é o que o celular pede mesmo.
       */}
      <div className="flex flex-wrap items-center justify-center gap-4">
        <SpecularButton
          variant="primary"
          size="md"
          onClick={onStart}
          disabled={!canStart}
        >
          Começar
        </SpecularButton>
        <SpecularButton
          variant="secondary"
          size="md"
          radius={12}
          onClick={onShowCandidates}
        >
          Ver candidatos
        </SpecularButton>
        <SpecularButton
          variant="tertiary"
          size="md"
          radius={12}
          onClick={onShowStates}
        >
          Escolher estado
        </SpecularButton>
      </div>
    </section>
  )
}
