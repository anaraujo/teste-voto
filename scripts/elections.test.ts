import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  FEDERATION_UNITS,
  electionFor,
  electionKey,
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

test('filterForState só aceita sigla de UF', () => {
  assert.deepEqual(filterForState('sp'), {
    electionYear: 2026,
    state: 'SP',
    office: 'DEPUTADO FEDERAL',
  })
  assert.equal(filterForState(''), null)
  assert.equal(filterForState('XX'), null)
})
