/**
 * Testes da camada municipal.
 *
 * O foco é a parte que protege o leitor de uma afirmação errada: o matcher
 * não pode dizer `confirmed` sem `sq_candidato`, não pode escolher entre
 * homônimos, e não pode tratar "não encontrei" como "não exerceu".
 *
 * Nenhum teste toca a rede: tudo é offline e determinístico.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import {
  prepareDatabase,
  replaceMunicipalChambers,
  replaceMunicipalIdentities,
  replaceMunicipalMandates,
  listMunicipalChambers,
  listMunicipalIdentitiesByCandidate,
  listMunicipalMandates,
  getMunicipalHistory,
  listMunicipalIdentities,
} from '../src/data-sources/repository.ts'
import {
  resolveIdentity,
  resolveChamberIdentities,
  type MunicipalIdentityCandidate,
  type MunicipalIdentitySourcePerson,
} from '../src/data-sources/municipal/identity.ts'
import {
  MUNICIPAL_REGISTRY,
  listSapableChambers,
  getChamberSourceByIbgeCode,
} from '../src/data-sources/municipal/registry.ts'
import { SEED_CANDIDATE_MANDATE_COUNT } from '../src/data-sources/municipal/registry.seed.ts'
import type { MunicipalMandate as MunicipalMandateRow } from '../src/data-sources/municipal/types.ts'
import {
  listCoveredMunicipalities,
  resolveMunicipality,
} from '../src/data-sources/municipal/ibge.ts'
import { NO_CAPABILITIES } from '../src/data-sources/municipal/types.ts'
import {
  legislatorName,
  legislatureLabel,
  mapMandato,
} from '../src/data-sources/municipal/sapl/mapper.ts'
import { nextPageUrl } from '../src/data-sources/municipal/sapl/types.ts'
import { MunicipalHttpClient } from '../src/data-sources/municipal/http.ts'
import { SaplMunicipalSource } from '../src/data-sources/municipal/sapl/source.ts'

const VERIFIED_AT = '2026-09-30'

function candidate(
  overrides: Partial<MunicipalIdentityCandidate> & { candidateId: string; fullName: string },
): MunicipalIdentityCandidate {
  return {
    municipalityIbgeCode: '4104302',
    electionYear: 2020,
    sqCandidato: null,
    ...overrides,
  }
}

function person(
  overrides: Partial<MunicipalIdentitySourcePerson> & { sourcePersonId: string; fullName: string },
): MunicipalIdentitySourcePerson {
  return {
    sourceId: 'pr:4104302',
    municipalityIbgeCode: '4104302',
    alternateName: null,
    mandateStartDate: '2021-01-01',
    sqCandidato: null,
    ...overrides,
  }
}

/* ------------------------------------------------------------------ *
 * Matcher
 * ------------------------------------------------------------------ */

test('sq_candidato igual nos dois lados confirma o vínculo', () => {
  const result = resolveIdentity(
    candidate({ candidateId: 'c1', fullName: 'Ana Paula Souza', sqCandidato: '2020PR0001' }),
    [person({ sourcePersonId: 'p1', fullName: 'Nome Diferente', sqCandidato: '2020PR0001' })],
    VERIFIED_AT,
  )
  assert.equal(result.matchingStatus, 'confirmed')
  assert.equal(result.matchingMethod, 'sq-candidato')
  assert.equal(result.sourcePersonId, 'p1')
})

test('sem sq_candidato o melhor caso é probable, nunca confirmed', () => {
  const result = resolveIdentity(
    candidate({ candidateId: 'c1', fullName: 'Ana Paula Souza' }),
    [person({ sourcePersonId: 'p1', fullName: 'Ana Paula Souza' })],
    VERIFIED_AT,
  )
  assert.equal(result.matchingStatus, 'probable')
  assert.equal(result.matchingMethod, 'exact-name-plus-context')
  assert.match(result.matchingEvidence ?? '', /não é confirmação/)
})

