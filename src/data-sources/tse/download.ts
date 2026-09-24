/**
 * Download e extração de arquivos ZIP do TSE.
 *
 * Usa o fetch global do Node para baixar e o binário `unzip` do sistema
 * para extrair (nenhuma dependência npm). Em sistemas sem `unzip`
 * (não é o caso de macOS/Linux) basta instalá-lo.
 */

import { spawnSync } from 'node:child_process'
import { mkdir, stat, writeFile } from 'node:fs/promises'
import { basename, dirname } from 'node:path'

export interface DownloadResult {
  filePath: string
  /** ETag ou Last-Modified informado pelo servidor (validador de mudanças). */
  validator: string | null
  bytes: number
  downloaded: boolean
}

export interface DownloadOptions {
  /** Rebaixa mesmo se o arquivo já existir. */
  force?: boolean
}

/** Baixa uma URL para um arquivo local, mantendo o metadado de validação. */
export async function downloadToFile(
  url: string,
  filePath: string,
  options: DownloadOptions = {},
): Promise<DownloadResult> {
  if (!options.force) {
    try {
      const meta = await stat(filePath)
      if (meta.isFile() && meta.size > 0) {
        return { filePath, validator: null, bytes: meta.size, downloaded: false }
      }
    } catch {
      // arquivo ausente — segue para o download
    }
  }

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`download falhou (${response.status} ${response.statusText}): ${url}`)
  }

  const validator = response.headers.get('etag') ?? response.headers.get('last-modified')
  const buffer = Buffer.from(await response.arrayBuffer())

  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, buffer)

  return { filePath, validator, bytes: buffer.length, downloaded: true }
}

export interface ZipEntry {
  name: string
  size: number
}

/** Lista os arquivos dentro de um ZIP usando o binário `unzip`. */
export function listZipEntries(zipPath: string): ZipEntry[] {
  const spawned = spawnSync('unzip', ['-l', zipPath], { encoding: 'utf8' })
  if (spawned.status !== 0) {
    throw new Error(
      `unzip -l falhou: ${spawned.stderr?.trim() ?? spawned.error?.message ?? 'erro'}`,
    )
  }

  const entries: ZipEntry[] = []
  for (const line of spawned.stdout.split('\n')) {
    const match = /^\s*(\d+)\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\s+(.+)$/.exec(line)
    if (match) {
      entries.push({ name: match[3].trim(), size: Number(match[1]) })
    }
  }
  return entries
}

/** Extrai todo o ZIP em um diretório de destino (sobrescreve). */
export async function extractZip(zipPath: string, destination: string): Promise<void> {
  await mkdir(destination, { recursive: true })
  const spawned = spawnSync('unzip', ['-o', '-q', zipPath, '-d', destination], {
    encoding: 'utf8',
  })
  if (spawned.status !== 0) {
    throw new Error(
      `unzip falhou: ${spawned.stderr?.trim() ?? spawned.error?.message ?? 'erro'}`,
    )
  }
}

/**
 * Encontra a entrada relevante dentro do ZIP. Quando `match` é vazio,
 * retorna a primeira entrada.
 */
export function findEntry(entries: ZipEntry[], match: string): ZipEntry | null {
  if (match === '') return entries[0] ?? null
  const normalized = match.toLowerCase()
  return (
    entries.find((entry) => entry.name.toLowerCase().includes(normalized)) ??
    entries.find((entry) => basename(entry.name).toLowerCase().includes(normalized)) ??
    null
  )
}

export function fileBaseName(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot === -1 ? fileName : fileName.slice(0, dot)
}