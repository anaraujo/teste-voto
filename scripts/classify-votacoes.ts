/**
 * Classifica a lista curta com um llama.cpp local (API compatível com
 * OpenAI). Exige QUIZ_LLM_BASE_URL. Cache em data/quiz/llm-cache/.
 *
 * Saída: content/quiz/votacoes.draft.json
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  classificationMessages,
  isClassification,
  parseClassification,
  promptHash,
} from '../src/data-sources/quiz/classify.ts'
import type { ShortlistEntry } from '../src/data-sources/quiz/rank.ts'
import { defaultDataDir } from '../src/data-sources/tse/candidates.ts'

interface DraftItem {
  votacaoId: string
  data: string
  descricao: string
  ementa: string | null
  proposicaoLabel: string | null
  sourceUrl: string
  status: 'ok' | 'falhou'
  error?: string
  tema?: string
  pergunta?: string
  simSignifica?: string
  contexto?: string
  confianca?: number
}

const baseUrl = process.env.QUIZ_LLM_BASE_URL?.replace(/\/$/, '')
if (!baseUrl) {
  console.error('[classify] defina QUIZ_LLM_BASE_URL (ex.: http://127.0.0.1:8080)')
  process.exit(1)
}

const DATA_DIR = defaultDataDir()
const cacheDir = join(DATA_DIR, 'quiz', 'llm-cache')
await mkdir(cacheDir, { recursive: true })

const shortlist = JSON.parse(
  await readFile(join(DATA_DIR, 'quiz', 'shortlist.json'), 'utf8'),
) as ShortlistEntry[]

const apiKey = process.env.QUIZ_LLM_API_KEY
const model = process.env.QUIZ_LLM_MODEL ?? 'local-model'

async function complete(system: string, user: string): Promise<string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (apiKey) headers.authorization = `Bearer ${apiKey}`
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })
  if (!response.ok) {
    throw new Error(`LLM ${response.status} ${response.statusText}`)
  }
  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  return body.choices?.[0]?.message?.content ?? ''
}

const draft: DraftItem[] = []
for (const entry of shortlist) {
  const messages = classificationMessages(entry)
  const hash = promptHash(messages.system, messages.user)
  const cachePath = join(cacheDir, `${entry.votacaoId}-${hash}.json`)
  let raw: string | null = null
  try {
    raw = await readFile(cachePath, 'utf8')
  } catch {
    raw = null
  }
  if (raw === null) {
    try {
      raw = await complete(messages.system, messages.user)
      await writeFile(cachePath, raw)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      draft.push({
        votacaoId: entry.votacaoId,
        data: entry.data,
        descricao: entry.descricao,
        ementa: entry.ementa,
        proposicaoLabel: entry.proposicaoLabel,
        sourceUrl: entry.sourceUrl,
        status: 'falhou',
        error: message,
      })
      console.log(`[classify] ${entry.votacaoId} falhou: ${message}`)
      continue
    }
  }

  let parsed = parseClassification(raw)
  if (!isClassification(parsed)) {
    try {
      raw = await complete(messages.system, messages.user)
      await writeFile(cachePath, raw)
      parsed = parseClassification(raw)
    } catch (error) {
      parsed = {
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  if (!isClassification(parsed)) {
    draft.push({
      votacaoId: entry.votacaoId,
      data: entry.data,
      descricao: entry.descricao,
      ementa: entry.ementa,
      proposicaoLabel: entry.proposicaoLabel,
      sourceUrl: entry.sourceUrl,
      status: 'falhou',
      error: parsed.error,
    })
    console.log(`[classify] ${entry.votacaoId} falhou: ${parsed.error}`)
    continue
  }

  draft.push({
    votacaoId: entry.votacaoId,
    data: entry.data,
    descricao: entry.descricao,
    ementa: entry.ementa,
    proposicaoLabel: entry.proposicaoLabel,
    sourceUrl: entry.sourceUrl,
    status: 'ok',
    tema: parsed.tema,
    pergunta: parsed.pergunta,
    simSignifica: parsed.simSignifica,
    contexto: parsed.contexto,
    confianca: parsed.confianca,
  })
  console.log(`[classify] ${entry.votacaoId} ${parsed.tema}`)
}

const output = new URL('../content/quiz/votacoes.draft.json', import.meta.url)
await writeFile(output, JSON.stringify(draft, null, 2))
const ok = draft.filter((item) => item.status === 'ok').length
console.log(`[classify] ${ok}/${draft.length} em content/quiz/votacoes.draft.json`)
