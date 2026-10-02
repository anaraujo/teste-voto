/**
 * Histórico de posições políticas ocupadas (eleitos + suplentes), derivado
 * dos dados abertos do TSE (consultas de candidatos de cada eleição).
 *
 * Cobre eleições municipais e nacionais de 2004 em diante para o Paraná,
 * todas as posições: vereador, prefeito, vice-prefeito, deputado estadual,
 * deputado federal, senador, 1º/2º suplente de senador, governador e
 * vice-governador.
 *
 * Não usamos a eleição corrente (2026): aqui cabe o histórico anterior.
 *
 * A consulta_do_ano é baixada do CDN do TSE (um ZIP nacional com arquivos
 * por UF), extraída no arquivo "consulta_cand_<ano>_PR", decodificada em
 * latin1 e casada por nome normalizado + data de nascimento com os
 * candidatos de 2026. Anos indisponíveis ou sem o arquivo do PR são
 * ignorados com aviso (sincronização tolerante).
 */

import { createWriteStream } from 'node:fs'
import { mkdir, readFile, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { CandidateRecord } from '../../shared/domain.ts'
import { normalizeName } from '../camara/identity.ts'
import { buildHeaderIndex, parseCsv, readCell } from './csv.ts'
import { extractZip, findEntry, listZipEntries } from './download.ts'

export type HistoricElectionType = 'municipal' | 'nacional'

export interface HistoricElection {
  ano: number
  tipo: HistoricElectionType
}

/** Eleições anteriores à atual (2004 em diante), em ordem cronológica. */
export const HISTORIC_ELECTIONS: readonly HistoricElection[] = [
  { ano: 2004, tipo: 'municipal' },
  { ano: 2006, tipo: 'nacional' },
  { ano: 2008, tipo: 'municipal' },
  { ano: 2010, tipo: 'nacional' },
  { ano: 2012, tipo: 'municipal' },
  { ano: 2014, tipo: 'nacional' },
  { ano: 2016, tipo: 'municipal' },
  { ano: 2018, tipo: 'nacional' },
  { ano: 2020, tipo: 'municipal' },
  { ano: 2022, tipo: 'nacional' },
  { ano: 2024, tipo: 'municipal' },
]

export interface HistoricCandidacyRow {
  ano: number
  nome: string
  dataNascimento: string | null
  cargo: string | null
  uf: string | null
  municipio: string | null
  partidoSigla: string | null
  partidoNome: string | null
  numero: string | null
  resultado: string | null
  turno: number
  sqCandidato: string | null
}

export type MandateStatus = 'eleito' | 'suplente'

export interface PoliticalMandate {
  candidateId: string
  ano: number
  cargo: string
  uf: string | null
  municipio: string | null
  partidoSigla: string | null
  status: MandateStatus
  turno: number
  sqCandidato: string | null
}

/** Nomes de coluna possíveis em cada arquivo (que variam entre anos). */
const HEADER_ALIASES: Record<string, string[]> = {
  nome: ['NM_CANDIDATO', 'NOME_CANDIDATO', 'NOME'],
  nascimento: ['DT_NASCIMENTO', 'DATA_NASCIMENTO', 'DT_NASCIMENTO_CANDIDATO'],
  cargo: ['DS_CARGO', 'DESCRICAO_CARGO', 'CARGO'],
  uf: ['SG_UF', 'SIGLA_UF', 'UF'],
  municipio: ['NM_UE', 'DS_MUNICIPIO', 'MUNICIPIO'],
  partido: ['SG_PARTIDO', 'SIGLA_PARTIDO'],
  partidoNome: ['NM_PARTIDO', 'PARTIDO'],
  resultado: [
    'DS_SIT_TOT_TURNO',
    'DES_SIT_TOT_TURNO',
    'DS_SIT_TOT',
    'DES_SITUACAO_CANDIDATURA',
    'DS_SITUACAO_CANDIDATURA',
    'DS_SITUACAO',
    'SITUACAO',
  ],
  turno: ['NR_TURNO', 'TURNO'],
  numero: ['NR_CANDIDATO', 'NUMERO_CANDIDATO', 'NR_CAND'],
  sq: ['SQ_CANDIDATO', 'SQ_CAND'],
}

export function consultaCandUrl(ano: number): string {
  return `https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_${ano}.zip`
}

function readAlias(
  index: Map<string, number>,
  row: readonly string[],
  aliases: readonly string[],
): string {
  for (const alias of aliases) {
    const value = readCell(index, row, alias)
    if (value !== '') return value
  }
  return ''
}

/** Baixa o ZIP do ano para disco usando stream (arquivos podem ser grandes). */
export async function downloadZip(
  url: string,
  filePath: string,
): Promise<void> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(
      `download falhou (${response.status} ${response.statusText}): ${url}`,
    )
  }
  const reader = response.body?.getReader()
  if (!reader) throw new Error(`resposta sem corpo: ${url}`)
  await mkdir(dirname(filePath), { recursive: true })
  await new Promise((resolve, reject) => {
    const write = createWriteStream(filePath)
    write.on('error', reject)
    write.on('finish', () => resolve(undefined))
    ;(async () => {
      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          write.write(Buffer.from(value))
        }
        write.end()
      } catch (error) {
        write.destroy(error as Error)
      }
    })()
  })
}

