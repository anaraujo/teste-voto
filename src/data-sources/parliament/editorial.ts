/**
 * Leitura da camada editorial da ficha comparável (content/editorial).
 *
 * O conteúdo editorial é versionado junto com o resto do projeto, então o
 * caminho é resolvido em relação à raiz (tanto nos scripts quanto no server).
 */

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import type { EditorialFicha } from '../../shared/ficha.ts'

/** Raiz de content/editorial (resolvida a partir deste arquivo). */
export const EDITORIAL_DIR = fileURLToPath(
  new URL('../../../content/editorial/', import.meta.url),
)

export function editorialPath(candidateId: string): string {
  return join(EDITORIAL_DIR, `${candidateId}.json`)
}

/** Lê a ficha editorial de um candidato (null quando não existe). */
export async function readEditorialFicha(
  candidateId: string,
): Promise<EditorialFicha | null> {
  try {
    const raw = await readFile(editorialPath(candidateId), 'utf8')
    const parsed = JSON.parse(raw) as EditorialFicha
    return parsed.campos && typeof parsed.campos === 'object' ? parsed : null
  } catch {
    return null
  }
}