/**
 * Pautas fixas do quiz, revisadas por uma pessoa a partir do rascunho.
 * O arquivo versionado é `content/quiz/pautas-quiz.json`.
 */

export const QUIZ_THEMES = [
  'economia',
  'tributos',
  'meio-ambiente',
  'povos-originarios',
  'seguranca',
  'educacao',
  'saude',
  'trabalho',
  'tecnologia',
  'institucional',
] as const

export type QuizTheme = (typeof QUIZ_THEMES)[number]

export interface PautaQuiz {
  id: string
  votacaoId: string
  pergunta: string
  contexto: string
  simSignifica: string
  tema: QuizTheme
  source: string
  data: string
  proposicaoLabel: string
  revisadoPor: string
  revisadoEm: string
}

const THEME_SET = new Set<string>(QUIZ_THEMES)

export function isPautaQuiz(value: unknown): value is PautaQuiz {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return (
    typeof row.id === 'string' &&
    typeof row.votacaoId === 'string' &&
    typeof row.pergunta === 'string' &&
    typeof row.contexto === 'string' &&
    typeof row.simSignifica === 'string' &&
    typeof row.tema === 'string' &&
    THEME_SET.has(row.tema) &&
    typeof row.source === 'string' &&
    typeof row.data === 'string' &&
    typeof row.proposicaoLabel === 'string' &&
    typeof row.revisadoPor === 'string' &&
    typeof row.revisadoEm === 'string'
  )
}

export function parsePautasQuiz(value: unknown): PautaQuiz[] {
  if (!Array.isArray(value)) {
    throw new Error('pautas-quiz.json deve ser uma lista')
  }
  return value.map((item, index) => {
    if (!isPautaQuiz(item)) {
      throw new Error(`pauta inválida no índice ${index}`)
    }
    return item
  })
}
