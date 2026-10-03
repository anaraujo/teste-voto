/**
 * Prestação de contas eleitorais de candidatos (receitas e despesas).
 *
 * Fonte: TSE, dataset `prestacao-de-contas-eleitorais-candidatos` (SPCE).
 * Um ZIP nacional com um arquivo por UF para receitas
 * (`receitas_candidatos_<ano>_<UF>.csv`) e despesas contratadas
 * (`despesas_contratadas_candidatos_<ano>_<UF>.csv`). As receitas trazem o
 * doador; as despesas contratadas trazem o fornecedor. O casamento com o
 * candidato é pelo `SQ_CANDIDATO` (mesma chave da `consulta_cand`).
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { DatasetDescriptor } from '../../shared/elections.ts'
import { buildHeaderIndex, parseCsv, readCell, type ParsedCsv } from './csv.ts'
import {
  downloadToFile,
  extractZip,
  listZipEntries,
  type ZipEntry,
} from './download.ts'
import { parseDate, parseMoney } from './normalize.ts'

export interface CampaignReceita {
  sqCandidato: string
  doador: string | null
  doadorDocumento: string | null
  fonte: string | null
  origem: string | null
  especie: string | null
  data: string | null
  valor: number
}

export interface CampaignDespesa {
  sqCandidato: string
  fornecedor: string | null
  fornecedorDocumento: string | null
  origem: string | null
  descricao: string | null
  data: string | null
  valor: number
}

export interface CampaignFinanceFetchResult {
  receitas: CampaignReceita[]
  despesas: CampaignDespesa[]
  sourceFileReceitas: string | null
  sourceFileDespesas: string | null
  downloaded: boolean
  validator: string | null
  retrievedAt: string
  rowsRead: number
}

export interface FetchOptions {
  dataDir?: string
  force?: boolean
}

/** Sentinelas de "sem informação" comuns nos arquivos de prestação de contas. */
function cleanCell(value: string): string | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const upper = trimmed.toUpperCase()
  if (
    upper === '#NULO' ||
    upper === '#NULO#' ||
    upper === '#NE' ||
    upper === '#NE#' ||
    upper === '-1'
  ) {
    return null
  }
  return trimmed
}

function entryBySuffix(entries: ZipEntry[], suffix: string): ZipEntry | null {
  const target = suffix.toLowerCase()
  return (
    entries.find((entry) => entry.name.toLowerCase().endsWith(target)) ?? null
  )
}

function defaultDataDir(): string {
  return process.env.DATA_DIR ?? 'data'
}

interface PreparedZip {
  extractDir: string
  zipPath: string
  downloaded: boolean
  validator: string | null
}

/** Um ZIP nacional por URL neste processo: as 27 UFs leem o mesmo arquivo. */
const preparedZips = new Map<string, Promise<PreparedZip>>()

function prepareZip(
  descriptor: DatasetDescriptor,
  options: FetchOptions,
): Promise<PreparedZip> {
  const dataDir = options.dataDir ?? defaultDataDir()
  const key = `${dataDir}\0${descriptor.url}`
  const cached = preparedZips.get(key)
  if (cached) return cached

  const task = (async () => {
    const zipName = descriptor.url.slice(descriptor.url.lastIndexOf('/') + 1)
    const zipPath = join(dataDir, 'download', zipName)
    const download = await downloadToFile(descriptor.url, zipPath, {
      force: options.force,
    })
    const extractDir = join(
      dataDir,
      'download',
      'extracted',
      descriptor.dataset,
    )
    await extractZip(zipPath, extractDir)
    return {
      extractDir,
      zipPath,
      downloaded: download.downloaded,
      validator: download.validator,
    }
  })()

  preparedZips.set(key, task)
  task.catch(() => {
    if (preparedZips.get(key) === task) preparedZips.delete(key)
  })
  return task
}

