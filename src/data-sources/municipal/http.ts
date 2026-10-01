/**
 * Cliente HTTP para as Câmaras Municipais.
 *
 * Servidores de Câmara não podem ser sobrecarregados. O cliente garante:
 *
 * - **timeout** por requisição (algumas câmaras simplesmente não respondem);
 * - **retry** com backoff exponencial em 5xx e 429;
 * - **limite de concorrência** (padrão 2 requisições por host);
 * - **intervalo mínimo** entre requisições ao mesmo host;
 * - **deduplicação** de URLs simultâneas;
 * - **log estruturado** de cada operação, sem dados pessoais (§26).
 *
 * Não há dependência externa: só o `fetch` global do Node.
 */

import type { MunicipalChamberSource } from './types.ts'

/** Uma linha de log por operação — sem nome de pessoa (§26). */
export interface MunicipalOperationLog {
  source: string
  municipality: string
  operation: string
  success: boolean
  durationMs: number
  items: number
  error?: string
}

export interface HttpLogSink {
  (entry: MunicipalOperationLog): void
}

export interface MunicipalHttpOptions {
  /** Timeout por requisição, em ms. */
  timeoutMs?: number
  /** Tentativas totais, incluindo a primeira. */
  retries?: number
  /** Espera base do backoff, em ms. */
  backoffMs?: number
  /** Requisições simultâneas por host. */
  concurrency?: number
  /** Intervalo mínimo entre requisições ao mesmo host, em ms. */
  minIntervalMs?: number
  /** User-Agent enviado. Identifica o projeto; um contato é bom. */
  userAgent?: string
  log?: HttpLogSink
  /** Injetável para testes: sem isto, `fetch` global. */
  fetchImpl?: typeof fetch
}

const DEFAULTS = {
  timeoutMs: 20_000,
  retries: 3,
  backoffMs: 300,
  concurrency: 2,
  minIntervalMs: 250,
  userAgent: 'teste-voto/0.1 (projeto open-source; contato via repositorio)',
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

export class MunicipalHttpError extends Error {
  readonly status: number | null
  readonly url: string

  constructor(message: string, status: number | null, url: string) {
    super(message)
    this.name = 'MunicipalHttpError'
    this.status = status
    this.url = url
  }
}

/** Fila com no máximo `limit` tarefas em voo. */
async function withConcurrency<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let cursor = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      await worker(items[index], index)
    }
  })
  await Promise.all(runners)
}

/**
 * Cliente HTTP com todos os limites acima. Uma instância por execução do
 * sync: ela guarda o intervalo entre requisições e o que já está em voo.
 */
export class MunicipalHttpClient {
  private readonly options: Required<Omit<MunicipalHttpOptions, 'log' | 'fetchImpl'>>
  private readonly log: HttpLogSink | undefined
  private readonly fetchImpl: typeof fetch
  private readonly lastRequestAt = new Map<string, number>()
  private readonly inFlight = new Map<string, Promise<unknown>>()

  constructor(options: MunicipalHttpOptions = {}) {
    this.options = {
      timeoutMs: options.timeoutMs ?? DEFAULTS.timeoutMs,
      retries: options.retries ?? DEFAULTS.retries,
      backoffMs: options.backoffMs ?? DEFAULTS.backoffMs,
      concurrency: options.concurrency ?? DEFAULTS.concurrency,
      minIntervalMs: options.minIntervalMs ?? DEFAULTS.minIntervalMs,
      userAgent: options.userAgent ?? DEFAULTS.userAgent,
    }
    this.log = options.log
    this.fetchImpl = options.fetchImpl ?? fetch
  }

  /** Roda `tasks` respeitando o limite de concorrência. */
  async run<T>(tasks: readonly (() => Promise<T>)[]): Promise<T[]> {
    const results: T[] = new Array(tasks.length)
    await withConcurrency(tasks, this.options.concurrency, async (task, index) => {
      results[index] = await task()
    })
    return results
  }

