/**
 * Consultas à API de Dados Abertos da Câmara dos Deputados usadas pela
 * ficha comparável: mandatos por legislatura, proposições de autoria,
 * despesas, comissões e votos em votações nominais.
 *
 * Não há cache em disco aqui: os resultados são gravados no SQLite pelo
 * script de sincronização (scripts/sync-parliament.ts).
 */

export interface DeputadoLista {
  id: number
  nome: string
  siglaPartido: string
  siglaUf: string
  idLegislatura: number
  urlFoto: string | null
}

export interface DeputadoDetalhe {
  id: number
  dataNascimento: string | null
}

export interface ProposicaoAutor {
  id: number
  siglaTipo: string
  numero: number
  ano: number
  dataApresentacao: string | null
}

export interface DespesaItem {
  ano: number
  mes: number
  tipoDespesa: string
  valorLiquido: number
  fornecedor: string
  urlDocumento: string | null
}

export interface OrgaoDeputado {
  siglaOrgao: string
  nomeOrgao: string
  titulo: string
  dataInicio: string | null
  dataFim: string | null
}

export interface VotoVotacao {
  idDeputado: number
  voto: string
  dataRegistroVoto: string | null
}

const BASE = 'https://dadosabertos.camara.leg.br/api/v2'
const PAGE_SIZE = 100

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/** GET JSON com retry em 429/5xx/tempo limite e atraso entre chamadas. */
async function getJson<T>(
  url: string,
  retries = 4,
  delayMs = 150,
): Promise<T> {
  let lastError: unknown = null
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { accept: 'application/json' },
      })
      if (response.status === 429) {
        lastError = new Error('rate limit (429)')
        await sleep(2000 * attempt)
        continue
      }
      if (response.status >= 500) {
        lastError = new Error(`Câmara respondeu ${response.status}`)
        await sleep(1200 * attempt)
        continue
      }
      if (!response.ok) {
        throw new Error(`Câmara respondeu ${response.status} para ${url}`)
      }
      return (await response.json()) as T
    } catch (error) {
      lastError = error
      if (attempt === retries) break
      await sleep(delayMs * attempt)
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`sem resposta de ${url}`)
}

/** Envolve facilitador de tipos para os dados da Câmara. */
export interface ApiCasaRest<T> {
  dados?: T[]
  links?: Array<{ rel: string; href: string }>
}

function nextHref<T>(body: ApiCasaRest<T>): string | null {
  const next = (body.links ?? []).find((link) => link.rel === 'next')
  return next?.href ?? null
}

/** Retorna todos os deputados da UF numa legislatura (ex.: 56, 57). */
export async function fetchDeputadosPorLegislatura(
  uf: string,
  legislatura: number,
): Promise<DeputadoLista[]> {
  const items: DeputadoLista[] = []
  let href: string | null =
    `${BASE}/deputados?siglaUf=${uf}&idLegislatura=${legislatura}` +
    `&itens=${PAGE_SIZE}&ordem=ASC&ordenarPor=nome`

  while (href) {
    const body: ApiCasaRest<DeputadoLista> = await getJson(href)
    items.push(...(Array.isArray(body.dados) ? body.dados : []))
    href = nextHref(body)
  }
  return items
}

/** Detalhe do deputado (data de nascimento) para confirmação de identidade. */
export async function fetchDeputadoDetalhe(id: number): Promise<DeputadoDetalhe | null> {
  try {
    const body = await getJson<{
      dados?: { id?: number; dataNascimento?: string | null }
    }>(`${BASE}/deputados/${id}`)
    return {
      id: body.dados?.id ?? id,
      dataNascimento: body.dados?.dataNascimento ?? null,
    } as DeputadoDetalhe
  } catch {
    return null
  }
}

/** Proposições de autoria do deputado (filtro de período opcional). */
export async function fetchProposicoesPorAutor(
  idDeputado: number,
  options: { dataInicio?: string; dataFim?: string } = {},
): Promise<ProposicaoAutor[]> {
  const items: ProposicaoAutor[] = []
  const params = new URLSearchParams({ idDeputadoAutor: String(idDeputado) })
  if (options.dataInicio) params.set('dataApresentacaoInicio', options.dataInicio)
  if (options.dataFim) params.set('dataApresentacaoFim', options.dataFim)
  params.set('itens', String(PAGE_SIZE))

  let href: string | null = `${BASE}/proposicoes?${params.toString()}`
  while (href) {
    const body: ApiCasaRest<ProposicaoAutor> = await getJson(href)
    items.push(...(Array.isArray(body.dados) ? body.dados : []))
    href = nextHref(body)
  }
  return items
}

/** Despesas (cota etc.) do deputado numa legislatura, paginadas. */
export async function fetchDespesas(
  idDeputado: number,
  idLegislatura: number,
): Promise<DespesaItem[]> {
  const items: DespesaItem[] = []
  let href: string | null =
    `${BASE}/deputados/${idDeputado}/despesas?idLegislatura=${idLegislatura}` +
    `&itens=${PAGE_SIZE}&ordem=ASC&ordenarPor=dataDocumento`

  while (href) {
    const body: ApiCasaRest<DespesaItemBase> = await getJson(href)
    items.push(...(Array.isArray(body.dados) ? normalizeDespesa(body.dados) : []))
    href = nextHref(body)
  }
  return items
}

interface DespesaItemBase {
  ano: number
  mes: number
  tipoDespesa?: string
  valorLiquido?: number
  nomeFornecedor?: string
  urlDocumento?: string | null
}

function normalizeDespesa(items: DespesaItemBase[]): DespesaItem[] {
  return items.map((item) => ({
    ano: item.ano,
    mes: item.mes,
    tipoDespesa: item.tipoDespesa ?? '',
    valorLiquido: item.valorLiquido ?? 0,
    fornecedor: item.nomeFornecedor ?? '',
    urlDocumento: item.urlDocumento ?? null,
  }))
}

/** Comissões/órgãos do deputado. */
export async function fetchOrgaos(idDeputado: number): Promise<OrgaoDeputado[]> {
  const body = await getJson<{
    dados?: Array<{
      siglaOrgao?: string
      nomeOrgao?: string
      titulo?: string
      dataInicio?: string | null
      dataFim?: string | null
    }>
  }>(`${BASE}/deputados/${idDeputado}/orgaos`)

  return (Array.isArray(body.dados) ? body.dados : []).map((item) => ({
    siglaOrgao: item.siglaOrgao ?? '',
    nomeOrgao: item.nomeOrgao ?? '',
    titulo: item.titulo ?? '',
    dataInicio: item.dataInicio ?? null,
    dataFim: item.dataFim ?? null,
  }))
}

/** Todos os votos (por deputado) de uma votação nominal. */
export async function fetchVotosVotacao(votacaoId: string): Promise<VotoVotacao[]> {
  const body = await getJson<{
    dados?: Array<{
      tipoVoto?: string
      dataRegistroVoto?: string | null
      deputado_?: { id?: number }
    }>
  }>(`${BASE}/votacoes/${votacaoId}/votos`)

  return (Array.isArray(body.dados) ? body.dados : []).flatMap((item) => {
    const id = item.deputado_?.id
    return id === undefined
      ? []
      : [
          {
            idDeputado: id,
            voto: item.tipoVoto ?? '',
            dataRegistroVoto: item.dataRegistroVoto ?? null,
          },
        ]
  })
}