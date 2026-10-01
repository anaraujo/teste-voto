/**
 * Registro das Câmaras Municipais com dados verificados.
 *
 * O registry só tem o que foi de fato verificado, e nunca inventa URLs. Para
 * uma Câmara com `access === 'not-found'` ou `access === 'blocked'`, a
 * capacidade permanece toda falsa (§4). Isso é a diferença entre
 * "não encontrei" e "tem, mas não dá pra ler".
 */

import { buildSeedSources } from './registry.seed.ts'
import type { MunicipalChamberSource } from './types.ts'

export const MUNICIPAL_REGISTRY: readonly MunicipalChamberSource[] = Object.freeze(
  buildSeedSources(),
)

/**
 * Em ordem alfabética por nome do município.
 */
export function listChamberSources(): MunicipalChamberSource[] {
  return [...MUNICIPAL_REGISTRY].sort((a, b) =>
    a.municipalityName.localeCompare(b.municipalityName, 'pt-BR'),
  )
}

/**
 * Uma única Câmara pelo código IBGE. Devolve `null` se não estiver no
 * registry.
 */
export function getChamberSourceByIbgeCode(
  ibgeCode: string,
): MunicipalChamberSource | null {
  return MUNICIPAL_REGISTRY.find((s) => s.municipalityIbgeCode === ibgeCode) ?? null
}

/**
 * Os municípios que têm pelo menos uma chance de ter atividade legislativa
 * acessível por script. São as fontes com `access === 'verified'`.
 */
export function listSapableChambers(): MunicipalChamberSource[] {
  return listChamberSources().filter((s) => s.access === 'verified')
}