test('sq_candidato da Câmara não bate com o do TSE não confirma', () => {
  const result = resolveIdentity(
    candidate({ candidateId: 'c1', fullName: 'Ana Paula Souza', sqCandidato: '2020PR0001' }),
    [person({ sourcePersonId: 'p1', fullName: 'Ana Paula Souza', sqCandidato: '2020PR9999' })],
    VERIFIED_AT,
  )
  assert.equal(result.matchingStatus, 'probable')
  assert.notEqual(result.matchingMethod, 'sq-candidato')
})

test('homônimos no mesmo município ficam unresolved em vez de escolher um', () => {
  const result = resolveIdentity(
    candidate({ candidateId: 'c1', fullName: 'José Silva' }),
    [
      person({ sourcePersonId: 'p1', fullName: 'José Silva' }),
      person({ sourcePersonId: 'p2', fullName: 'José Silva' }),
    ],
    VERIFIED_AT,
  )
  assert.equal(result.matchingStatus, 'unresolved')
  assert.equal(result.sourcePersonId, null)
  assert.match(result.matchingEvidence ?? '', /2 cadastros/)
})

test('mesmo nome em município diferente não vira vínculo', () => {
  const result = resolveIdentity(
    candidate({ candidateId: 'c1', fullName: 'José Silva', municipalityIbgeCode: '4104302' }),
    [person({ sourcePersonId: 'p1', fullName: 'José Silva', municipalityIbgeCode: '4119905' })],
    VERIFIED_AT,
  )
  assert.equal(result.matchingStatus, 'unresolved')
})

test('período incompatível com a eleição rejeita o vínculo', () => {
  const result = resolveIdentity(
    candidate({ candidateId: 'c1', fullName: 'Ana Paula Souza', electionYear: 2016 }),
    [person({ sourcePersonId: 'p1', fullName: 'Ana Paula Souza', mandateStartDate: '2021-01-01' })],
    VERIFIED_AT,
  )
  assert.equal(result.matchingStatus, 'unresolved')
  assert.match(result.matchingEvidence ?? '', /2021/)
})

test('posse no ano seguinte da eleição é compatível', () => {
  const result = resolveIdentity(
    candidate({ candidateId: 'c1', fullName: 'Ana Paula Souza', electionYear: 2020 }),
    [person({ sourcePersonId: 'p1', fullName: 'Ana Paula Souza', mandateStartDate: '2021-01-01' })],
    VERIFIED_AT,
  )
  assert.equal(result.matchingStatus, 'probable')
})

test('nome curto demais é recusado antes de comparar', () => {
  const result = resolveIdentity(
    candidate({ candidateId: 'c1', fullName: 'Ana' }),
    [person({ sourcePersonId: 'p1', fullName: 'Ana' })],
    VERIFIED_AT,
  )
  assert.equal(result.matchingStatus, 'unresolved')
  assert.match(result.matchingEvidence ?? '', /curto/)
})

test('acento e caixa não impedem o casamento de nome', () => {
  const result = resolveIdentity(
    candidate({ candidateId: 'c1', fullName: 'João Gonçalves da Silva Jr.' }),
    [person({ sourcePersonId: 'p1', fullName: 'JOAO GONCALVES DA SILVA JR' })],
    VERIFIED_AT,
  )
  assert.equal(result.matchingStatus, 'probable')
})

test('cadastro da Câmara não pode ser usado por dois candidatos', () => {
  const identities = resolveChamberIdentities(
    [
      candidate({ candidateId: 'c1', fullName: 'José Silva', sqCandidato: 'A' }),
      candidate({ candidateId: 'c2', fullName: 'José Silva', sqCandidato: 'B' }),
    ],
    [person({ sourcePersonId: 'p1', fullName: 'José Silva' })],
    'pr:4104302',
    VERIFIED_AT,
  )
  const usados = identities.filter((i) => i.sourcePersonId !== null)
  assert.equal(usados.length, 1)
  const perdedor = identities.find((i) => i.sourcePersonId === null)
  assert.equal(perdedor?.matchingStatus, 'unresolved')
})

