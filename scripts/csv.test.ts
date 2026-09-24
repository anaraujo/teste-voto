import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildHeaderIndex,
  detectEncoding,
  detectSeparator,
  parseCsv,
  parseCsvTable,
  readCell,
} from '../src/data-sources/tse/csv.ts'

test('detecta separador pela primeira linha', () => {
  assert.equal(detectSeparator('A;B;C\n1;2;3'), ';')
  assert.equal(detectSeparator('A,B,C\n1,2,3'), ',')
  assert.equal(detectSeparator('A\tB\tC\n1\t2\t3'), '\t')
})

test('detecta encoding latin1 vs utf8 (BOM)', () => {
  assert.equal(detectEncoding(Buffer.from('a;b\n1;2', 'latin1')), 'latin1')
  assert.equal(detectEncoding(Buffer.from([0xef, 0xbb, 0xbf, 0x61])), 'utf8')
})

test('parseia bloco com aspas, separador interno e CRLF', () => {
  const content = 'A;B;C\r\n"x;y";"com ""aspas""";z\r\n1;2;3'
  const { headers, rows } = parseCsvTable(content, ';')
  assert.deepEqual(headers, ['A', 'B', 'C'])
  assert.deepEqual(rows, [
    ['x;y', 'com "aspas"', 'z'],
    ['1', '2', '3'],
  ])
})

test('parseCsv lê latin1 e remove BOM utf8', () => {
  const latin = parseCsv(Buffer.from('Nome;UF\nJosé;PR\n', 'latin1'))
  assert.equal(latin.encoding, 'latin1')
  assert.equal(latin.separator, ';')
  assert.deepEqual(latin.headers, ['Nome', 'UF'])
  assert.deepEqual(latin.rows, [['José', 'PR']])

  const utf8 = parseCsv(
    Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('N;N2\n3;4\n', 'utf8')]),
  )
  assert.equal(utf8.encoding, 'utf8')
  assert.equal(utf8.headers[0], 'N')
  assert.deepEqual(utf8.rows, [['3', '4']])
})

test('readCell respeita maiúsculas e espaços nos nomes', () => {
  const index = buildHeaderIndex(['NM_URNA_CANDIDATO', ' nm_candidato '])
  const row = ['Nome de Urna', 'Nome Completo']
  assert.equal(readCell(index, row, 'nm_urna_candidato'), 'Nome de Urna')
  assert.equal(readCell(index, row, 'NM_CANDIDATO'), 'Nome Completo')
})

test('parseCsvTable descarta record vazio ao final do arquivo', () => {
  const { rows } = parseCsvTable('A;B\n1;2\n', ';')
  assert.equal(rows.length, 1)
})