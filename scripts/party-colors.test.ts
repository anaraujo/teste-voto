import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PARTY_COLORS,
  SEM_PARTIDO,
  contraste,
  partyColor,
  readableFill,
  readableOn,
} from '../src/shared/party-colors.ts'

/** As 30 cores da tabela, com o hex que foi sugerido para cada partido. */
const ESPERADO: Record<string, string> = {
  MDB: '#00843D',
  PDT: '#D71920',
  PT: '#CC0000',
  PCDOB: '#D71920',
  PSB: '#F2C300',
  PSDB: '#0F2BC5',
  AGIR: '#00A6CE',
  MOBILIZA: '#E30613',
  CIDADANIA: '#1677C8',
  PV: '#00843D',
  AVANTE: '#CA4A19',
  PP: '#2E4E77',
  PSTU: '#D71920',
  PCB: '#C8102E',
  PRTB: '#00843D',
  DC: '#00007B',
  PCO: '#D71920',
  PODE: '#0072CE',
  REPUBLICANOS: '#005CA9',
  PSOL: '#D71920',
  PL: '#0057A8',
  PSD: '#0072CE',
  SOLIDARIEDADE: '#F36C21',
  NOVO: '#F58220',
  REDE: '#00A88F',
  DEMOCRATA: '#0B2D5C',
  UP: '#C8102E',
  UNIÃO: '#0057B8',
  PRD: '#009B3A',
  MISSÃO: '#F2C300',
}

test('cada partido da tabela tem a cor principal que foi sugerida', () => {
  for (const [sigla, hex] of Object.entries(ESPERADO)) {
    assert.equal(PARTY_COLORS[sigla]?.primary, hex, sigla)
  }
})

test('a tabela tem os 30 partidos e nada a mais', () => {
  assert.equal(Object.keys(PARTY_COLORS).length, 30)
  assert.deepEqual(
    Object.keys(PARTY_COLORS).sort(),
    Object.keys(ESPERADO).sort(),
  )
})

test('toda cor principal passa em AA com a tinta que readableOn escolhe', () => {
  for (const [sigla, { primary }] of Object.entries(PARTY_COLORS)) {
    const razao = contraste(primary, readableOn(primary))
    assert.ok(
      razao >= 4.5,
      `${sigla} ${primary} com ${readableOn(primary)}: ${razao.toFixed(2)}:1`,
    )
  }
})

test('readableOn devolve #111 no amarelo e branco no vermelho', () => {
  // Branco no amarelo de PSB/MISSÃO dá 1,67:1; o cartão inteiro ficaria ilegível.
  assert.equal(readableOn('#F2C300'), '#111111')
  assert.equal(readableOn('#F58220'), '#111111')
  assert.equal(readableOn('#00A88F'), '#111111')
  assert.equal(readableOn('#D71920'), '#ffffff')
  assert.equal(readableOn('#00007B'), '#ffffff')
})

test('conferência de contraste contra os valores medidos', () => {
  assert.ok(Math.abs(contraste('#F2C300', '#ffffff') - 1.67) < 0.01)
  assert.ok(Math.abs(contraste('#F2C300', '#111111') - 11.31) < 0.01)
  assert.ok(Math.abs(contraste('#6B7280', '#ffffff') - 4.83) < 0.01)
  // A pior de todas com a tinta escolhida é CIDADANIA e AVANTE.
  assert.ok(contraste('#1677C8', '#ffffff') >= 4.5)
  assert.ok(contraste('#CA4A19', '#ffffff') >= 4.5)
})

test('partyColor acha a sigla, em qualquer forma de normalização', () => {
  assert.equal(partyColor('MDB').primary, '#00843D')
  // O banco traz MISSÃO e UNIÃO em NFD; a chave é NFC.
  assert.equal(partyColor('MISSÃO'.normalize('NFD')).primary, '#F2C300')
  assert.equal(partyColor('UNIÃO'.normalize('NFD')).primary, '#0057B8')
  // A sigla é caixa alta, mas chegar em minúscula não pode trocar a cor.
  assert.equal(partyColor('missão'.normalize('NFD')).primary, '#F2C300')
  assert.equal(partyColor('missão').primary, '#F2C300')
  assert.equal(partyColor('missão'.normalize('NFD')).primary, '#F2C300')
})

test('partyColor cai para o cinza sem partido, sigla vazia ou desconhecida', () => {
  assert.equal(partyColor(null), SEM_PARTIDO)
  assert.equal(partyColor(undefined), SEM_PARTIDO)
  assert.equal(partyColor(''), SEM_PARTIDO)
  // Sigla '#NULO' é o sentinela do TSE para partido ausente.
  assert.equal(partyColor('#NULO'), SEM_PARTIDO)
  assert.equal(partyColor('PARTIDO_NOVO_2026'), SEM_PARTIDO)
})

test('o cinza de sem partido passa em AA com texto branco', () => {
  assert.ok(contraste(SEM_PARTIDO.primary, '#ffffff') >= 4.5)
  assert.ok(
    contraste(SEM_PARTIDO.primary, readableOn(SEM_PARTIDO.primary)) >= 4.5,
  )
})

test('toda cor é um hex de 6 dígitos', () => {
  for (const [sigla, { primary, secondary }] of Object.entries(PARTY_COLORS)) {
    assert.match(primary, /^#[0-9A-F]{6}$/i, sigla)
    for (const cor of secondary) assert.match(cor, /^#[0-9A-F]{6}$/i, sigla)
  }
  assert.match(SEM_PARTIDO.primary, /^#[0-9A-F]{6}$/i)
})

test('as cores secundárias são as demais cores da bandeira', () => {
  assert.deepEqual(PARTY_COLORS.MDB.secondary, ['#F2C300', '#D71920'])
  assert.deepEqual(PARTY_COLORS.PT.secondary, ['#FFFFFF'])
  assert.deepEqual(SEM_PARTIDO.secondary, [])
})

test('contraste é simétrico e tem os extremos da escala', () => {
  assert.equal(contraste('#123456', '#abcdef'), contraste('#abcdef', '#123456'))
  assert.ok(Math.abs(contraste('#ffffff', '#ffffff') - 1) < 0.001)
  assert.ok(Math.abs(contraste('#000000', '#ffffff') - 21) < 0.01)
})

/** Cada tinta que um card real vai receber: a que `readableOn` dá. */
const COM_TINTA = Object.entries({ ...PARTY_COLORS, SEM_PARTIDO }).map(
  ([sigla, party]) => ({ sigla, tinta: readableOn(party.primary) }),
)

test('o preenchimento é a tinta contrária à do texto', () => {
  assert.equal(readableFill('#ffffff'), '#111111')
  assert.equal(readableFill('#111111'), '#ffffff')
})

test('texto e listras nunca ficam com a mesma tinta', () => {
  // Vale para as duas tintas possíveis, e também para cada tinta que um card
  // real vai receber: se `readableOn` passar a devolver outra coisa, a
  // inversão continua valendo porque o preenchimento nunca é a própria tinta.
  for (const tinta of ['#ffffff', '#111111']) {
    const fill = readableFill(tinta)
    assert.notEqual(fill, tinta)
    assert.ok(contraste(fill, tinta) >= 4.5)
  }
  for (const { sigla, tinta } of COM_TINTA) {
    assert.notEqual(
      readableFill(tinta),
      tinta,
      `${sigla}: listra do mesmo tom do texto`,
    )
  }
})