/**
 * Baixa (com cache) e lê o CSV das candidaturas do PR de um ano.
 * Anos sem download ou sem o arquivo do PR são ignorados com aviso.
 */
export async function fetchHistoricCandidaturas(
  ano: number,
  dataDir: string,
): Promise<{ rows: HistoricCandidacyRow[]; erro?: string }> {
  const zipPath = join(dataDir, 'download', `consulta_cand_${ano}.zip`)
  try {
    if (!(await fileExists(zipPath))) {
      await downloadZip(consultaCandUrl(ano), zipPath)
    }
  } catch (error) {
    return {
      rows: [],
      erro: `download (${error instanceof Error ? error.message : String(error)})`,
    }
  }

  const entries = listZipEntries(zipPath)
  const entry = findEntry(entries, `consulta_cand_${ano}_PR`)
  if (!entry) {
    return {
      rows: [],
      erro: `arquivo do PR ausente no ZIP (entradas: ${entries
        .map((e) => e.name)
        .slice(0, 8)
        .join(', ')}...)`,
    }
  }

  const extractDir = join(dataDir, 'download', 'extracted', `history-${ano}`)
  await extractZip(zipPath, extractDir)
  const csvPath = join(extractDir, entry.name)
  const buffer = await readFile(csvPath)
  const parsed = parseCsv(buffer)
  const index = buildHeaderIndex(parsed.headers)

  const hasNome = HEADER_ALIASES.nome.some((alias) => index.has(alias))
  if (!hasNome) {
    return { rows: [], erro: 'coluna de nome não encontrada' }
  }

  const rows: HistoricCandidacyRow[] = []
  for (const row of parsed.rows) {
    const nome = readAlias(index, row, HEADER_ALIASES.nome)
    if (nome === '') continue
    const uf = readAlias(index, row, HEADER_ALIASES.uf)
    if (uf && uf.toUpperCase() !== 'PR') continue

    const nascimento = readAlias(index, row, HEADER_ALIASES.nascimento) || null
    const turno = Number(readAlias(index, row, HEADER_ALIASES.turno)) || 0
    rows.push({
      ano,
      nome,
      dataNascimento: toIsoDate(nascimento),
      cargo: readAlias(index, row, HEADER_ALIASES.cargo) || null,
      uf: uf || null,
      municipio: readAlias(index, row, HEADER_ALIASES.municipio) || null,
      partidoSigla: readAlias(index, row, HEADER_ALIASES.partido) || null,
      partidoNome: readAlias(index, row, HEADER_ALIASES.partidoNome) || null,
      numero: readAlias(index, row, HEADER_ALIASES.numero) || null,
      resultado: readAlias(index, row, HEADER_ALIASES.resultado) || null,
      turno,
      sqCandidato: readAlias(index, row, HEADER_ALIASES.sq) || null,
    })
  }

  return { rows }
}

/** Normaliza o resultado para comparação (sem acentos, maiúsculas). */
export function normalizeResultado(resultado: string): string {
  return resultado
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

/**
 * Converte a data de nascimento do TSE (DD/MM/AAAA ou AAAA-MM-DD) para
 * AAAA-MM-DD, para comparação com os candidatos de 2026. Retorna null em
 * datas inválidas ou ausentes.
 */
export function toIsoDate(value: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (
    !trimmed ||
    trimmed === '0000-00-00' ||
    trimmed === '#NULO' ||
    trimmed === '#NE'
  ) {
    return null
  }
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed)
  if (slash) {
    const [, day, month, year] = slash
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed)
  if (iso) {
    const [, year, month, day] = iso
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }
  return null
}

/**
 * Classifica o resultado de uma candidatura em mandato exercido (eleito) ou
 * suplente. "NÃO ELEITO", renúncias etc. retornam null (não são mandato).
 */
export function classifyMandateResult(
  resultado: string | null,
): MandateStatus | null {
  if (!resultado) return null
  const value = normalizeResultado(resultado)
  if (/NAO ELEITO|NAO ELEIT|RENUNCI/.test(value)) return null
  if (value.includes('SUPLENTE')) return 'suplente'
  if (/ELEITO/.test(value)) return 'eleito'
  return null
}

