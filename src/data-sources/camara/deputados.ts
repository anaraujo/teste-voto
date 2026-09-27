/**
 * API de Dados Abertos da Câmara dos Deputados: deputados em exercício
 * da legislatura atual (2023-2026), filtrados pela UF de origem.
 *
 * Usado para identificar candidatos à reeleição (deputados federais atuais
 * que aparecem nas listas de candidatura do TSE).
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

export interface CamaraDeputy {
  id: number
  nome: string
  siglaPartido: string
  siglaUf: string
  urlFoto: string | null
  email: string | null
  /** Data de nascimento (ISO AAAA-MM-DD) do detalhe do deputado. */
  dataNascimento: string | null
}

export interface CamaraDeputiesFetchResult {
  items: CamaraDeputy[]
  retrievedAt: string
  fromCache: boolean
  url: string
}

const CAMARA_DEPUTADOS_URL =
  'https://dadosabertos.camara.leg.br/api/v2/deputados?siglaUf=PR&ordem=ASC&ordenarPor=nome&itens=100'
const CAMARA_DETAIL_URL = (id: number): string =>
  `https://dadosabertos.camara.leg.br/api/v2/deputados/${id}`

function cachePath(dataDir: string): string {
  return join(dataDir, 'camara', 'deputados_pr_2026.json')
}

/** Busca a lista no cache local quando existir, salvo --force. */
async function readCache(filePath: string): Promise<CamaraDeputy[] | null> {
  try {
    const parsed = JSON.parse(await readFile(filePath, 'utf8')) as {
      items: CamaraDeputy[]
    }
    return Array.isArray(parsed.items) ? parsed.items : null
  } catch {
    return null
  }
}

/** Completa cada deputado com a data de nascimento (detalhe). */
async function fetchDeputyBirthDates(items: CamaraDeputy[]): Promise<void> {
  for (const item of items) {
    try {
      const response = await fetch(CAMARA_DETAIL_URL(item.id), {
        headers: { accept: 'application/json' },
      })
      if (!response.ok) continue
      const body = (await response.json()) as {
        dados?: { dataNascimento?: string | null }
      }
      const date = body.dados?.dataNascimento
      item.dataNascimento = typeof date === 'string' && date !== '' ? date : null
    } catch {
      item.dataNascimento = null
    }
  }
}

export async function fetchCamaraDeputados(
  options: { dataDir?: string; force?: boolean } = {},
): Promise<CamaraDeputiesFetchResult> {
  const filePath = cachePath(options.dataDir ?? '.')
  if (!options.force) {
    const cached = await readCache(filePath)
    if (cached) {
      return { items: cached, retrievedAt: new Date().toISOString(), fromCache: true, url: CAMARA_DEPUTADOS_URL }
    }
  }

  const response = await fetch(CAMARA_DEPUTADOS_URL, {
    headers: { accept: 'application/json' },
  })
  if (!response.ok) {
    throw new Error(`Câmara respondeu ${response.status}`)
  }
  const body = (await response.json()) as { dados?: CamaraDeputy[] }
  const items = (Array.isArray(body.dados) ? body.dados : []).map((item) => ({
    ...item,
    dataNascimento: null,
  }))

  await fetchDeputyBirthDates(items)

  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, JSON.stringify({ items }, null, 2), 'utf8')

  return { items, retrievedAt: new Date().toISOString(), fromCache: false, url: CAMARA_DEPUTADOS_URL }
}