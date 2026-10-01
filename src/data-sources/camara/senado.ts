/**
 * Consultas à API de Dados Abertos do Senado Federal para a ficha comparável:
 * identificação de ex-senadores entre os candidatos (para registrarmos o
 * histórico de mandato na Casa).
 *
 * O Senado não expõe votações de Plenário por API pública confiável; fica
 * registrado apenas o histórico de mandatos (legislaturas, UF, partido).
 */

export interface SenadorMandato {
  legislatura: number
  uf: string
  dataInicio: string
  dataFim: string
}

export interface SenadorLista {
  codigo: number
  nome: string
  nomeCompleto: string
  partido: string
  mandatos: SenadorMandato[]
}

const BASE = 'https://legis.senado.leg.br/dadosabertos'

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

/** Pequeno extrator de texto entre tags (para o XML dos web services). */
function textOf(xml: string, tag: string): string {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`).exec(xml)
  if (!match) return ''
  return match[1]
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

/** Retorna os blocos <Tag>...</Tag> de uma string. */
function blocksOf(xml: string, tag: string): string[] {
  const parts: string[] = []
  const regex = new RegExp(`<${tag}[^>]*>[\\s\\S]*?</${tag}>`, 'g')
  for (const match of xml.matchAll(regex)) {
    parts.push(match[0])
  }
  return parts
}

async function getXml(url: string, retries = 3): Promise<string> {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { accept: 'application/xml' },
      })
      if (response.status === 429) {
        await sleep(2000 * attempt)
        continue
      }
      if (!response.ok)
        throw new Error(`Senado respondeu ${response.status} para ${url}`)
      return await response.text()
    } catch (error) {
      if (attempt === retries) throw error
      await sleep(300 * attempt)
    }
  }
  throw new Error(`sem resposta de ${url}`)
}

export function parseParlamentar(raw: string, partido?: string): SenadorLista {
  const codigo = Number(textOf(raw, 'CodigoParlamentar') || NaN)
  const nome = textOf(raw, 'NomeParlamentar')
  const nomeCompleto = textOf(raw, 'NomeCompletoParlamentar') || nome
  const siglaPartido = partido ?? textOf(raw, 'SiglaPartidoParlamentar')

  const mandatos: SenadorMandato[] = []
  for (const mandato of blocksOf(raw, 'Mandato')) {
    const uf = textOf(mandato, 'UfParlamentar')
    for (const tag of [
      'PrimeiraLegislaturaDoMandato',
      'SegundaLegislaturaDoMandato',
    ]) {
      for (const leg of blocksOf(mandato, tag)) {
        const legislatura = Number(textOf(leg, 'NumeroLegislatura'))
        if (!Number.isNaN(legislatura)) {
          mandatos.push({
            legislatura,
            uf,
            dataInicio: textOf(leg, 'DataInicio'),
            dataFim: textOf(leg, 'DataFim'),
          })
        }
      }
    }
  }

  return { codigo, nome, nomeCompleto, partido: siglaPartido, mandatos }
}

/** Senadores de uma legislatura (55, 56, 57). */
export async function fetchSenadoresPorLegislatura(
  legislatura: number,
): Promise<SenadorLista[]> {
  const xml = await getXml(`${BASE}/senador/lista/legislatura/${legislatura}`)
  const result: SenadorLista[] = []
  for (const parlamentar of blocksOf(xml, 'Parlamentar')) {
    const parsed = parseParlamentar(parlamentar)
    if (!Number.isNaN(parsed.codigo)) result.push(parsed)
  }
  return result
}
