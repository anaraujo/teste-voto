/**
 * Baixa os CSVs anuais da Câmara (2019–2026) e grava só o plenário em
 * plenary_votacoes, plenary_orientations, plenary_votes e plenary_proposicoes.
 *
 * Os arquivos crus ficam em data/camara/ e não vão para o bucket.
 *
 * Execução: node --experimental-sqlite --experimental-strip-types
 *   scripts/sync-votacoes.ts
 */

import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { normalizeVoto, votoToSide } from '../src/data-sources/camara/voto.ts'
import { beginPlenaryReplace } from '../src/data-sources/repository.ts'
import { openRepository } from '../src/data-sources/repository.ts'
import {
  detectSeparator,
  parseCsvTable,
  readCell,
  buildHeaderIndex,
} from '../src/data-sources/tse/csv.ts'
import { downloadToFile } from '../src/data-sources/tse/download.ts'
import { defaultDataDir } from '../src/data-sources/tse/candidates.ts'

const YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026] as const

function fileUrl(dataset: string, fileName: string): string {
  return `https://dadosabertos.camara.leg.br/arquivos/${dataset}/csv/${fileName}`
}

function sourceUrl(votacaoId: string): string {
  return `https://dadosabertos.camara.leg.br/api/v2/votacoes/${votacaoId}`
}

async function readTable(filePath: string) {
  const buffer = await readFile(filePath)
  const content = buffer.toString('utf8').replace(/^\uFEFF/, '')
  const separator = detectSeparator(content)
  const table = parseCsvTable(content, separator)
  return { index: buildHeaderIndex(table.headers), rows: table.rows }
}

function splitLine(line: string, separator: string): string[] {
  const fields: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === separator) {
      fields.push(field)
      field = ''
    } else {
      field += ch
    }
  }
  fields.push(field)
  return fields
}

function integer(value: string): number {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : 0
}

const DATA_DIR = defaultDataDir()
const CAMARA_DIR = join(DATA_DIR, 'camara')
const db = await openRepository(join(DATA_DIR, 'tse.db'))
const writer = beginPlenaryReplace(db)
const plenaryIds = new Set<string>()

try {
  for (const year of YEARS) {
    const votacoesName = `votacoes-${year}.csv`
    const votacoesPath = join(CAMARA_DIR, votacoesName)
    const downloaded = await downloadToFile(
      fileUrl('votacoes', votacoesName),
      votacoesPath,
    )
    console.log(
      `[votacoes] ${year}: ${downloaded.downloaded ? 'baixado' : 'já estava em disco'} (${downloaded.bytes} bytes)`,
    )
    const table = await readTable(votacoesPath)
    let kept = 0
    for (const row of table.rows) {
      if (readCell(table.index, row, 'siglaOrgao') !== 'PLEN') continue
      const id = readCell(table.index, row, 'id')
      const data = readCell(table.index, row, 'data')
      if (!id || !data) continue
      writer.votacao({
        id,
        data,
        descricao: readCell(table.index, row, 'descricao'),
        votosSim: integer(readCell(table.index, row, 'votosSim')),
        votosNao: integer(readCell(table.index, row, 'votosNao')),
        votosOutros: integer(readCell(table.index, row, 'votosOutros')),
        sourceUrl: sourceUrl(id),
      })
      plenaryIds.add(id)
      kept++
    }
    console.log(`[votacoes] ${year}: ${kept} votações de plenário`)
  }

  for (const year of YEARS) {
    const name = `votacoesOrientacoes-${year}.csv`
    const filePath = join(CAMARA_DIR, name)
    await downloadToFile(fileUrl('votacoesOrientacoes', name), filePath)
    const table = await readTable(filePath)
    let kept = 0
    for (const row of table.rows) {
      const votacaoId = readCell(table.index, row, 'idVotacao')
      if (!plenaryIds.has(votacaoId)) continue
      if (readCell(table.index, row, 'siglaOrgao') !== 'PLEN') continue
      const sigla = readCell(table.index, row, 'siglaBancada')
      const orientacao = readCell(table.index, row, 'orientacao')
      if (!sigla) continue
      writer.orientation({
        votacaoId,
        sigla,
        orientacao,
        stance: votoToSide(normalizeVoto(orientacao)),
      })
      kept++
    }
    console.log(`[orientacoes] ${year}: ${kept} bancadas de plenário`)
  }

  for (const year of YEARS) {
    const name = `votacoesProposicoes-${year}.csv`
    const filePath = join(CAMARA_DIR, name)
    await downloadToFile(fileUrl('votacoesProposicoes', name), filePath)
    const table = await readTable(filePath)
    let kept = 0
    for (const row of table.rows) {
      const votacaoId = readCell(table.index, row, 'idVotacao')
      const proposicaoId = readCell(table.index, row, 'proposicao_id')
      if (!plenaryIds.has(votacaoId) || !proposicaoId) continue
      writer.proposicao({
        votacaoId,
        proposicaoId,
        siglaTipo: readCell(table.index, row, 'proposicao_siglaTipo') || null,
        numero: readCell(table.index, row, 'proposicao_numero') || null,
        ano: readCell(table.index, row, 'proposicao_ano') || null,
        titulo: readCell(table.index, row, 'proposicao_titulo') || null,
        ementa: readCell(table.index, row, 'proposicao_ementa') || null,
      })
      kept++
    }
    console.log(`[proposicoes] ${year}: ${kept} proposições de plenário`)
  }

  for (const year of YEARS) {
    const name = `votacoesVotos-${year}.csv`
    const filePath = join(CAMARA_DIR, name)
    await downloadToFile(fileUrl('votacoesVotos', name), filePath)
    const stream = createReadStream(filePath, { encoding: 'utf8' })
    const lines = createInterface({ input: stream, crlfDelay: Infinity })
    let header: Map<string, number> | null = null
    let separator = ';'
    let kept = 0
    for await (const line of lines) {
      if (!header) {
        const content = line.replace(/^\uFEFF/, '')
        separator = detectSeparator(content)
        header = buildHeaderIndex(splitLine(content, separator))
        continue
      }
      if (line === '') continue
      const cells = splitLine(line, separator)
      const votacaoId = readCell(header, cells, 'idVotacao')
      if (!plenaryIds.has(votacaoId)) continue
      const voto = normalizeVoto(readCell(header, cells, 'voto'))
      if (!voto) continue
      const camaraId = integer(readCell(header, cells, 'deputado_id'))
      if (!camaraId) continue
      writer.vote({
        votacaoId,
        camaraId,
        voto,
        partido: readCell(header, cells, 'deputado_siglaPartido') || null,
      })
      kept++
    }
    console.log(`[votos] ${year}: ${kept} votos nominais de plenário`)
  }

  writer.commit()
  console.log(`[plenário] ${plenaryIds.size} votações gravadas`)
} catch (error) {
  writer.rollback()
  throw error
} finally {
  db.close()
}