test('nada encontrado no SAPL vira unresolved, não "não exerceu"', () => {
  const identities = resolveChamberIdentities(
    [candidate({ candidateId: 'c1', fullName: 'Pessoa Sem Cadastro' })],
    [],
    'pr:4104302',
    VERIFIED_AT,
  )
  assert.equal(identities[0].matchingStatus, 'unresolved')
  assert.equal(identities[0].sourcePersonId, null)
})

/* ------------------------------------------------------------------ *
 * Mapper SAPL
 * ------------------------------------------------------------------ */

const CONTEXT = {
  source: {
    id: 'pr:4104302',
    title: 'SAPL — Câmara de Araucária',
    url: 'https://sapl.araucaria.pr.leg.br/api/',
    publisher: 'Câmara Municipal de Araucária',
    sourceType: 'official-api' as const,
    publishedAt: null,
    retrievedAt: VERIFIED_AT,
  },
  municipalityIbgeCode: '4104302',
}

test('nome civil tem precedência sobre o nome de gabinete', () => {
  assert.equal(
    legislatorName({
      id: 1,
      nome_completo: 'Ana Paula Souza',
      nome_parlamentar: 'Dra. Ana',
    }),
    'Ana Paula Souza',
  )
})

test('sem nome civil, usa o nome de gabinete', () => {
  assert.equal(
    legislatorName({ id: 1, nome_completo: null, nome_parlamentar: 'Dra. Ana' }),
    'Dra. Ana',
  )
})

test('rótulo de legislatura usa intervalo de anos quando existe', () => {
  assert.equal(
    legislatureLabel({ id: 3, data_inicio: '2021-01-01', data_fim: '2024-12-31' }, 3),
    '2021-2024',
  )
})

test('rótulo de legislatura cai para o número quando não há datas', () => {
  assert.equal(legislatureLabel({ id: 3 }, 3), 'Legislatura 3')
  assert.equal(legislatureLabel(undefined, null), null)
})

test('mandato do SAPL vira domínio com datas ISO e titular', () => {
  const mandate = mapMandato(
    {
      id: 500,
      parlamentar: 11588,
      legislatura: 3,
      data_inicio_mandato: '2021-01-01T00:00:00',
      data_fim_mandato: '2024-12-31',
      titular: true,
    },
    {
      ...CONTEXT,
      legislatures: [{ id: 3, data_inicio: '2021-01-01', data_fim: '2024-12-31' }],
    },
  )
  assert.ok(mandate !== null)
  assert.equal(mandate.office, 'vereador')
  assert.equal(mandate.startDate, '2021-01-01')
  assert.equal(mandate.endDate, '2024-12-31')
  assert.equal(mandate.titular, true)
  assert.equal(mandate.legislatureLabel, '2021-2024')
  assert.equal(mandate.source.id, 'pr:4104302')
})

test('mandato sem parlamentar é descartado, não vira mandato órfão', () => {
  assert.equal(mapMandato({ id: 501, parlamentar: null, legislatura: 3 }, CONTEXT), null)
})

test('mandato guarda o parlamentar, senão o período não tem dono', () => {
  const mandate = mapMandato({ id: 503, parlamentar: 11588, legislatura: 3 }, CONTEXT)
  assert.ok(mandate !== null)
  assert.equal(mandate.sourcePersonId, '11588')
})

test('início de mandato por pessoa usa o mais antigo de cada uma', () => {
  const source = new SaplMunicipalSource({
    chamber: getChamberSourceByIbgeCode('4101804')!,
    http: new MunicipalHttpClient({}),
    source: CONTEXT.source,
  })
  const mandato = (id: string, personId: string, start: string | null) => ({
    legislatureId: '',
    municipalityIbgeCode: '4101804',
    sourceId: 'pr:4101804',
    sourceMandateId: id,
    sourcePersonId: personId,
    office: 'vereador',
    legislatureLabel: null,
    startDate: start,
    endDate: null,
    titular: true,
    party: null,
    roles: [],
    source: CONTEXT.source,
  })

  const inicio = source.mandateStartsByPerson([
    mandato('3', 'p1', '2021-01-01'),
    mandato('1', 'p1', '2013-01-01'),
    mandato('2', 'p2', '2017-01-01'),
    mandato('4', 'p3', null),
  ])

  assert.equal(inicio.get('p1'), '2013-01-01')
  assert.equal(inicio.get('p2'), '2017-01-01')
  // Sem data de início não há período para checar.
  assert.equal(inicio.has('p3'), false)
  assert.equal(inicio.size, 2)
})