/** Converte as linhas do CSV de receitas em registros normalizados. */
export function parseReceitas(csv: ParsedCsv): CampaignReceita[] {
  const index = buildHeaderIndex(csv.headers)
  const rows: CampaignReceita[] = []
  for (const row of csv.rows) {
    const sqCandidato = readCell(index, row, 'SQ_CANDIDATO')
    if (sqCandidato === '') continue
    const valor = parseMoney(readCell(index, row, 'VR_RECEITA'))
    if (valor === null) continue
    const doador =
      cleanCell(readCell(index, row, 'NM_DOADOR_RFB')) ??
      cleanCell(readCell(index, row, 'NM_DOADOR'))
    rows.push({
      sqCandidato,
      doador,
      doadorDocumento: cleanCell(readCell(index, row, 'NR_CPF_CNPJ_DOADOR')),
      fonte: cleanCell(readCell(index, row, 'DS_FONTE_RECEITA')),
      origem: cleanCell(readCell(index, row, 'DS_ORIGEM_RECEITA')),
      especie: cleanCell(readCell(index, row, 'DS_ESPECIE_RECEITA')),
      data: parseDate(readCell(index, row, 'DT_RECEITA')),
      valor,
    })
  }
  return rows
}

/** Converte as linhas do CSV de despesas contratadas em registros normalizados. */
export function parseDespesas(csv: ParsedCsv): CampaignDespesa[] {
  const index = buildHeaderIndex(csv.headers)
  const rows: CampaignDespesa[] = []
  for (const row of csv.rows) {
    const sqCandidato = readCell(index, row, 'SQ_CANDIDATO')
    if (sqCandidato === '') continue
    const valor = parseMoney(readCell(index, row, 'VR_DESPESA_CONTRATADA'))
    if (valor === null) continue
    const fornecedor =
      cleanCell(readCell(index, row, 'NM_FORNECEDOR_RFB')) ??
      cleanCell(readCell(index, row, 'NM_FORNECEDOR'))
    rows.push({
      sqCandidato,
      fornecedor,
      fornecedorDocumento: cleanCell(
        readCell(index, row, 'NR_CPF_CNPJ_FORNECEDOR'),
      ),
      origem: cleanCell(readCell(index, row, 'DS_ORIGEM_DESPESA')),
      descricao: cleanCell(readCell(index, row, 'DS_DESPESA')),
      data: parseDate(readCell(index, row, 'DT_DESPESA')),
      valor,
    })
  }
  return rows
}

/**
 * Baixa (com cache) e lê receitas e despesas de uma UF.
 * Anos sem arquivo são tolerados: devolve listas vazias.
 */
export async function fetchCampaignFinance(
  descriptor: DatasetDescriptor,
  uf: string,
  options: FetchOptions = {},
): Promise<CampaignFinanceFetchResult> {
  const prepared = await prepareZip(descriptor, options)
  const entries = listZipEntries(prepared.zipPath)

  const receitaEntry = entryBySuffix(
    entries,
    `receitas_candidatos_2026_${uf}.csv`,
  )
  const despesaEntry = entryBySuffix(
    entries,
    `despesas_contratadas_candidatos_2026_${uf}.csv`,
  )

  let receitas: CampaignReceita[] = []
  let despesas: CampaignDespesa[] = []
  let rowsRead = 0

  if (receitaEntry) {
    const buffer = await readFile(join(prepared.extractDir, receitaEntry.name))
    const parsed = parseCsv(buffer)
    rowsRead += parsed.rows.length
    receitas = parseReceitas(parsed)
  }
  if (despesaEntry) {
    const buffer = await readFile(join(prepared.extractDir, despesaEntry.name))
    const parsed = parseCsv(buffer)
    rowsRead += parsed.rows.length
    despesas = parseDespesas(parsed)
  }

  return {
    receitas,
    despesas,
    sourceFileReceitas: receitaEntry?.name ?? null,
    sourceFileDespesas: despesaEntry?.name ?? null,
    downloaded: prepared.downloaded,
    validator: prepared.validator,
    retrievedAt: new Date().toISOString(),
    rowsRead,
  }
}

/** Soma de contribuições por nome, em ordem decrescente (para "maiores"). */
export function topContributors(
  rows: ReadonlyArray<{ nome: string | null; valor: number }>,
  limit: number,
): Array<{ nome: string; valor: number }> {
  const byNome = new Map<string, number>()
  for (const row of rows) {
    const nome = row.nome
    if (!nome) continue
    byNome.set(nome, (byNome.get(nome) ?? 0) + row.valor)
  }
  return [...byNome.entries()]
    .map(([nome, valor]) => ({ nome, valor }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, limit)
}
