import { useCallback, useEffect, useState } from 'react'
import type { OptionId, QuestionId } from '../data/quiz.ts'

type Answers = Record<QuestionId, OptionId>

function storageKey(uf: string): string {
  return `teste-voto:quiz:v1:${uf}`
}

function readStoredAnswers(uf: string): Answers {
  if (typeof sessionStorage === 'undefined') return {}
  try {
    const raw = sessionStorage.getItem(storageKey(uf))
    return raw ? (JSON.parse(raw) as Answers) : {}
  } catch {
    return {}
  }
}

/**
 * Respostas do quiz, guardadas em `sessionStorage` por UF para que
 * `/estados/:uf/resultado` sobreviva a um F5 sem misturar outro estado.
 */
export function useQuizAnswers(uf: string | null): {
  answers: Answers
  answer: (questionId: QuestionId, optionId: OptionId) => void
  reset: () => void
} {
  const [stored, setStored] = useState(() => ({
    uf,
    answers: uf ? readStoredAnswers(uf) : ({} as Answers),
  }))

  if (stored.uf !== uf) {
    setStored({
      uf,
      answers: uf ? readStoredAnswers(uf) : {},
    })
  }

  useEffect(() => {
    if (!stored.uf || typeof sessionStorage === 'undefined') return
    try {
      sessionStorage.setItem(
        storageKey(stored.uf),
        JSON.stringify(stored.answers),
      )
    } catch {
      return
    }
  }, [stored])

  const answer = useCallback((questionId: QuestionId, optionId: OptionId) => {
    setStored((current) => ({
      ...current,
      answers: { ...current.answers, [questionId]: optionId },
    }))
  }, [])

  const reset = useCallback(() => {
    setStored((current) => ({ ...current, answers: {} }))
  }, [])

  return { answers: stored.answers, answer, reset }
}
