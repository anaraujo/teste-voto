/**
 * Normalização de nome de município e resolução do código IBGE.
 *
 * O TSE grava o município como texto livre, e o mesmo município aparece em
 * grafias diferentes ao longo dos anos: `SAO MATEUS DO SUL` (2004) e
 * `SÃO MATEUS DO SUL` (2008 em diante) são o mesmo lugar. Sem esta
 * normalização, o histórico conta 59 municípios onde existem 55.
 *
 * A resolução é por tabela estática (`municipalities-pr.ts`), com os códigos
 * vindos do IBGE — não de dedução do nome.
 */

import { PR_MUNICIPALITIES, type PrMunicipality } from './municipalities-pr.ts'

/**
 * Chave de comparação: sem acento, sem pontuação, caixa alta e espaços
 * colapsados. Mesma normalização usada por `camara/identity.ts`, de propósito.
 *
 * A ordem importa: maiúsculas antes de filtrar os caracteres, senão a limpeza
 * apagaria a própria letra maiúscula inicial ('Curitiba' viraria 'C').
 */
export function normalizeMunicipalityName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const byNormalizedName = new Map<string, PrMunicipality>(
  PR_MUNICIPALITIES.map((m) => [normalizeMunicipalityName(m.name), m]),
)

const byCode = new Map<string, PrMunicipality>(PR_MUNICIPALITIES.map((m) => [m.ibgeCode, m]))

/**
 * resolve o município a partir do nome do TSE. Devolve `null` quando o nome
 * não está na tabela — o chamador registra como `unknown` em vez de assumir.
 */
export function resolveMunicipality(name: string): PrMunicipality | null {
  return byNormalizedName.get(normalizeMunicipalityName(name)) ?? null
}

/** Município pelo código IBGE; `null` se o código não estiver na tabela. */
export function municipalityByIbgeCode(ibgeCode: string): PrMunicipality | null {
  return byCode.get(ibgeCode) ?? null
}

/** Os 55 municípios cobertos, em ordem alfabética. */
export function listCoveredMunicipalities(): readonly PrMunicipality[] {
  return PR_MUNICIPALITIES
}
