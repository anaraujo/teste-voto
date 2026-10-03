import { useCallback, useEffect, useMemo } from 'react'
import { questionsFor } from './data/quiz.ts'
import type { OptionId } from './data/quiz.ts'
import { stateByCode, BRAZIL_STATES } from './data/brazil-map.ts'
import { toQuizCandidates } from './data/quiz-source.ts'
import { rankResults } from './lib/scoring.ts'
import { cn } from './lib/utils.ts'
import { useCandidates } from './hooks/useCandidates.ts'
import { useQuizAnswers } from './hooks/useQuizAnswers.ts'
import type { CandidatesLoadState } from './hooks/useCandidates.ts'
import type { PrerenderData } from './shared/prerender.ts'
import {
  candidatePath,
  DEFAULT_TAB,
  fairnessPath,
  quizPath,
  resultPath,
  statePath,
  STATES_PATH,
  type Route,
  type Tab,
} from './shared/router.ts'
import { AppHeader } from './components/AppHeader.tsx'
import { CandidatesScreen } from './components/CandidatesScreen.tsx'
import { CandidateDetailScreen } from './components/CandidateDetailScreen.tsx'
import { EstadosScreen } from './components/EstadosScreen.tsx'
import { FairnessScreen } from './components/FairnessScreen.tsx'
import { NotFoundScreen } from './components/NotFoundScreen.tsx'
import { QuestionStep } from './components/QuestionStep.tsx'
import { ResultScreen } from './components/ResultScreen.tsx'
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
function questionIndex(step: number, total: number): number {
  if (total < 1) return 0
  return Math.min(Math.max(step - 1, 0), total - 1)
}

function routeUf(route: Route): string | null {
  switch (route.name) {
    case 'candidates':
    case 'question':
    case 'result':
    case 'fairness':
      return route.uf
    default:
      return null
  }
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
  const uf = routeUf(route)
  const state = uf ? stateByCode(uf) : undefined
  const questions = useMemo(
    () => (state ? questionsFor(state) : questionsFor(BRAZIL_STATES[0])),
    [state],
  )

  const { answers, answer, reset } = useQuizAnswers(uf)

  const seedCandidates =
    data?.kind === 'candidates' && data.payload.election.state === uf
      ? data.payload
      : undefined
  const seedDetail = data?.kind === 'candidate' ? data.payload : undefined

  const { state: candidatesState, retry: retryCandidates } = useCandidates(
    uf,
    seedCandidates,
  )

  const apiCandidates = useMemo(
    () =>
      candidatesState.status === 'ready' ? candidatesState.data.candidates : [],
    [candidatesState],
  )
  const candidates = useMemo(
    () => (uf ? toQuizCandidates(apiCandidates, uf) : []),
    [apiCandidates, uf],
  )

  const ranked = useMemo(
    () => rankResults(answers, questions, candidates),
    [answers, questions, candidates],
  )

  const goHome = useCallback(() => onNavigate('/'), [onNavigate])

  const handleStart = () => {
    if (!uf) {
      onNavigate(STATES_PATH)
      return
    }
    onNavigate(quizPath(uf, 1))
  }

  const showCandidate = useCallback(
    (id: string) => onNavigate(candidatePath(id)),
    [onNavigate],
  )

  const handleAnswer = (optionId: OptionId) => {
    if (route.name !== 'question') return

    const index = questionIndex(route.step, questions.length)
    answer(questions[index].id, optionId)
    onNavigate(
      index === questions.length - 1
        ? resultPath(route.uf)
        : quizPath(route.uf, index + 2),
    )
  }

  const handleRestart = () => {
    reset()
    if (uf) onNavigate(quizPath(uf, 1))
    else onNavigate(STATES_PATH)
  }

  // A seleção de estado é a única tela que se prende à altura da janela: mapa
  // e grade dividem a linha e a página para de rolar. As outras seguem
  // crescendo com o conteúdo, porque uma ficha tem seis abas e o quiz é o que é.
  const fillsViewport = route.name === 'states'

  // A seleção de estado é a rota principal (`/`). O caminho antigo (`/estados`)
  // ainda casa com a mesma tela; aqui a URL é devolvida ao canônico. A
  // `StartScreen` segue no código, mas nenhuma rota a renderiza — código morto,
  // ainda não removido.
  useEffect(() => {
    if (route.name === 'states' && window.location.pathname !== STATES_PATH) {
      onNavigate(STATES_PATH, { replace: true })
    }
  }, [route.name, onNavigate])

  return (
    <main
      className={cn(
        'min-h-screen bg-tse-primary px-4 py-8 sm:px-8 lg:px-12',
        fillsViewport && 'flex flex-col md:min-h-dvh md:h-dvh',
      )}
    >
      <AppHeader route={route} onNavigate={onNavigate} />

      {route.name === 'states' && (
        <EstadosScreen
          availableStates={BRAZIL_STATES.map((item) => item.code)}
          onSelectState={(code) => onNavigate(statePath(code))}
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
          question={questions[questionIndex(route.step, questions.length)]}
          index={questionIndex(route.step, questions.length)}
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
            onShowFairness={() => onNavigate(fairnessPath(route.uf))}
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
