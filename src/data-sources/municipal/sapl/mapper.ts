/**
 * Tradução do SAPL para o domínio municipal.
 *
 * O SAPL é Tastypie e devolve o que é conveniente para ele: `__str__` como
 * rótulo, campos em `snake_case`, chaves estrangeiras numéricas cruas. O
 * domínio quer o contrário — nome completo, datas ISO, partido legível, e um
 * `source` que permite abrir a origem (§16).
 *
 * Nada aqui inventa: campo ausente vira `null`, e `null` no domínio significa
 * "a fonte não informou", não "não existiu".
 */

import type {
  MunicipalCapabilities,
  MunicipalLegislator,
  MunicipalMandate,
  MunicipalSourceRef,
} from '../types.ts'
import type {
  SaplLegislatura,
  SaplMandato,
  SaplParlamentar,
} from './types.ts'

/** O SAPL anexa partido como FK; só o rótulo é útil ao leitor. */
export interface SaplPartidoRotulo {
  id: number
  sigla?: string | null
  nome?: string | null
}

export interface SaplMapperContext {
  source: MunicipalSourceRef
  municipalityIbgeCode: string
  legislatures?: readonly SaplLegislatura[]
  partidos?: ReadonlyMap<number, SaplPartidoRotulo>
  /**
   * Parlamentar a que cada mandato pertence, indexado por `id` do SAPL.
   *
   * Sem isto a FK `parlamentar` se perde na tradução, e o período de cada
   * pessoa — que é o que o matcher usa para checar se o mandato bate com o ano
   * da eleição — não pode ser atribuído a ninguém.
   */
  parlamentaresPorId?: ReadonlyMap<number, SaplParlamentar>
}

/** Rótulo de legislatura legível: "2021-2024", ou o número se só houver ele. */
export function legislatureLabel(
  legislatura: SaplLegislatura | undefined,
  fallback: number | null | undefined,
): string | null {
  if (legislatura === undefined) {
    return fallback === null || fallback === undefined ? null : `Legislatura ${fallback}`
  }
  const inicio = yearOf(legislatura.data_inicio)
  const fim = yearOf(legislatura.data_fim)
  if (inicio !== null && fim !== null) return `${inicio}-${fim}`
  const numero = legislatura.numero ?? fallback
  return numero === null ? null : `Legislatura ${numero}`
}

function yearOf(iso: string | null | undefined): number | null {
  if (iso === null || iso === undefined) return null
  const year = Number(iso.slice(0, 4))
  return Number.isFinite(year) ? year : null
}

/** Datas do SAPL vêm em ISO; às vezes com hora. Fica só a data. */
function toIsoDate(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null
  const date = value.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null
}

/**
 * Nome de uma pessoa na Câmara. `nome_completo` é o nome civil; quando a
 * Câmara não o preenche, o que sobra é `nome_parlamentar`, que costuma ser o
 * nome de gabinete ("Dr. Ana") — por isso o fallback é registrado como tal
 * pelo chamador, e o nome curto é justamente o que o matcher rejeita.
 */
export function legislatorName(parlamentar: SaplParlamentar): string {
  const completo = trimToNull(parlamentar.nome_completo)
  return completo ?? trimToNull(parlamentar.nome_parlamentar) ?? ''
}

/**
 * O nome que `legislatorName` não usou. Instalações que não publicam o nome
 * civil (Castro é um exemplo: 32 cadastros, todos com `nome_completo` vazio)
 * deixam o nome de gabinete como `fullName`, e aí o nome civil é justamente o
 * que o matcher precisa tentar.
 */
export function legislatorAlternateName(parlamentar: SaplParlamentar): string | null {
  const completo = trimToNull(parlamentar.nome_completo)
  const gabinete = trimToNull(parlamentar.nome_parlamentar)
  if (completo === null) return gabinete
  if (gabinete === null) return null
  return completo === gabinete ? null : gabinete
}

function trimToNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

export function mapParlamentar(
  parlamentar: SaplParlamentar,
  context: SaplMapperContext,
): MunicipalLegislator {
  return {
    sourceId: context.source.id,
    sourcePersonId: String(parlamentar.id),
    fullName: legislatorName(parlamentar),
    alternateName: legislatorAlternateName(parlamentar),
    municipalityIbgeCode: context.municipalityIbgeCode,
  }
}

export function mapMandato(
  mandato: SaplMandato,
  contexto: SaplMapperContext,
): MunicipalMandate | null {
  const legislatura = contexto.legislatures?.find((l) => l.id === mandato.legislatura)
  const partido = mandato.coligacao === null || mandato.coligacao === undefined
    ? null
    : contexto.partidos?.get(mandato.coligacao) ?? null

  // Mandato sem parlamentar e sem datas não descreve ninguém.
  if (mandato.parlamentar === null || mandato.parlamentar === undefined) return null

  return {
    legislatureId: legislatura === undefined ? '' : String(legislatura.id),
    municipalityIbgeCode: contexto.municipalityIbgeCode,
    sourceId: contexto.source.id,
    sourceMandateId: String(mandato.id),
    sourcePersonId: String(mandato.parlamentar),
    office: 'vereador',
    legislatureLabel: legislatureLabel(legislatura, mandato.legislatura),
    startDate: toIsoDate(mandato.data_inicio_mandato),
    endDate: toIsoDate(mandato.data_fim_mandato),
    titular: mandato.titular ?? null,
    party: partido?.sigla ?? partido?.nome ?? null,
    roles: [],
    source: contexto.source,
  }
}

/**
 * O que a fonte de fato entregou nesta leitura. `capabilities` não é uma
 * lista de desejos: cada item aqui marca um recurso que respondeu.
 */
export function capabilitiesFrom(
  lido: {
    parlamentares: boolean
    mandatos: boolean
    legislaturas: boolean
  },
  base: MunicipalCapabilities,
): MunicipalCapabilities {
  return {
    ...base,
    legislators: lido.parlamentares,
    mandates: lido.mandatos,
    legislatures: lido.legislaturas,
  }
}
