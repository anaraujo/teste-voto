import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mapComplementaryCsv } from '../src/data-sources/tse/complementar.ts'
import { parseCsv } from '../src/data-sources/tse/csv.ts'

const HEADERS = [
  'SQ_CANDIDATO;NM_MUNICIPIO_NASCIMENTO;ST_QUILOMBOLA;DS_ETNIA_INDIGENA',
  'ST_CANDIDATO_INSERIDO_URNA;ST_SUBSTITUIDO;ST_PREST_CONTAS;ST_DECLARAR_BENS;ST_REELEICAO;VR_DESPESA_MAX_CAMPANHA',
].join(';')

function csvOf(lines: string[]) {
  const text = [HEADERS, ...lines].join('\n')
  return parseCsv(Buffer.from(text, 'latin1'))
}

test('mapComplementaryCsv converte os campos do arquivo real', () => {
  const csv = csvOf([
    '1;CURITIBA;N;NÃO INFORMADA;SIM;N;S;S;#NE;3176572.53',
    '2;;S;KAIOWÁ;NÃO;S;N;#NE;S;0',
  ])

  const items = mapComplementaryCsv(csv)
  assert.equal(items.length, 2)

  const [first, second] = items
  assert.equal(first.tseSequence, '1')
  assert.equal(first.birthMunicipality, 'CURITIBA')
  assert.equal(first.quilombola, false)
  assert.equal(first.indigenousEthnicity, null)
  assert.equal(first.inBallot, true)
  assert.equal(first.substituted, false)
  assert.equal(first.accountsDeclared, true)
  assert.equal(first.assetsDeclared, true)
  assert.equal(first.isReelection, null)
  assert.equal(first.campaignSpendingCap, 3176572.53)

  assert.equal(second.birthMunicipality, null)
  assert.equal(second.quilombola, true)
  assert.equal(second.indigenousEthnicity, 'KAIOWÁ')
  assert.equal(second.inBallot, false)
  assert.equal(second.substituted, true)
  assert.equal(second.accountsDeclared, false)
  assert.equal(second.assetsDeclared, null)
  assert.equal(second.isReelection, true)
  assert.equal(second.campaignSpendingCap, 0)
})

test('mapComplementaryCsv ignora linhas sem SQ_CANDIDATO', () => {
  const csv = csvOf([';CURITIBA;N;;;;;;'])
  assert.equal(mapComplementaryCsv(csv).length, 0)
})

test('mapComplementaryCsv devolve nulos quando a coluna não existe', () => {
  const csv = parseCsv(Buffer.from('SQ_CANDIDATO;NM_UE\n1;CURITIBA\n', 'utf8'))
  const items = mapComplementaryCsv(csv)
  assert.equal(items.length, 1)
  assert.equal(items[0].birthMunicipality, null)
  assert.equal(items[0].campaignSpendingCap, null)
})