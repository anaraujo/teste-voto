/**
 * Fonte legislativa municipal via SAPL: implementa `MunicipalLegislativeSource`
 * para uma Câmara cuja API foi verificada.
 *
 * Uma instância por Câmara. Só entra aqui o que respondeu na verificação
 * (`access === 'verified'` com `apiBaseUrl`); o resto do registry vira ficha
 * explicando a ausência, não um erro (§4).
 */

import type { MunicipalHttpClient } from '../http.ts'
import type {
  MunicipalChamberSource,
  MunicipalLegislativeSource,
  MunicipalLegislator,
  MunicipalMandate,
  MunicipalSourceRef,
} from '../types.ts'
import { SaplClient } from './client.ts'
import { mapMandato, mapParlamentar } from './mapper.ts'
import type { SaplParlamentar } from './types.ts'

/** Cargos na Mesa/comissões não vêm no mandato; ficam para a Phase 4. */
const NO_ROLES: readonly string[] = []

export interface SaplSourceOptions {
  chamber: MunicipalChamberSource
  http: MunicipalHttpClient
  source: MunicipalSourceRef
}

/** Credencial da Câmara para a API, quando existir. */
export interface SaplCredentials {
  token: string
  /** Query string que autentica, ex.: `?token=...`. Varia por instalação. */
  authQuery?: string
}

export class SaplMunicipalSource implements MunicipalLegislativeSource {
  readonly chamber: MunicipalChamberSource

  private readonly client: SaplClient
  private readonly source: MunicipalSourceRef
  private readonly ibgeCode: string
  private legislatorCache: SaplParlamentar[] | null = null

  constructor(options: SaplSourceOptions, credentials?: SaplCredentials) {
    const { chamber, http, source } = options
    if (chamber.apiBaseUrl === null) {
      throw new Error(`Câmara de ${chamber.municipalityName} sem apiBaseUrl`)
    }
    if (chamber.access !== 'verified') {
      // Não ler fonte não verificada: o registry diz por quê não dá (§4).
      throw new Error(
        `Câmara de ${chamber.municipalityName} não tem acesso verificado (${chamber.access})`,
      )
    }

    this.chamber = chamber
    this.client = new SaplClient(applyCredentials(chamber.apiBaseUrl, credentials), chamber, http)
    this.source = source
    this.ibgeCode = chamber.municipalityIbgeCode
  }

  async listMandates(): Promise<MunicipalMandate[]> {
    const [mandatos, legislatures] = await Promise.all([
      this.client.listMandatos(),
      this.client.listLegislaturas(),
    ])

    const context = {
      source: this.source,
      municipalityIbgeCode: this.ibgeCode,
      legislatures,
    }

    return mandatos
      .map((mandato) => mapMandato(mandato, context))
      .filter((mandate): mandate is MunicipalMandate => mandate !== null)
      .map((mandate) => ({ ...mandate, roles: [...NO_ROLES] }))
  }

  async findLegislators(): Promise<MunicipalLegislator[]> {
    const parlamentares = await this.listParlamentares()
    const context = {
      source: this.source,
      municipalityIbgeCode: this.ibgeCode,
    }
    return parlamentares
      .map((parlamentar) => mapParlamentar(parlamentar, context))
      .filter((legislator) => legislator.fullName !== '')
  }

  /** Parlamentares crus, para quem precisar de `numero_gab_parlamentar`. */
  async listParlamentares(): Promise<SaplParlamentar[]> {
    if (this.legislatorCache !== null) return this.legislatorCache
    const legislators = await this.client.listParlamentares()
    this.legislatorCache = legislators
    return legislators
  }

  /**
   * Início do mandato mais antigo de cada parlamentar, indexado por
   * `sourcePersonId`. É o que o matcher usa para checar o período contra o ano
   * da eleição.
   *
   * Sai da lista de mandatos que já foi lida, sem requisição extra. Buscar
   * `?parlamentar=<id>` uma vez por legislator custava uma ida ao servidor por
   * pessoa — até 292 em Foz do Iguaçu, o que arrastava a sincronização inteira
   * para mais de uma hora e saturava o pool de conexões.
   */
  mandateStartsByPerson(mandates: readonly MunicipalMandate[]): Map<string, string> {
    const earliest = new Map<string, string>()
    for (const mandate of mandates) {
      const personId = mandate.sourcePersonId
      if (personId === null || mandate.startDate === null) continue
      const known = earliest.get(personId)
      if (known === undefined || mandate.startDate < known) {
        earliest.set(personId, mandate.startDate)
      }
    }
    return earliest
  }
}

function applyCredentials(baseUrl: string, credentials?: SaplCredentials): string {
  if (credentials === undefined) return baseUrl
  const url = new URL(baseUrl)
  if (credentials.authQuery === undefined) {
    url.searchParams.set('token', credentials.token)
  } else {
    for (const [key, value] of new URLSearchParams(credentials.authQuery)) {
      url.searchParams.set(key, value)
    }
  }
  return url.toString()
}