test('campo ausente vira null, não zero nem string vazia', () => {
  const mandate = mapMandato({ id: 502, parlamentar: 1, legislatura: 3 }, CONTEXT)
  assert.ok(mandate !== null)
  assert.equal(mandate.startDate, null)
  assert.equal(mandate.endDate, null)
  assert.equal(mandate.titular, null)
  assert.equal(mandate.party, null)
})

/* ------------------------------------------------------------------ *
 * Paginação e limites do cliente HTTP
 * ------------------------------------------------------------------ */

test('links.next em http:// é corrigido para o esquema do site', () => {
  const url = nextPageUrl(
    { links: { next: 'http://sapl.exemplo.pr.leg.br/api/parlamentares/mandato/?limit=1&page=2' } },
    'https://sapl.exemplo.pr.leg.br',
  )
  assert.ok(url?.startsWith('https://'))
})

test('links.next ausente encerra a paginação', () => {
  assert.equal(nextPageUrl(undefined, 'https://x'), null)
  assert.equal(nextPageUrl({ links: { next: null } }, 'https://x'), null)
})

test('requisições simultâneas à mesma URL são deduplicadas', async () => {
  let chamadas = 0
  const http = new MunicipalHttpClient({
    minIntervalMs: 0,
    fetchImpl: async () => {
      chamadas++
      await new Promise((r) => setTimeout(r, 20))
      return new Response('{"results":[]}', {
        headers: { 'content-type': 'application/json' },
      })
    },
  })
  const chamber = { access: 'verified' } as never
  await Promise.all([
    http.getJson('https://x/api/a', chamber, 'op'),
    http.getJson('https://x/api/a', chamber, 'op'),
    http.getJson('https://x/api/a', chamber, 'op'),
  ])
  assert.equal(chamadas, 1)
})

test('5xx é repetido com backoff, 4xx não é', async () => {
  const status: number[] = []
  const http = new MunicipalHttpClient({
    retries: 3,
    backoffMs: 1,
    minIntervalMs: 0,
    fetchImpl: async () => {
      const code = status.length === 0 ? 500 : 403
      status.push(code)
      return new Response('{}', { status: code })
    },
  })
  const chamber = { access: 'verified' } as never
  await assert.rejects(() => http.getJson('https://x/api/a', chamber, 'op'))
  // 1 tentativa para o 500, 1 para o 403: o 4xx não é repetido.
  assert.deepEqual(status, [500, 403])
})

test('timeout aborta a requisição e propaga o erro', async () => {
  const http = new MunicipalHttpClient({
    timeoutMs: 20,
    retries: 1,
    minIntervalMs: 0,
    fetchImpl: (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('abortado')))
      }),
  })
  const chamber = { access: 'verified' } as never
  await assert.rejects(() => http.getJson('https://x/api/a', chamber, 'op'), /abortado/)
})

test('log de operação não carrega nome de pessoa', async () => {
  const linhas: string[] = []
  const http = new MunicipalHttpClient({
    minIntervalMs: 0,
    log: (entry) => linhas.push(JSON.stringify(entry)),
    fetchImpl: async () =>
      new Response('{"results":[1,2,3]}', {
        headers: { 'content-type': 'application/json' },
      }),
  })
  await http.getJson('https://x/api/a', { access: 'verified' } as never, 'mandatos')
  assert.equal(linhas.length, 1)
  assert.match(linhas[0], /"items":3/)
  assert.doesNotMatch(linhas[0], /nome_completo|nome_parlamentar/)
})

