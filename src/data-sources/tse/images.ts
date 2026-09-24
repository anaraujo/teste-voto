/**
 * Ingestão das fotos oficiais de candidatos do TSE.
 *
 * Baixa o ZIP de fotos, extrai para `data/photos` e retorna a lista de
 * arquivos. O vínculo com o candidato (pelo SQ_CANDIDATO no nome do
 * arquivo) é feito na ingestão.
 */

import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { ElectionConfig } from '../../shared/elections.ts'
import { downloadToFile, extractZip, fileBaseName } from './download.ts'
import { defaultDataDir } from './candidates.ts'

export interface PhotosFetchResult {
  photosDir: string
  files: string[]
  sourceFile: string | null
  downloaded: boolean
  validator: string | null
  retrievedAt: string
}

export interface PhotosOptions {
  dataDir?: string
  force?: boolean
}

async function collectImageFiles(dir: string): Promise<string[]> {
  const found: string[] = []
  const stack = [dir]
  while (stack.length > 0) {
    const current = stack.pop()!
    let entries
    try {
      entries = await readdir(current, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const full = join(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(full)
      } else if (entry.isFile() && /\.(jpe?g|png)$/i.test(entry.name)) {
        found.push(full)
      }
    }
  }
  found.sort()
  return found
}

export async function fetchCandidatePhotos(
  election: ElectionConfig,
  options: PhotosOptions = {},
): Promise<PhotosFetchResult> {
  const dataDir = options.dataDir ?? defaultDataDir()
  const descriptor = election.datasets.photos
  const photosDir = join(dataDir, 'photos')

  const path = new URL(descriptor.url).pathname
  const zipName = path.slice(path.lastIndexOf('/') + 1)
  const zipPath = join(dataDir, 'download', zipName)

  // Fotos são um dataset opcional: se o download falhar, seguimos sem elas.
  let downloaded = false
  let validator: string | null = null
  let files: string[] = []
  try {
    const download = await downloadToFile(descriptor.url, zipPath, {
      force: options.force,
    })
    downloaded = download.downloaded
    validator = download.validator
    await extractZip(zipPath, photosDir)
    files = await collectImageFiles(photosDir)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`fotos indisponíveis (${descriptor.dataset}): ${message}`)
  }

  return {
    photosDir,
    files,
    sourceFile: zipName,
    downloaded,
    validator,
    retrievedAt: new Date().toISOString(),
  }
}

/**
 * Encontra o arquivo de foto de um candidato. O TSE nomeia as fotos pelo
 * SQ_CANDIDATO (ex.: "123456.jpg"). Aceita também bases que contenham o
 * número (ex.: "foto_123456.jpg").
 */
export function photoFileForSequence(files: readonly string[], sequence: string): string | null {
  const base = sequence.trim()
  if (base === '') return null

  const exact = files.find((file) => fileBaseName(file) === base)
  if (exact) return exact

  const contained = files.find(
    (file) => fileBaseName(file).includes(base) || base.includes(fileBaseName(file)),
  )
  return contained ?? null
}

/** Nome relativo à raiz de `data/photos` (para a URL /photos/...). */
export function photoPublicPath(filesDir: string, file: string): string {
  return `/photos/${file.slice(filesDir.length + 1).replaceAll('\\', '/')}`
}