/**
 * Casa candidaturas históricas com os candidatos de 2026 e devolve os
 * mandatos eleitos/suplentes. A correspondência usa o nome normalizado +
 * data de nascimento: quando a data consta nos dois lados ela precisa ser
 * a mesma; quando falta no histórico, exige o nome completo idêntico.
 */
export function matchHistoricToCandidates(
  rows: readonly HistoricCandidacyRow[],
  candidates: readonly CandidateRecord[],
): PoliticalMandate[] {
  const byFullName = new Map<string, CandidateRecord[]>()
  const byBallotName = new Map<string, CandidateRecord[]>()
  for (const candidate of candidates) {
    const full = normalizeName(candidate.fullName)
    const ballot = normalizeName(candidate.ballotName)
    pushToIndex(byFullName, full, candidate)
    pushToIndex(byBallotName, ballot, candidate)
  }

  const mandates: PoliticalMandate[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    const status = classifyMandateResult(row.resultado)
    if (status === null) continue
    if (row.cargo === null) continue

    const name = normalizeName(row.nome)
    const possible = unique(
      (byFullName.get(name) ?? []).concat(byBallotName.get(name) ?? []),
    )
    const candidate = possible.find((item) => matchesCandidate(item, row, name))
    if (!candidate) continue

    const key = `${candidate.id}|${row.ano}|${row.cargo}|${row.turno}|${status}`
    if (seen.has(key)) continue
    seen.add(key)

    mandates.push({
      candidateId: candidate.id,
      ano: row.ano,
      cargo: row.cargo,
      uf: row.uf,
      municipio: row.municipio,
      partidoSigla: row.partidoSigla,
      status,
      turno: row.turno,
      sqCandidato: row.sqCandidato,
    })
  }
  return mandates
}

function pushToIndex(
  index: Map<string, CandidateRecord[]>,
  key: string,
  value: CandidateRecord,
): void {
  if (key === '') return
  const list = index.get(key)
  if (list) {
    list.push(value)
  } else {
    index.set(key, [value])
  }
}

function unique(candidates: CandidateRecord[]): CandidateRecord[] {
  const seen = new Set<string>()
  const result: CandidateRecord[] = []
  for (const candidate of candidates) {
    if (seen.has(candidate.id)) continue
    seen.add(candidate.id)
    result.push(candidate)
  }
  return result
}

function matchesCandidate(
  candidate: CandidateRecord,
  row: HistoricCandidacyRow,
  normalizedName: string,
): boolean {
  const candidateBirth = toIsoDate(candidate.birthDate)
  const rowBirth = toIsoDate(row.dataNascimento)
  if (rowBirth && candidateBirth) {
    if (rowBirth !== candidateBirth) return false
    // data de nascimento igual basta quando o nome bate (full ou urna).
    return (
      normalizedName === normalizeName(candidate.fullName) ||
      normalizedName === normalizeName(candidate.ballotName)
    )
  }
  if (rowBirth && !candidateBirth) {
    return normalizedName === normalizeName(candidate.fullName)
  }
  // Sem data no histórico: exige o nome completo idêntico (evita falso-positivo).
  return normalizedName === normalizeName(candidate.fullName)
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const meta = await stat(filePath)
    return meta.isFile() && meta.size > 0
  } catch {
    return false
  }
}

/** Rótulo legível do cargo (para exibição/export). */
export function formatCargoLabel(cargo: string): string {
  const lower = cargo.toLowerCase()
  const map: Record<string, string> = {
    vereador: 'Vereador',
    prefeito: 'Prefeito',
    'vice-prefeito': 'Vice-prefeito',
    'deputado estadual': 'Deputado estadual',
    'deputado distrital': 'Deputado distrital',
    'deputado federal': 'Deputado federal',
    senador: 'Senador',
    governador: 'Governador',
    'vice-governador': 'Vice-governador',
    '1º suplente de senador': '1º suplente de senador',
    '2º suplente de senador': '2º suplente de senador',
  }
  return map[lower] ?? lower
}

/** Resumo textual de um mandato para o export ("2008 Vereador ... eleito"). */
export function formatMandateSummary(mandate: PoliticalMandate): string {
  const cargo = formatCargoLabel(mandate.cargo)
  const lugar = mandate.municipio
    ? `${mandate.municipio}/${mandate.uf ?? ''}`
    : (mandate.uf ?? '')
  const partido = mandate.partidoSigla ? ` (${mandate.partidoSigla})` : ''
  const sufixo = mandate.status === 'eleito' ? 'eleito' : 'suplente'
  return `${mandate.ano} ${cargo}${lugar ? ` em ${lugar}` : ''}${partido} · ${sufixo}`
}

/** Ordena mandatos de um candidato por ano e cargo. */
export function sortMandates(
  mandates: readonly PoliticalMandate[],
): PoliticalMandate[] {
  return [...mandates].sort(
    (a, b) => a.ano - b.ano || a.cargo.localeCompare(b.cargo),
  )
}
