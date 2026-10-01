/**
 * Tipos da API REST do SAPL, conforme o que a instância devolve.
 *
 * São os nomes de campo literais do SAPL (`snake_case`), não o domínio: a
 * tradução para o domínio é feita em `mapper.ts`. O objetivo é deixar visível
 * o quanto o formato é do SAPL.
 *
 * A API responde no padrão Tastypie (`results` + `pagination`) e o `limit`
 * padrão é 10 — `pagination.end_index` diz onde a página termina.
 */

export interface SaplPagination {
  links?: { next?: string | null; previous?: string | null }
  previous_page?: number | null
  next_page?: number | null
  start_index?: number
  end_index?: number
  total_entries?: number
  total_pages?: number
  page?: number
}

export interface SaplMandato {
  id: number
  __str__?: string
  data_inicio_mandato?: string | null
  data_fim_mandato?: string | null
  /** `true` para o titular; suplente que não exerceu vem `false`. */
  titular?: boolean | null
  votos_recebidos?: number | null
  data_expedicao_diploma?: string | null
  /** FK para parlamentares/parlamentar. */
  parlamentar?: number | null
  legislatura?: number | null
  tipo_afastamento?: number | null
  coligacao?: number | null
  observacao?: string | null
}

export interface SaplParlamentar {
  id: number
  nome_parlamentar?: string | null
  nome_completo?: string | null
  sexo?: string | null
  /** Número do gabinete (cadeira). NÃO é o número de candidato do TSE. */
  numero_gab_parlamentar?: string | null
  profissao?: string | null
  endereco_web?: string | null
  locais_atuacao?: string | null
  biografia?: string | null
  fotografia?: string | null
  ativo?: boolean | null
}

export interface SaplLegislatura {
  id: number
  numero?: number | null
  data_inicio?: string | null
  data_fim?: string | null
  data_eleicao?: string | null
}

export interface SaplFiliacao {
  id: number
  data?: string | null
  data_desligamento?: string | null
  partido?: number | null
  parlamentar?: number | null
}

export interface SaplPaginated<T> {
  results?: T[]
  pagination?: SaplPagination
  metadata?: Record<string, unknown>
}

/**
 * Paginação do SAPL traz `links.next` como URL **absoluta**, e a instalação a
 * monta com `http://` mesmo quando o site é `https://`. Reusar essa string sem
 * corrigir o esquema faz o cliente voltar para o canal não criptografado.
 */
export function nextPageUrl(
  pagination: SaplPagination | undefined,
  baseUrl: string,
): string | null {
  const next = pagination?.links?.next
  if (next === null || next === undefined || next === '') return null

  const target = new URL(next)
  const base = new URL(baseUrl)
  if (target.protocol !== base.protocol) target.protocol = base.protocol
  return target.toString()
}
