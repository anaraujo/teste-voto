import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  FEDERATION_UNITS,
  OFFICE_DISTRITAL,
  OFFICE_ESTADUAL,
  electionFor,
  electionKey,
  officeFor,
} from '../src/shared/elections.ts'
import { filterForState } from '../src/data-sources/apiPayload.ts'

test('electionFor monta os arquivos da UF e rejeita sigla inválida', () => {
  const pr = electionFor('pr')
  assert.equal(pr.state, 'PR')
  assert.equal(pr.year, 2026)
  assert.equal(pr.office, 'DEPUTADO FEDERAL')
  assert.equal(pr.datasets.candidates.sourceFileMatch, 'consulta_cand_2026_PR')
  assert.equal(pr.datasets.assets.sourceFileMatch, 'bem_candidato_2026_PR')
  assert.equal(
    pr.datasets.photos.url.endsWith('/foto_cand2026_PR_div.zip'),
    true,
  )
  assert.equal(electionKey(pr), '2026:PR:DEPUTADO FEDERAL')

  const sp = electionFor('SP')
  assert.equal(sp.datasets.candidates.url, pr.datasets.candidates.url)
  assert.equal(sp.datasets.candidates.sourceFileMatch, 'consulta_cand_2026_SP')
  assert.notEqual(sp.datasets.photos.url, pr.datasets.photos.url)

  assert.equal(FEDERATION_UNITS.length, 27)
  assert.throws(() => electionFor('XX'), /UF desconhecida/)
})

test('officeFor mapeia a família de cargo e trata o DF como distrital', () => {
  assert.equal(officeFor('PR', 'federal'), 'DEPUTADO FEDERAL')
  assert.equal(officeFor('pr', 'estadual'), OFFICE_ESTADUAL)
  assert.equal(officeFor('SP', 'estadual'), OFFICE_ESTADUAL)
  assert.equal(officeFor('DF', 'estadual'), OFFICE_DISTRITAL)
  assert.equal(officeFor('df', 'federal'), 'DEPUTADO FEDERAL')
})

test('electionFor aceita o cargo e mantém a chave com o cargo', () => {
  const estadual = electionFor('SP', OFFICE_ESTADUAL)
  assert.equal(estadual.office, OFFICE_ESTADUAL)
  assert.equal(
    estadual.datasets.candidates.sourceFileMatch,
    'consulta_cand_2026_SP',
  )
  assert.equal(electionKey(estadual), '2026:SP:DEPUTADO ESTADUAL')

  const distrital = electionFor('DF', officeFor('DF', 'estadual'))
  assert.equal(distrital.office, OFFICE_DISTRITAL)
  assert.equal(electionKey(distrital), '2026:DF:DEPUTADO DISTRITAL')
})

test('filterForState só aceita sigla de UF', () => {
  assert.deepEqual(filterForState('sp'), {
    electionYear: 2026,
    state: 'SP',
    office: 'DEPUTADO FEDERAL',
  })
  assert.deepEqual(filterForState('sp', 'estadual'), {
    electionYear: 2026,
    state: 'SP',
    office: 'DEPUTADO ESTADUAL',
  })
  assert.deepEqual(filterForState('DF', 'estadual'), {
    electionYear: 2026,
    state: 'DF',
    office: 'DEPUTADO DISTRITAL',
  })
  assert.equal(filterForState(''), null)
  assert.equal(filterForState('XX'), null)
})
