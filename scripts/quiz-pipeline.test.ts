import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import lineageJson from '../content/quiz/party-lineage.json' with { type: 'json' }
import { normalizeVoto } from '../src/data-sources/camara/voto.ts'
import {
  isClassification,
  parseClassification,
} from '../src/data-sources/quiz/classify.ts'
import {
  resolvePartyStance,
  type PartyLineage,
} from '../src/data-sources/quiz/lineage.ts'
import { resolvePosition } from '../src/data-sources/quiz/positions.ts'
import {
  isContested,
  isMerit,
  selectShortlist,
  type RankVote,
} from '../src/data-sources/quiz/rank.ts'
import {
  alignmentBucket,
  trajetoriaBucket,
  trajetoriaCount,
} from '../src/shared/quiz-metrics.ts'

const lineage = lineageJson as PartyLineage

test('normalizeVoto reconhece os valores nominais da Câmara', () => {
  assert.equal(normalizeVoto('Sim'), 'Sim')
  assert.equal(normalizeVoto('Não'), 'Não')
  assert.equal(normalizeVoto('Abstenção'), 'Abstenção')
  assert.equal(normalizeVoto('P-NRV'), null)
  assert.equal(normalizeVoto('Liberado'), null)
})

test('resolvePartyStance usa federação e só aceita antecessores que concordam', () => {
  const rows = new Map<string, 'sim' | 'nao'>([
    ['Fdr PT-PCdoB-PV', 'sim'],
    ['PSL', 'nao'],
    ['DEM', 'sim'],
    ['PL', 'nao'],
  ])
  assert.equal(resolvePartyStance('PT', rows, '2024-01-01', lineage), 'sim')
  assert.equal(resolvePartyStance('UNIÃO', rows, '2020-01-01', lineage), null)
  assert.equal(resolvePartyStance('PL', rows, '2024-01-01', lineage), 'nao')
  assert.equal(resolvePartyStance('PODE', rows, '2024-01-01', lineage), null)
})

test('abstenção não cai para a orientação do partido', () => {
  const abstained = resolvePosition('Abstenção', 'sim')
  assert.equal(abstained.value, null)
  assert.equal(abstained.origin, 'candidato')
  const missing = resolvePosition(undefined, 'nao')
  assert.equal(missing.value, 'nao')
  assert.equal(missing.origin, 'partido')
})

test('métricas usam os cortes publicados', () => {
  assert.equal(alignmentBucket(0.7), 'governista')
  assert.equal(alignmentBucket(0.3), 'oposicao')
  assert.equal(alignmentBucket(0.5), 'independente')
  assert.equal(alignmentBucket(null), null)
  assert.equal(trajetoriaBucket(0), 'renovacao')
  assert.equal(trajetoriaBucket(2), 'alguma-experiencia')
  assert.equal(trajetoriaBucket(3), 'carreira-longa')
  assert.equal(trajetoriaCount(2, true), 3)
  assert.equal(trajetoriaCount(2, false), 2)
})

test('lista curta exige mérito, disputa e cobertura', () => {
  assert.equal(isMerit('Aprovado o Substitutivo.', []), true)
  assert.equal(isMerit('Aprovado o Requerimento de urgência.', ['PL']), false)
  assert.equal(isContested(40, 60), true)
  assert.equal(isContested(90, 10), false)
  assert.equal(isContested(0, 0), false)

  const orientations = new Map<string, 'sim' | 'nao'>([
    ['PT', 'sim'],
    ['PL', 'nao'],
  ])
  const vote: RankVote = {
    id: '1',
    data: '2024-06-01',
    descricao: 'Aprovado o texto-base do projeto de lei.',
    votosSim: 200,
    votosNao: 180,
    siglasTipo: ['PL'],
    ementa: null,
    proposicaoLabel: 'PL 1/2024',
    sourceUrl: 'https://dadosabertos.camara.leg.br/api/v2/votacoes/1',
    orientations,
  }
  const parties = ['PT', 'PT', 'PL', 'PL', 'PL']
  const selected = selectShortlist([vote], parties, lineage, 50, 0.8)
  assert.equal(selected.length, 1)
  assert.equal(selected[0]?.partyCoverage, 1)
})

test('parseClassification rejeita tema fora da lista', () => {
  const ok = parseClassification(
    '{"tema":"tributos","pergunta":"Você concorda?","simSignifica":"Aprovou.","contexto":"Texto.","confianca":0.8}',
  )
  assert.equal(isClassification(ok), true)
  const bad = parseClassification('{"tema":"esquerda","pergunta":"x","simSignifica":"y","contexto":"z","confianca":1}')
  assert.equal(isClassification(bad), false)
})

test('o arquivo de linhagem partidária tem fonte do TSE', async () => {
  const raw = await readFile(
    new URL('../content/quiz/party-lineage.json', import.meta.url),
    'utf8',
  )
  const parsed = JSON.parse(raw) as PartyLineage
  assert.ok(parsed.mergers.every((merger) => merger.source.includes('tse.jus.br')))
})