/* ------------------------------------------------------------------ *
 * Registry e IBGE
 * ------------------------------------------------------------------ */

test('registry tem 55 municípios, igual à tabela IBGE', () => {
  assert.equal(MUNICIPAL_REGISTRY.length, 55)
  assert.equal(listCoveredMunicipalities().length, 55)
})

test('toda câmara do registry tem código IBGE da tabela', () => {
  for (const chamber of MUNICIPAL_REGISTRY) {
    assert.ok(
      listCoveredMunicipalities().some((m) => m.ibgeCode === chamber.municipalityIbgeCode),
      `${chamber.municipalityName} sem código IBGE`,
    )
  }
})

test('todo chamber do registry tem nome que resolve na tabela IBGE', () => {
  for (const chamber of MUNICIPAL_REGISTRY) {
    assert.equal(
      resolveMunicipality(chamber.municipalityName)?.ibgeCode,
      chamber.municipalityIbgeCode,
    )
  }
})

test('acesso verificado sempre tem apiBaseUrl; o contrário também', () => {
  for (const chamber of MUNICIPAL_REGISTRY) {
    if (chamber.access === 'verified') {
      assert.ok(chamber.apiBaseUrl !== null, `${chamber.municipalityName} verificado sem URL`)
    } else {
      assert.equal(chamber.apiBaseUrl, null, `${chamber.municipalityName} sem URL mesmo assim`)
    }
  }
})

test('fonte não verificada nunca afirma capacidade', () => {
  for (const chamber of MUNICIPAL_REGISTRY) {
    if (chamber.access !== 'verified') {
      assert.deepEqual(chamber.capabilities, NO_CAPABILITIES)
    }
  }
})

test('Câmaras sem API acessível declaram o motivo em português', () => {
  const semFonte = MUNICIPAL_REGISTRY.filter((c) => c.access !== 'verified')
  assert.equal(semFonte.length, 33)
  for (const chamber of semFonte) {
    assert.ok(
      typeof chamber.note === 'string' && chamber.note.length > 0,
      `${chamber.municipalityName} sem nota explicando a ausência`,
    )
  }
})

test('Curitiba, Londrina e Ponta Grossa estão registradas como fora da Fase 1', () => {
  const curitiba = getChamberSourceByIbgeCode('4106902')
  assert.equal(curitiba?.access, 'blocked')

  const londrina = resolveMunicipality('Londrina')
  const ponta = resolveMunicipality('Ponta Grossa')
  assert.ok(londrina && ponta)
  assert.equal(getChamberSourceByIbgeCode(londrina.ibgeCode)?.access, 'requires-auth')
  assert.equal(getChamberSourceByIbgeCode(ponta.ibgeCode)?.access, 'html-only')
})

test('listSapableChambers devolve só o que foi verificado', () => {
  const sapable = listSapableChambers()
  assert.equal(sapable.length, 22)
  assert.ok(sapable.every((c) => c.access === 'verified'))
  assert.ok(sapable.every((c) => c.apiBaseUrl !== null))
})

test('seed soma 177 pares candidato-município, não 169 pessoas', () => {
  // 169 candidatos distintos; 8 atuaram em dois municípios, então a soma por
  // município dá 177. Somar isso como "pessoas" seria errado.
  assert.equal(SEED_CANDIDATE_MANDATE_COUNT, 177)
})

test('IBGE resolve município com e sem acento para o mesmo código', () => {
  assert.equal(resolveMunicipality('São Mateus do Sul')?.ibgeCode, '4125605')
  assert.equal(resolveMunicipality('sao mateus do sul')?.ibgeCode, '4125605')
  assert.equal(resolveMunicipality('Ponta Grossa')?.ibgeCode, '4119905')
  assert.equal(resolveMunicipality('Municipio Inexistente'), null)
})

/* ------------------------------------------------------------------ *
 * Persistência
 * ------------------------------------------------------------------ */

