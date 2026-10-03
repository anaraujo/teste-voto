import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseCsv } from '../src/data-sources/tse/csv.ts'
import {
  parseDespesas,
  parseReceitas,
  topContributors,
} from '../src/data-sources/tse/finance.ts'

const RECEITAS_CSV = [
  '"SQ_CANDIDATO";"NM_DOADOR";"NM_DOADOR_RFB";"NR_CPF_CNPJ_DOADOR";"DS_FONTE_RECEITA";"DS_ORIGEM_RECEITA";"DS_ESPECIE_RECEITA";"DT_RECEITA";"VR_RECEITA"',
  '"160002542343";"Direção Nacional - PP";"PROGRESSISTAS - BRASIL - BR - NACIONAL";"00887169000105";"FUNDO ESPECIAL";"Recursos de partido político";"PIX";"17/09/2026";"20000,00"',
  '"160002542343";"#NULO";"#NULO#";"-1";"#NULO";"#NULO";"#NULO";"#NULO";"0,00"',
  '"160002999999";"João";"JOÃO DA SILVA";"123";"Recursos próprios";"Recursos próprios";"#NULO";"01/09/2026";"1.250,50"',
].join('\n')

const DESPESAS_CSV = [
  '"SQ_CANDIDATO";"NM_FORNECEDOR";"NM_FORNECEDOR_RFB";"NR_CPF_CNPJ_FORNECEDOR";"DS_ORIGEM_DESPESA";"DS_DESPESA";"DT_DESPESA";"VR_DESPESA_CONTRATADA"',
  '"160002542343";"FULIA";"FULIA - COMERCIO DE COMBUSTIVEIS LTDA";"111";"Publicidade por materiais impressos";"FOLDER";"02/09/2026";"1500,00"',
].join('\n')

test('parseReceitas normaliza doador, valor e data', () => {
  const parsed = parseCsv(Buffer.from(RECEITAS_CSV, 'latin1'))
  const rows = parseReceitas(parsed)

  assert.equal(rows.length, 3) // a linha com valor 0,00 entra; o doador vira null

  const primeira = rows[0]
  assert.equal(primeira.sqCandidato, '160002542343')
  assert.equal(primeira.doador, 'PROGRESSISTAS - BRASIL - BR - NACIONAL')
  assert.equal(primeira.doadorDocumento, '00887169000105')
  assert.equal(primeira.fonte, 'FUNDO ESPECIAL')
  assert.equal(primeira.data, '2026-09-17')
  assert.equal(primeira.valor, 20000)

  assert.equal(rows[1].doador, null)

  // milhar + vírgula decimal
  const joao = rows.find((r) => r.sqCandidato === '160002999999')
  assert.equal(joao?.doador, 'JOÃO DA SILVA')
  assert.equal(joao?.valor, 1250.5)
})

test('parseReceitas descarta valor ausente ou não numérico', () => {
  const csv = [
    '"SQ_CANDIDATO";"NM_DOADOR";"VR_RECEITA"',
    '"1";"Fulano";"#NULO"',
    '"2";"Ciclana";"abc"',
  ].join('\n')
  const rows = parseReceitas(parseCsv(Buffer.from(csv, 'latin1')))
  assert.equal(rows.length, 0)
})

test('parseDespesas normaliza fornecedor, valor e data', () => {
  const parsed = parseCsv(Buffer.from(DESPESAS_CSV, 'latin1'))
  const rows = parseDespesas(parsed)

  assert.equal(rows.length, 1)
  assert.equal(rows[0].sqCandidato, '160002542343')
  assert.equal(rows[0].fornecedor, 'FULIA - COMERCIO DE COMBUSTIVEIS LTDA')
  assert.equal(rows[0].fornecedorDocumento, '111')
  assert.equal(rows[0].data, '2026-09-02')
  assert.equal(rows[0].valor, 1500)
})

test('topContributors soma por nome e ordena decrescente', () => {
  const result = topContributors(
    [
      { nome: 'B', valor: 10 },
      { nome: 'A', valor: 100 },
      { nome: 'B', valor: 20 },
      { nome: null, valor: 999 }, // sem nome é ignorado
    ],
    2,
  )
  assert.deepEqual(result, [
    { nome: 'A', valor: 100 },
    { nome: 'B', valor: 30 },
  ])
})
