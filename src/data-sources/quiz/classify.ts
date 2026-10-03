/**
 * Classificação de uma votação por um endpoint compatível com a API da
 * OpenAI (llama.cpp). O modelo não recebe candidato nem partido.
 */

import { createHash } from 'node:crypto'
import {
  QUIZ_THEMES,
  type QuizTheme,
} from '../../shared/quiz-pautas.ts'
import type { ShortlistEntry } from './rank.ts'

export interface Classification {
  tema: QuizTheme
  pergunta: string
  simSignifica: string
  contexto: string
  confianca: number
}

export interface ClassifyFailure {
  error: string
}

const THEME_SET = new Set<string>(QUIZ_THEMES)

export function classificationMessages(entry: ShortlistEntry): {
  system: string
  user: string
} {
  const themes = QUIZ_THEMES.join(', ')
  return {
    system: [
      'Você descreve uma votação nominal da Câmara dos Deputados para um quiz eleitoral.',
      'Responda só com um objeto JSON.',
      'Não invente número, data ou efeito que não esteja no texto.',
      'Não classifique partido, ideologia nem candidato.',
      `O campo tema deve ser exatamente um destes: ${themes}.`,
      'pergunta: uma pergunta geral, em português, que um eleitor possa responder com concordo ou discordo, alinhada ao voto Sim.',
      'simSignifica: uma frase curta dizendo o que o voto Sim fez, segundo o texto.',
      'contexto: uma ou duas frases, só com o que o texto traz.',
      'confianca: número de 0 a 1.',
    ].join(' '),
    user: [
      `Votação ${entry.votacaoId} em ${entry.data}.`,
      `Descrição oficial: ${entry.descricao}`,
      entry.proposicaoLabel ? `Proposição: ${entry.proposicaoLabel}` : '',
      entry.ementa ? `Ementa: ${entry.ementa}` : '',
      `Fonte: ${entry.sourceUrl}`,
    ]
      .filter(Boolean)
      .join('\n'),
  }
}

export function promptHash(system: string, user: string): string {
  return createHash('sha256').update(system).update('\n').update(user).digest('hex').slice(0, 16)
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

export function parseClassification(raw: string): Classification | ClassifyFailure {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) return { error: 'resposta sem JSON' }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw.slice(start, end + 1))
  } catch {
    return { error: 'JSON inválido' }
  }
  const row = asRecord(parsed)
  if (!row) return { error: 'JSON inválido' }
  const tema = typeof row.tema === 'string' ? row.tema : ''
  if (!THEME_SET.has(tema)) return { error: `tema fora da lista: ${tema}` }
  if (typeof row.pergunta !== 'string' || row.pergunta.trim() === '') {
    return { error: 'pergunta ausente' }
  }
  if (typeof row.simSignifica !== 'string' || row.simSignifica.trim() === '') {
    return { error: 'simSignifica ausente' }
  }
  if (typeof row.contexto !== 'string' || row.contexto.trim() === '') {
    return { error: 'contexto ausente' }
  }
  const confianca = typeof row.confianca === 'number' ? row.confianca : Number.NaN
  if (!Number.isFinite(confianca) || confianca < 0 || confianca > 1) {
    return { error: 'confianca fora de 0 a 1' }
  }
  return {
    tema: tema as QuizTheme,
    pergunta: row.pergunta.trim(),
    simSignifica: row.simSignifica.trim(),
    contexto: row.contexto.trim(),
    confianca,
  }
}

export function isClassification(
  value: Classification | ClassifyFailure,
): value is Classification {
  return !('error' in value)
}