function seedCandidate(db: DatabaseSync, id: string): void {
  db.prepare(
    `INSERT OR IGNORE INTO candidates (
      id, tse_sequence, election_year, state, office, ballot_name, full_name,
      ballot_number, status, source_provider, source_url, source_dataset,
      source_retrieved_at, imported_at, updated_at, checksum
    ) VALUES (?, ?, 2026, 'PR', 'VEREADOR', ?, ?, '1', 'APTO', 'TSE',
      'https://tse.jus.br', 'consultas_candidatos', '2026-09-30T00:00:00.000Z',
      '2026-09-30T00:00:00.000Z', '2026-09-30T00:00:00.000Z', 'teste')`,
  ).run(id, id, id, id)
}

test('câmaras, vínculos e mandatos sobrevivem a ida e volta', () => {
  const db = new DatabaseSync(':memory:')
  prepareDatabase(db)
  seedCandidate(db, 'c1')

  replaceMunicipalChambers(db, listSapableChambers())
  assert.equal(listMunicipalChambers(db).length, 22)

  replaceMunicipalIdentities(db, [
    {
      candidateId: 'c1',
      sourceId: 'pr:4104302',
      sourcePersonId: 'p1',
      municipalityIbgeCode: '4104302',
      fullName: 'Ana Paula Souza',
      matchingStatus: 'probable',
      matchingMethod: 'exact-name-plus-context',
      matchingEvidence: 'nome idêntico',
      verifiedAt: VERIFIED_AT,
    },
    {
      candidateId: 'c1',
      sourceId: 'pr:4109905',
      sourcePersonId: null,
      municipalityIbgeCode: '4109905',
      fullName: 'Ana Paula Souza',
      matchingStatus: 'unresolved',
      matchingMethod: 'other',
      matchingEvidence: 'sem correspondência',
      verifiedAt: VERIFIED_AT,
    },
  ])

  const byCandidate = listMunicipalIdentitiesByCandidate(db)
  const rows = byCandidate.get('c1') ?? []
  assert.equal(rows.length, 2)
  assert.deepEqual(
    rows.map((r) => r.matching_status).sort(),
    ['probable', 'unresolved'],
  )
  assert.equal(rows.find((r) => r.matching_status === 'unresolved')?.source_person_id, null)

  replaceMunicipalMandates(db, [
    {
      legislatureId: '3',
      municipalityIbgeCode: '4104302',
      sourceId: 'pr:4104302',
      sourceMandateId: '99',
      sourcePersonId: 'p1',
      office: 'vereador',
      legislatureLabel: '2021-2024',
      startDate: '2021-01-01',
      endDate: '2024-12-31',
      titular: true,
      party: 'PSD',
      roles: [],
      source: CONTEXT.source,
    },
  ])
  const mandates = listMunicipalMandates(db)
  assert.equal(mandates.length, 1)
  assert.equal(mandates[0].titular, 1)
  assert.equal(mandates[0].legislature_label, '2021-2024')
  assert.equal(JSON.parse(mandates[0].roles_json).length, 0)

  db.close()
})

test('replace é idempotente: rodar duas vezes não duplica', () => {
  const db = new DatabaseSync(':memory:')
  prepareDatabase(db)
  replaceMunicipalChambers(db, listSapableChambers())
  replaceMunicipalChambers(db, listSapableChambers())
  assert.equal(listMunicipalChambers(db).length, 22)
  db.close()
})

/** Um mandato e um vínculo de exemplo para a fonte dada. */
function mandatoDe(sourceId: string, sourceMandateId: string): MunicipalMandateRow {
  return {
    legislatureId: '3',
    municipalityIbgeCode: '4104302',
    sourceId,
    sourceMandateId,
    sourcePersonId: 'p1',
    office: 'vereador',
    legislatureLabel: '2021-2024',
    startDate: '2021-01-01',
    endDate: '2024-12-31',
    titular: true,
    party: 'PSD',
    roles: [],
    source: CONTEXT.source,
  }
}

