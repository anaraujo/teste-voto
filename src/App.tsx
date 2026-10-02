import { useCallback, useMemo } from 'react'
import { questions } from './data/quiz.ts'
import type { OptionId } from './data/quiz.ts'
import { toQuizCandidates } from './data/quiz-source.ts'
import { rankResults } from './lib/scoring.ts'
import { useCandidates } from './hooks/useCandidates.ts'
import { useQuizAnswers } from './hooks/useQuizAnswers.ts'
import type { CandidatesLoadState } from './hooks/useCandidates.ts'
import type { PrerenderData } from './shared/prerender.ts'
import {
  candidatePath,
  DEFAULT_TAB,
  type Route,
  type Tab,
} from './shared/router.ts'
import { CURRENT_ELECTION } from './shared/elections.ts'
import { AppHeader } from './components/AppHeader.tsx'
import { CandidatesScreen } from './components/CandidatesScreen.tsx'
import { CandidateDetailScreen } from './components/CandidateDetailScreen.tsx'
import { EstadosScreen } from './components/EstadosScreen.tsx'
import { FairnessScreen } from './components/FairnessScreen.tsx'
import { NotFoundScreen } from './components/NotFoundScreen.tsx'
import { QuestionStep } from './components/QuestionStep.tsx'
import { ResultScreen } from './components/ResultScreen.tsx'
import { StartScreen } from './components/StartScreen.tsx'
import { Button } from './components/ui/button.tsx'
import { Card } from './components/ui/card.tsx'

export interface NavigateOptions {
  replace?: boolean
}

export interface AppProps {
  route: Route
  onNavigate: (to: string, options?: NavigateOptions) => void
  /** Aba viva da ficha; o build estático usa sempre a padrão. */
  tab?: Tab
  onTabChange?: (tab: Tab) => void
  /** Dados embutidos no HTML pré-renderizado da rota atual. */
  data?: PrerenderData
}

/** Índice da pergunta (0-based) a partir do passo da URL, preso aos limites. */
function questionIndex(step: number): number {
  return Math.min(Math.max(step - 1, 0), questions.length - 1)
}

/** No build estático não há URL para trocar: a aba padrão fica onde está. */
function noopTabChange(): void {}

function App({
  route,
  onNavigate,
  tab = DEFAULT_TAB,
  onTabChange,
  data,
}: AppProps) {
  const { answers, answer, reset } = useQuizAnswers()

  const seedCandidates = data?.kind === 'candidates' ? data.payload : undefined
  const seedDetail = data?.kind === 'candidate' ? data.payload : undefined

  const { state: candidatesState, retry: retryCandidates } =
    useCandidates(seedCandidates)

  const apiCandidates = useMemo(
    () =>
      candidatesState.status === 'ready' ? candidatesState.data.candidates : [],
    [candidatesState],
  )
  const candidates = useMemo(
    () => toQuizCandidates(apiCandidates),
    [apiCandidates],
  )

  const ranked = useMemo(
    () => rankResults(answers, questions, candidates),
    [answers, candidates],
  )

  const goHome = useCallback(() => onNavigate('/'), [onNavigate])

  const handleStart = () => onNavigate('/quiz/1')

  const showCandidate = useCallback(
    (id: string) => onNavigate(candidatePath(id)),
    [onNavigate],
  )

  const handleAnswer = (optionId: OptionId) => {
    if (route.name !== 'question') return

    const index = questionIndex(route.step)
    answer(questions[index].id, optionId)
    onNavigate(
      index === questions.length - 1 ? '/resultado' : `/quiz/${index + 2}`,
    )
  }

  const handleRestart = () => {
    reset()
    onNavigate('/')
  }

  return (
    <main className="min-h-screen bg-tse-primary gap-4 px-12 py-8">
      <AppHeader route={route} onNavigate={onNavigate} />

      {route.name === 'start' && (
        <StartScreen
          questionCount={questions.length}
          candidateCount={candidates.length}
          loading={candidatesState.status === 'loading'}
          error={
            candidatesState.status === 'error' ? candidatesState.message : null
          }
          onRetry={retryCandidates}
          onStart={handleStart}
          onShowCandidates={() => onNavigate('/candidatos')}
          onShowStates={() => onNavigate('/estados')}
        />
      )}

      {route.name === 'states' && (
        <EstadosScreen
          availableStates={[CURRENT_ELECTION.state]}
          onSelectState={() => onNavigate('/candidatos')}
        />
      )}

      {route.name === 'candidates' && (
        <CandidatesScreen
          state={candidatesState as CandidatesLoadState}
          onRetry={retryCandidates}
          onShowCandidate={showCandidate}
        />
      )}

      {route.name === 'candidate' && (
        <CandidateDetailScreen
          candidateId={route.id}
          initialData={seedDetail}
          tab={tab}
          onTabChange={onTabChange ?? noopTabChange}
        />
      )}

      {route.name === 'question' && (
        <QuestionStep
          question={questions[questionIndex(route.step)]}
          index={questionIndex(route.step)}
          total={questions.length}
          onAnswer={handleAnswer}
        />
      )}

      {route.name === 'result' &&
        (ranked.length > 0 ? (
          <ResultScreen
            ranked={ranked}
            totalQuestions={questions.length}
            answers={answers}
            questions={questions}
            onRestart={handleRestart}
            onShowFairness={() => onNavigate('/imparcialidade')}
            onShowCandidate={showCandidate}
          />
        ) : (
          <section className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4">
            <Card>
              <h2 className="text-base font-semibold">
                Não foi possível calcular o resultado
              </h2>
              <p className="text-sm text-muted-foreground">
                Responda as perguntas para ver o ranking dos candidatos.
              </p>
              <div>
                <Button onClick={handleStart}>Responder o quiz</Button>
              </div>
            </Card>
          </section>
        ))}

      {route.name === 'fairness' && (
        <FairnessScreen questions={questions} candidates={candidates} />
      )}

      {route.name === 'not-found' && (
        <NotFoundScreen path={route.path} onHome={goHome} />
      )}
    </main>
  )
}

export default App
