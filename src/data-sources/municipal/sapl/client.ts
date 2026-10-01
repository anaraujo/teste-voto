/**
 * Client da API REST do SAPL.
 *
 * Não é um requisito universal: cada instalação pode ter versão e endpoints
 * diferentes. O client recebe a raiz por configuração e **descobre** os
 * endpoints lendo o índice da API (`GET /api/`), em vez de assumir caminho
 * fixo. Se um endpoint não existir naquela instalação, a ausência é
 * informationada, não exception.
 *
 * Os caminhos de recurso vêm do índice. Os de campo filtrável são os
 * documentados pelo SAPL (Tastypie): `?legislatura=`, `?autor=`, `?parlamentar=`.
 */

import type { MunicipalHttpClient, MunicipalOperationLog } from '../http.ts'
import type { MunicipalChamberSource } from '../types.ts'
import { nextPageUrl } from './types.ts'
import type {
  SaplFiliacao,
  SaplLegislatura,
  SaplMandato,
  SaplPaginated,
  SaplParlamentar,
} from './types.ts'

/** Recursos que o SAPL usa e que esta camada consulta. */
const RECURSOS = {
  parlamentares: 'parlamentares/parlamentar',
  mandatos: 'parlamentares/mandato',
  legislaturas: 'parlamentares/legislatura',
  filiacoes: 'parlamentares/filiacao',
} as const

export type SaplRecurso = keyof typeof RECURSOS

export interface SaplIndexEntry {
  [recurso: string]: string
}

export interface SaplCallOptions {
  /** Filtros Tastypie appended à query. */
  filtros?: Record<string, string | number>
  /** Itens por página. O SAPL respeita, mas o padrão dele é 10. */
  limite?: number
}

export class SaplClient {
  private readonly http: MunicipalHttpClient
  private readonly chamber: MunicipalChamberSource
  private readonly baseUrl: string
  private index: SaplIndexEntry | null = null

  constructor(
    baseUrl: string,
    chamber: MunicipalChamberSource,
    http: MunicipalHttpClient,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '')
    this.chamber = chamber
    this.http = http
  }

  /**
   * Lê o índice da API e guarda as URLs de cada recurso. Cada instalação
   * publica o seu, então é ele — não uma constante — que diz onde fica o que.
   */
  async loadIndex(): Promise<SaplIndexEntry> {
    if (this.index) return this.index
    // O índice fica em `/api/`. A多数 instalações também aceitam `/api`
    // (redirect 301 do SAPL), mas algunas bloqueiam o caminho sem barra —
    // por isso a barra é obrigatória aqui.
    const index = await this.http.getJson<SaplIndexEntry>(
      `${this.baseUrl}/api/`,
      this.chamber,
      'api-index',
    )
    if (index === null || typeof index !== 'object') {
      throw new Error(`índice de API inesperado em ${this.baseUrl}/api/`)
    }
    this.index = index
    return index
  }

  /** URL de um recurso, pelo índice. `null` quando a instalação não publica. */
  async resourceUrl(recurso: SaplRecurso): Promise<string | null> {
    const index = await this.loadIndex()
    return index[RECURSOS[recurso]] ?? null
  }

  /**
   * Lista um recurso, seguindo a paginação até acabar.
   *
   * A paginação do SAPL é por `pagination.links.next`, e o `limit` precisa ser
   * explícito: sem ele, a instalação devolve 10 itens por página e a leitura
   * inteira viraria centenas de requisições.
   */
  async list<T>(
    recurso: SaplRecurso,
    options: SaplCallOptions = {},
  ): Promise<T[]> {
    const url = await this.resourceUrl(recurso)
    if (url === null) return []

    const limite = options.limite ?? 50
    const collected: T[] = []
    let next: string | null = withQuery(url, { limit: limite, ...options.filtros })

    while (next) {
      const page: SaplPaginated<T> = await this.http.getJson<SaplPaginated<T>>(
        next,
        this.chamber,
        recurso,
      )
      const results = Array.isArray(page?.results) ? page.results : []
      collected.push(...results)
      next = nextPageUrl(page?.pagination, this.baseUrl)
    }
    return collected
  }

  /** Todos os mandatos, com o(alias) parlamentar embutido por request. */
  listMandatos(): Promise<SaplMandato[]> {
    return this.list<SaplMandato>('mandatos', { limite: 100 })
  }

  listParlamentares(): Promise<SaplParlamentar[]> {
    return this.list<SaplParlamentar>('parlamentares', { limite: 100 })
  }

  listLegislaturas(): Promise<SaplLegislatura[]> {
    return this.list<SaplLegislatura>('legislaturas', { limite: 50 })
  }

  /** Filiações de um parlamentar, para trazer o partido do mandato. */
  listFiliacoes(parlamentarId: number): Promise<SaplFiliacao[]> {
    return this.list<SaplFiliacao>('filiacoes', {
      limite: 100,
      filtros: { parlamentar: parlamentarId },
    })
  }
}

function withQuery(url: string, params: Record<string, string | number>): string {
  const target = new URL(url)
  for (const [key, value] of Object.entries(params)) {
    target.searchParams.set(key, String(value))
  }
  return target.toString()
}

/** Log de linha por operação, no formato de observabilidade do projeto. */
export function municipalLogger(prefix: string): (entry: MunicipalOperationLog) => void {
  return (entry) => {
    const status = entry.success ? 'ok' : 'falha'
    const extra = entry.error ? ` (${entry.error})` : ''
    console.log(
      `[${prefix}] ${entry.municipality} ${entry.operation}: ${status} ` +
        `${entry.items} itens em ${entry.durationMs}ms${extra}`,
    )
  }
}
