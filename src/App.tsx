import { useMemo, useState } from 'react'
import { questions } from './data/quiz.ts'
import type { OptionId, QuestionId } from './data/quiz.ts'
import { toQuizCandidates } from './data/quiz-source.ts'
import { rankResults } from './lib/scoring.ts'
import { useCandidates } from './hooks/useCandidates.ts'
import type { CandidatesLoadState } from './hooks/useCandidates.ts'
import { CandidatesScreen } from './components/CandidatesScreen.tsx'
import { CandidateDetailScreen } from './components/CandidateDetailScreen.tsx'
import { FairnessScreen } from './components/FairnessScreen.tsx'
import { QuestionStep } from './components/QuestionStep.tsx'
import { ResultScreen } from './components/ResultScreen.tsx'
import { StartScreen } from './components/StartScreen.tsx'

type Screen =
  | { name: 'start' }
  | { name: 'candidates' }
  | { name: 'candidate'; id: string }
  | { name: 'question'; index: number }
  | { name: 'result' }
  | { name: 'fairness' }

function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'start' })
  const [answers, setAnswers] = useState<Record<QuestionId, OptionId>>({})
  const { state: candidatesState, retry: retryCandidates } = useCandidates()

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

  const handleStart = () => setScreen({ name: 'question', index: 0 })

  const showCandidate = (id: string) => setScreen({ name: 'candidate', id })
  const backFromCandidate = () =>
    setScreen(
      screen.name === 'candidate' ? { name: 'candidates' } : { name: 'start' },
    )

  const handleAnswer = (optionId: OptionId) => {
    if (screen.name !== 'question') return

    const { index } = screen
    const question = questions[index]
    const nextAnswers = { ...answers, [question.id]: optionId }

    setAnswers(nextAnswers)
    setScreen(
      index === questions.length - 1
        ? { name: 'result' }
        : { name: 'question', index: index + 1 },
    )
  }

  const handleRestart = () => {
    setAnswers({})
    setScreen({ name: 'start' })
  }

  return (
    <main>
      {screen.name === 'start' && (
        <StartScreen
          questionCount={questions.length}
          candidateCount={candidates.length}
          loading={candidatesState.status === 'loading'}
          error={
            candidatesState.status === 'error' ? candidatesState.message : null
          }
          onRetry={retryCandidates}
          onStart={handleStart}
          onShowCandidates={() => setScreen({ name: 'candidates' })}
        />
      )}

      {screen.name === 'candidates' && (
        <CandidatesScreen
          state={candidatesState as CandidatesLoadState}
          onRetry={retryCandidates}
          onBack={() => setScreen({ name: 'start' })}
          onShowCandidate={showCandidate}
        />
      )}

      {screen.name === 'candidate' && (
        <CandidateDetailScreen
          candidateId={screen.id}
          onBack={backFromCandidate}
        />
      )}

      {screen.name === 'question' && (
        <QuestionStep
          question={questions[screen.index]}
          index={screen.index}
          total={questions.length}
          onAnswer={handleAnswer}
        />
      )}

      {screen.name === 'result' &&
        (ranked.length > 0 ? (
          <ResultScreen
            ranked={ranked}
            totalQuestions={questions.length}
            answers={answers}
            questions={questions}
            onRestart={handleRestart}
            onShowFairness={() => setScreen({ name: 'fairness' })}
            onShowCandidate={showCandidate}
          />
        ) : (
          <section>
            <h2>Não foi possível calcular o resultado</h2>
            <p>Recarregue a página e tente novamente.</p>
            <button type="button" onClick={() => window.location.reload()}>
              Tentar novamente
            </button>
          </section>
        ))}

      {screen.name === 'fairness' && (
        <FairnessScreen
          questions={questions}
          candidates={candidates}
          onBack={() => setScreen({ name: 'result' })}
        />
      )}
    </main>
  )
}

export default App