  /**
   * GET JSON com timeout, retry e backoff. Requisições simultâneas para a
   * mesma URL compartilham a mesma promise (deduplicação).
   */
  async getJson<T>(url: string, chamber: MunicipalChamberSource, operation: string): Promise<T> {
    const existing = this.inFlight.get(url)
    if (existing) return existing as Promise<T>

    const promise = this.fetchJson<T>(url, chamber, operation).finally(() => {
      this.inFlight.delete(url)
    })
    this.inFlight.set(url, promise)
    return promise
  }

  private async fetchJson<T>(
    url: string,
    chamber: MunicipalChamberSource,
    operation: string,
  ): Promise<T> {
    const startedAt = Date.now()
    let items = 0

    const host = safeHost(url)
    let lastError: unknown = null

    for (let attempt = 1; attempt <= this.options.retries; attempt++) {
      await this.waitTurn(host)

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), this.options.timeoutMs)
      try {
        const response = await this.fetchImpl(url, {
          headers: { accept: 'application/json', 'user-agent': this.options.userAgent },
          signal: controller.signal,
        })

        if (response.status === 429) {
          lastError = new MunicipalHttpError('rate limit (429)', 429, url)
          await sleep(this.backoffFor(attempt))
          continue
        }
        if (response.status >= 500) {
          lastError = new MunicipalHttpError(
            `a Câmara respondeu ${response.status}`,
            response.status,
            url,
          )
          await sleep(this.backoffFor(attempt))
          continue
        }
        if (!response.ok) {
          throw new MunicipalHttpError(
            `a Câmara respondeu ${response.status}`,
            response.status,
            url,
          )
        }

        const body = (await response.json()) as T
        items = countItems(body)
        this.log?.({
          source: chamber.sourceType,
          municipality: chamber.municipalityName,
          operation,
          success: true,
          durationMs: Date.now() - startedAt,
          items,
          ...(attempt > 1 ? { error: `ok na tentativa ${attempt}` } : {}),
        })
        return body
      } catch (error) {
        lastError = error
        const status = error instanceof MunicipalHttpError ? error.status : null
        // 4xx não é transitório: repetir não muda a resposta.
        if (status !== null && status < 500) break
        if (attempt < this.options.retries) await sleep(this.backoffFor(attempt))
      } finally {
        clearTimeout(timer)
      }
    }

    this.log?.({
      source: chamber.sourceType,
      municipality: chamber.municipalityName,
      operation,
      success: false,
      durationMs: Date.now() - startedAt,
      items: 0,
      error: describeError(lastError),
    })
    throw lastError instanceof Error
      ? lastError
      : new MunicipalHttpError('sem resposta', null, url)
  }

  private backoffFor(attempt: number): number {
    return this.options.backoffMs * 2 ** (attempt - 1)
  }

  /** Garante o intervalo mínimo entre requisições ao mesmo host. */
  private async waitTurn(host: string): Promise<void> {
    const previous = this.lastRequestAt.get(host) ?? 0
    const wait = this.options.minIntervalMs - (Date.now() - previous)
    if (wait > 0) await sleep(wait)
    this.lastRequestAt.set(host, Date.now())
  }
}

/**
 * `fetch` esconde o motivo real em `cause`: sem isto o log só mostra
 * "fetch failed", que não diz se foi DNS, TLS, socket ou reset.
 */
function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error)
  const cause = (error as { cause?: unknown }).cause
  const code =
    cause instanceof Error
      ? ((cause as { code?: string }).code ?? cause.message)
      : typeof cause === 'string'
        ? cause
        : undefined
  return code === undefined ? error.message : `${error.message}: ${code}`
}

function safeHost(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

/** Conta itens numa resposta paginada do SAPL ou numa lista simples. */
function countItems(body: unknown): number {
  if (Array.isArray(body)) return body.length
  if (body !== null && typeof body === 'object') {
    const results = (body as { results?: unknown }).results
    if (Array.isArray(results)) return results.length
  }
  return 1
}
