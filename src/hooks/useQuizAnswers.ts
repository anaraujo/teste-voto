import { useCallback, useEffect, useState } from 'react'
import type { GivenAnswer, OptionId, QuestionId } from '../data/quiz.ts'

type Answers = Record<QuestionId, GivenAnswer>

function storageKey(uf: string): string {
  return `teste-voto:quiz:v2:${uf}`
}

function readStoredAnswers(uf: string): Answers {
  if (typeof sessionStorage === 'undefined') return {}
  try {
    const raw = sessionStorage.getItem(storageKey(uf))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const answers = {} as Answers
    for (const [id, value] of Object.entries(parsed)) {
      if (!value || typeof value !== 'object') continue
      const row = value as { optionId?: unknown; weight?: unknown }
      if (typeof row.optionId !== 'string') continue
      answers[id] = {
        optionId: row.optionId,
        weight: row.weight === 2 ? 2 : 1,
      }
    }
    return answers
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
  answer: (questionId: QuestionId, optionId: OptionId, weight?: 1 | 2) => void
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

  const answer = useCallback(
    (questionId: QuestionId, optionId: OptionId, weight: 1 | 2 = 1) => {
      setStored((current) => ({
        ...current,
        answers: {
          ...current.answers,
          [questionId]: { optionId, weight },
        },
      }))
    },
    [],
  )

  const reset = useCallback(() => {
    setStored((current) => ({ ...current, answers: {} }))
  }, [])

  return { answers: stored.answers, answer, reset }
}
