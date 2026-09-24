/**
 * Leitor de CSV mínimo, sem dependências externas.
 *
 * Decodifica o conteúdo como latin1 (ISO-8859-1), encoding padrão dos
 * dados abertos do TSE, a menos que haja BOM UTF-8. Detecta o separador
 * (; ou , ou tabulação) pela primeira linha não vazia e trata campos
 * entre aspas, incluindo aspas duplicadas e quebras de linha internas.
 */

export type CsvEncoding = 'latin1' | 'utf8'

export interface ParsedCsv {
  /** Nome das colunas (primeira linha). */
  headers: string[]
  /** Linhas de dados, sem a linha de cabeçalho. */
  rows: string[][]
  /** Separador detectado. */
  separator: string
  encoding: CsvEncoding
}

const SEPARATOR_CANDIDATES = [';', ',', '\t'] as const

export function detectEncoding(buffer: Buffer): CsvEncoding {
  // BOM UTF-8: EF BB BF
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return 'utf8'
  }
  return 'latin1'
}

export function detectSeparator(content: string): string {
  const firstLine = content.split(/\r?\n/, 1)[0] ?? ''
  let best: string = ';'
  let bestCount = -1
  for (const candidate of SEPARATOR_CANDIDATES) {
    let count = 0
    for (let i = 0; i < firstLine.length; i++) {
      if (firstLine[i] === candidate) count++
    }
    if (count > bestCount) {
      best = candidate
      bestCount = count
    }
  }
  return best
}

/**
 * Tokeniza o conteúdo em registros, respeitando aspas e quebras de linha
 * de várias terminações (\n, \r\n, \r).
 */
export function parseCsvTable(content: string, separator: string): { headers: string[]; rows: string[][] } {
  const records: string[][] = []
  let field = ''
  let record: string[] = []
  let inQuotes = false
  let hasContent = false

  const pushField = () => {
    record.push(field)
    field = ''
  }
  const pushRecord = () => {
    pushField()
    records.push(record)
    record = []
    hasContent = false
  }

  for (let i = 0; i < content.length; i++) {
    const ch = content[i]

    if (inQuotes) {
      if (ch === '"') {
        if (content[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
        hasContent = true
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
      hasContent = true
    } else if (ch === separator) {
      pushField()
    } else if (ch === '\n') {
      pushRecord()
    } else if (ch === '\r') {
      if (content[i + 1] === '\n') i++
      pushRecord()
    } else {
      field += ch
      hasContent = true
    }
  }

  if (hasContent || record.length > 0 || field !== '') {
    pushField()
    records.push(record)
  }

  if (records.length === 0) return { headers: [], rows: [] }

  const headers = records[0]
  return { headers, rows: records.slice(1) }
}

/**
 * Converte um Buffer (arquivo TSE) em um CSV estruturado.
 * Detecta encoding e separador antes de parsear.
 */
export function parseCsv(buffer: Buffer): ParsedCsv {
  const encoding = detectEncoding(buffer)
  const content =
    encoding === 'utf8' && buffer.length >= 3
      ? buffer.subarray(3).toString('utf8')
      : buffer.toString('latin1')

  const separator = detectSeparator(content)
  const { headers, rows } = parseCsvTable(content, separator)

  return { headers, rows, separator, encoding }
}

/**
 * Índice de colunas por nome (cioso a maiúsculas/minúsculas e espaços).
 */
export function buildHeaderIndex(headers: readonly string[]): Map<string, number> {
  const index = new Map<string, number>()
  headers.forEach((header, i) => {
    index.set(normalizeHeader(header), i)
  })
  return index
}

export function normalizeHeader(header: string): string {
  return header.trim().toUpperCase()
}

/** Lê uma célula pelo nome da coluna. Retorna '' quando ausente. */
export function readCell(
  index: Map<string, number>,
  row: readonly string[],
  header: string,
): string {
  const position = index.get(normalizeHeader(header))
  if (position === undefined) return ''
  return (row[position] ?? '').trim()
}