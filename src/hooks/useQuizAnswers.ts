import { useCallback, useEffect, useState } from 'react'
import type { OptionId, QuestionId } from '../data/quiz.ts'

const STORAGE_KEY = 'teste-voto:quiz:v1'

type Answers = Record<QuestionId, OptionId>

function readStoredAnswers(): Answers {
  if (typeof sessionStorage === 'undefined') return {}
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Answers) : {}
  } catch {
    return {}
  }
}

/**
 * Respostas do quiz, guardadas em `sessionStorage` para que a rota
 * `/resultado` sobreviva a um F5 e ao histórico do navegador.
 */
export function useQuizAnswers(): {
  answers: Answers
  answer: (questionId: QuestionId, optionId: OptionId) => void
  reset: () => void
} {
  const [answers, setAnswers] = useState<Answers>(readStoredAnswers)

  useEffect(() => {
    if (typeof sessionStorage === 'undefined') return
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(answers))
    } catch {
      return
    }
  }, [answers])

  const answer = useCallback((questionId: QuestionId, optionId: OptionId) => {
    setAnswers((current) => ({ ...current, [questionId]: optionId }))
  }, [])

  const reset = useCallback(() => setAnswers({}), [])

  return { answers, answer, reset }
}