test('mandato de uma fonte que falha não apaga o das outras', () => {
  // Câmaras derrubam conexão o tempo todo. Se o replace fosse global, uma
  // execução parcial perderia tudo o que tinha sido lido antes.
  const db = new DatabaseSync(':memory:')
  prepareDatabase(db)

  replaceMunicipalMandates(db, [
    mandatoDe('pr:4104302', '1'),
    mandatoDe('pr:4109905', '2'),
  ])
  assert.equal(listMunicipalMandates(db).length, 2)

  // Segunda execução: só uma das câmaras respondeu.
  replaceMunicipalMandates(db, [mandatoDe('pr:4104302', '1')])
  const rows = listMunicipalMandates(db)
  // A segunda execução só substitui pr:4104302; pr:4109905 permanece.
  assert.equal(rows.length, 2)
  const ids = new Set(rows.map((r) => r.source_id))
  assert.ok(ids.has('pr:4104302'))
  assert.ok(ids.has('pr:4109905'))

  db.close()
})

test('vínculo de uma fonte que falha não apaga o das outras', () => {
  const db = new DatabaseSync(':memory:')
  prepareDatabase(db)
  seedCandidate(db, 'c1')
  seedCandidate(db, 'c2')

  const vinculo = (candidateId: string, sourceId: string) => ({
    candidateId,
    sourceId,
    sourcePersonId: 'p1',
    municipalityIbgeCode: '4104302',
    fullName: 'Ana Paula Souza',
    matchingStatus: 'probable' as const,
    matchingMethod: 'exact-name-plus-context' as const,
    matchingEvidence: 'nome idêntico',
    verifiedAt: VERIFIED_AT,
  })

  replaceMunicipalIdentities(db, [vinculo('c1', 'pr:4104302'), vinculo('c2', 'pr:4109905')])
  assert.equal(listMunicipalIdentitiesByCandidate(db).size, 2)

  replaceMunicipalIdentities(db, [vinculo('c1', 'pr:4104302')])
  // C1 ainda tem vínculo da pr:4104302; C2 continua com o seu.
  assert.equal(listMunicipalIdentitiesByCandidate(db).size, 2)

  db.close()
})

test('vínculo com candidato inexistente viola a FK (proteção de integridade)', () => {
  const db = new DatabaseSync(':memory:')
  prepareDatabase(db)
  assert.throws(() =>
    replaceMunicipalIdentities(db, [
      {
        candidateId: 'nao-existe',
        sourceId: 'pr:4104302',
        sourcePersonId: null,
        municipalityIbgeCode: '4104302',
        fullName: 'Fulano',
        matchingStatus: 'unresolved',
        matchingMethod: 'other',
        matchingEvidence: null,
        verifiedAt: VERIFIED_AT,
      },
    ]),
  )
  db.close()
})

/* ------------------------------------------------------------------ *
 * O que a ficha pode afirmar
 * ------------------------------------------------------------------ */

function seedCandidatosComVereador(db: DatabaseSync, ids: string[]): void {
  for (const id of ids) {
    seedCandidate(db, id)
    db.prepare(
      `INSERT INTO political_mandates (
        candidate_id, ano, cargo, uf, municipio, status, turno, updated_at
      ) VALUES (?, 2020, 'VEREADOR', 'PR', 'Araucária', 'eleito', 1, '2026-09-30')`,
    ).run(id)
  }
}

test('município sem fonte legível diz unavailable, não "não exerceu"', () => {
  // É a diferença que impede a ficha de afirmar que alguém nunca exerceu
  // mandato só porque a Câmara não publica dados.
  const db = new DatabaseSync(':memory:')
  prepareDatabase(db)
  seedCandidate(db, 'c1')

  replaceMunicipalChambers(db, [
    {
      municipalityIbgeCode: '4101804',
      municipalityName: 'Araucária',
      state: 'PR',
      chamberName: 'Câmara Municipal de Araucária',
      chamberUrl: null,
      sourceType: 'unknown',
      apiBaseUrl: null,
      access: 'not-found',
      capabilities: { ...NO_CAPABILITIES },
      lastVerifiedAt: VERIFIED_AT,
      note: 'Nenhuma fonte localizada.',
    },
  ])
  replaceMunicipalIdentities(db, [
    {
      candidateId: 'c1',
      sourceId: 'pr:4101804',
      sourcePersonId: null,
      municipalityIbgeCode: '4101804',
      fullName: 'Ana Paula Souza',
      matchingStatus: 'unresolved',
      matchingMethod: 'other',
      matchingEvidence: 'sem cadastro',
      verifiedAt: VERIFIED_AT,
    },
  ])

  const history = getMunicipalHistory(db, 'c1')
  assert.equal(history.coverage, 'unavailable')
  assert.equal(history.coverageNote, 'Nenhuma fonte localizada.')

  db.close()
})

