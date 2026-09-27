/**
 * Exporta a ficha comparável completa (TSE + Câmara + Senado + votações-chave
 * + editorial) em CSV (; com BOM) e JSON, em data/ficha/.
 *
 * Execução: node --experimental-sqlite --experimental-strip-types
 *   scripts/export-ficha.ts
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { openRepository, listCandidates, listIncumbents, listParliamentary } from '../src/data-sources/repository.ts'
import { defaultDataDir } from '../src/data-sources/tse/candidates.ts'
import { readEditorialFicha } from '../src/data-sources/parliament/editorial.ts'
import { emptyFichaParaCsv, type FichaExportada } from '../src/data-sources/parliament/export.ts'
import { CURRENT_ELECTION, electionKey } from '../src/shared/elections.ts'

const DATA_DIR = defaultDataDir()
const OUT_DIR = join(DATA_DIR, 'ficha')
const filter = {
  electionYear: CURRENT_ELECTION.year,
  state: CURRENT_ELECTION.state,
  office: CURRENT_ELECTION.office,
}

const db = await openRepository(join(DATA_DIR, 'tse.db'))

try {
  const candidates = listCandidates(db, filter)
  const incumbents = listIncumbents(db)
  const parliament = listParliamentary(db)

  const fichas: FichaExportada[] = []
  for (const candidate of candidates) {
    const editorial = await readEditorialFicha(candidate.id)
    fichas.push(
      emptyFichaParaCsv(
        candidate,
        incumbents.get(candidate.id),
        parliament.get(candidate.id),
        editorial,
      ),
    )
  }

  await mkdir(OUT_DIR, { recursive: true })
  const name = `ficha-${electionKey(CURRENT_ELECTION).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  await writeFile(
    join(OUT_DIR, `${name}.csv`),
    toCsv(fichas),
    'utf8',
  )
  await writeFile(
    join(OUT_DIR, `${name}.json`),
    `${JSON.stringify(
      { election: electionKey(CURRENT_ELECTION), generatedAt: new Date().toISOString(), count: fichas.length, candidates: fichas },
      null,
      2,
    )}\n`,
    'utf8',
  )
  console.log(`[ficha] exportados ${fichas.length} candidatos em data/ficha/${name}.csv e .json`)
} finally {
  db.close()
}

/** Escapa um valor para célula CSV (separador ;). */
function escapeCsv(value: string | number | null): string {
  if (value === null || value === undefined) return ''
  const text = String(value)
  return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function toCsv(rows: readonly FichaExportada[]): string {
  const headers: Array<keyof FichaExportada> = [
    'id',
    'nome_urna',
    'nome_completo',
    'numero',
    'partido_sigla',
    'partido_nome',
    'situacao',
    'ocupacao',
    'escolaridade',
    'natural_de',
    'sexo',
    'cor_raca',
    'quilombola',
    'etnia_indigena',
    'bens_declarados_reais',
    'teto_gastos_reais',
    'redes_sociais',
    'tem_historico_parlamentar',
    'deputado_atual',
    'camara_legislaturas',
    'camara_proposicoes_total',
    'camara_proposicoes_por_ano',
    'camara_comissoes',
    'camara_despesas_total_reais',
    'camara_despesas_por_ano',
    'senado_legislaturas',
    'voto_reforma-tributaria',
    'voto_marco-temporal',
    'voto_plataformas',
    'posicao_principais-propostas',
    'posicao_principais-propostas_evidencia',
    'posicao_saude',
    'posicao_saude_evidencia',
    'posicao_educacao',
    'posicao_educacao_evidencia',
    'posicao_seguranca',
    'posicao_seguranca_evidencia',
    'posicao_economia',
    'posicao_economia_evidencia',
    'posicao_meio-ambiente',
    'posicao_meio-ambiente_evidencia',
    'posicao_trabalho',
    'posicao_trabalho_evidencia',
    'posicao_ciencia-tecnologia',
    'posicao_ciencia-tecnologia_evidencia',
    'posicao_cultura',
    'posicao_cultura_evidencia',
    'posicao_posicionamentos',
    'posicao_posicionamentos_evidencia',
  ]

  const lines = [headers.map(escapeCsv).join(';')]
  for (const row of rows) {
    lines.push(headers.map((header) => escapeCsv(row[header] as never)).join(';'))
  }
  return `\uFEFF${lines.join('\n')}\n`
}