test('fonte consultada sem correspondência é read, não unavailable', () => {
  const db = new DatabaseSync(':memory:')
  prepareDatabase(db)
  seedCandidate(db, 'c1')

  replaceMunicipalChambers(db, [
    {
      municipalityIbgeCode: '4101804',
      municipalityName: 'Araucária',
      state: 'PR',
      chamberName: 'Câmara Municipal de Araucária',
      chamberUrl: 'https://sapl.araucaria.pr.leg.br',
      sourceType: 'sapl',
      apiBaseUrl: 'https://sapl.araucaria.pr.leg.br',
      access: 'verified',
      capabilities: { ...NO_CAPABILITIES },
      lastVerifiedAt: VERIFIED_AT,
    },
  ])
  replaceMunicipalIdentities(db, [
    {
      candidateId: 'c1',
      sourceId: 'pr:4101804',
      sourcePersonId: null,
      municipalityIbgeCode: '4101804',
      fullName: 'Ana Paula Souza',
      matchingStatus: 'unresolved',
      matchingMethod: 'other',
      matchingEvidence: 'nenhum cadastro com esse nome',
      verifiedAt: VERIFIED_AT,
    },
  ])

  const history = getMunicipalHistory(db, 'c1')
  assert.equal(history.coverage, 'read')
  assert.equal(history.coverageNote, null)

  db.close()
})

test('mandato fica ligado ao cadastro da pessoa, não solto', () => {
  const db = new DatabaseSync(':memory:')
  prepareDatabase(db)
  seedCandidatosComVereador(db, ['c1'])

  replaceMunicipalChambers(db, [
    {
      municipalityIbgeCode: '4101804',
      municipalityName: 'Araucária',
      state: 'PR',
      chamberName: 'Câmara Municipal de Araucária',
      chamberUrl: 'https://sapl.araucaria.pr.leg.br',
      sourceType: 'sapl',
      apiBaseUrl: 'https://sapl.araucaria.pr.leg.br',
      access: 'verified',
      capabilities: { ...NO_CAPABILITIES },
      lastVerifiedAt: VERIFIED_AT,
    },
  ])
  replaceMunicipalIdentities(db, [
    {
      candidateId: 'c1',
      sourceId: 'pr:4101804',
      sourcePersonId: 'p1',
      municipalityIbgeCode: '4101804',
      fullName: 'Ana Paula Souza',
      matchingStatus: 'probable',
      matchingMethod: 'exact-name-plus-context',
      matchingEvidence: 'nome idêntico',
      verifiedAt: VERIFIED_AT,
    },
  ])
  replaceMunicipalMandates(db, [mandatoDe('pr:4101804', '1')])

  const history = getMunicipalHistory(db, 'c1')
  assert.equal(history.coverage, 'read')
  assert.equal(history.identities.length, 1)
  assert.equal(history.mandates.get('p1')?.length, 1)

  db.close()
})

test('vínculo unresolved não traz mandato para a ficha', () => {
  // unresolved significa "não consegui afirmar que é esta pessoa"; mostrar o
  // mandato dela ali transformaria uma dúvida em fato. O servidor filtra, e o
  // registro continua no banco para auditoria.
  const db = new DatabaseSync(':memory:')
  prepareDatabase(db)
  seedCandidate(db, 'c1')

  const rows = listMunicipalIdentities(db)
  assert.equal(rows.length, 0)

  db.close()
})
