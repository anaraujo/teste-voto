/**
 * Sincroniza a camada parlamentar da ficha comparável: mandatos, métricas
 * (proposições, comissões, despesas) e votos em votações-chave, para
 * candidatos que têm histórico na Câmara ou no Senado.
 *
 * Fontes:
 *   - Câmara (Dados Abertos): /deputados por legislatura, proposições por
 *     autor, despesas, órgãos e votos por votação.
 *   - Senado (Dados Abertos): lista de senadores por legislatura (mandatos).
 *
 * O senado não expõe votações por API pública; fica o histórico de mandato.
 *
 * Execução: node --experimental-sqlite --experimental-strip-types
 *   scripts/sync-parliament.ts
 */

import { join } from 'node:path'
import {
  openRepository,
  listCandidates,
  listIncumbents,
  replaceParliamentary,
} from '../src/data-sources/repository.ts'
import { defaultDataDir } from '../src/data-sources/tse/candidates.ts'
import {
  fetchDeputadosPorLegislatura,
  fetchDeputadoDetalhe,
  fetchProposicoesPorAutor,
  fetchDespesas,
  fetchOrgaos,
  fetchVotosVotacao,
  type DeputadoLista,
} from '../src/data-sources/camara/records.ts'
import {
  fetchSenadoresPorLegislatura,
  type SenadorLista,
} from '../src/data-sources/camara/senado.ts'
import { matchHistoryPeople } from '../src/data-sources/parliament/identity.ts'
import type {
  ParliamentaryData,
  ParliamentaryMandate,
  ParliamentaryRecord,
  ParliamentaryVote,
  VotoValor,
} from '../src/data-sources/parliament/types.ts'
import { CURRENT_ELECTION } from '../src/shared/elections.ts'
import { normalizeVoto } from '../src/data-sources/camara/voto.ts'
import { PAUTAS_CHAVE } from '../src/shared/pautas.ts'

const DATA_DIR = defaultDataDir()

const LEGISLATURAS = [
  { id: 55, dataInicio: '2015-02-01', dataFim: '2019-01-31' },
  { id: 56, dataInicio: '2019-02-01', dataFim: '2023-01-31' },
  { id: 57, dataInicio: '2023-02-01', dataFim: '2027-01-31' },
]

const filter = {
  electionYear: CURRENT_ELECTION.year,
  state: CURRENT_ELECTION.state,
  office: CURRENT_ELECTION.office,
}

const db = await openRepository(join(DATA_DIR, 'tse.db'))

try {
  const candidates = listCandidates(db, filter)
  const incumbents = listIncumbents(db)
  // camaraId -> candidateId (casamentos já conhecidos).
  const incumbentByCamara = new Map<number, string>()
  for (const entry of incumbents.values()) {
    incumbentByCamara.set(entry.camaraId, entry.candidateId)
  }

  // ---------- Câmara: deputados por legislatura ----------
  const deputiesByLeg = new Map<number, DeputadoLista[]>()
  for (const leg of LEGISLATURAS) {
    let items: DeputadoLista[] = []
    try {
      items = await fetchDeputadosPorLegislatura(filter.state, leg.id)
    } catch (error) {
      console.log(
        `[camara] aviso legislatura ${leg.id}: ` +
          (error instanceof Error ? error.message : String(error)),
      )
    }
    deputiesByLeg.set(leg.id, items)
    console.log(
      `[camara] legislatura ${leg.id}: ${items.length} deputados ${filter.state}`,
    )
  }

  // Deputados únicos (cruzando legislaturas), com partido/uf por legislatura.
  interface CamaraDep {
    id: number
    nome: string
    partidos: Record<number, string>
    ufs: Record<number, string>
    legs: number[]
  }
  const camaraByDep = new Map<number, CamaraDep>()
  for (const leg of LEGISLATURAS) {
    for (const item of deputiesByLeg.get(leg.id) ?? []) {
      let dep = camaraByDep.get(item.id)
      if (!dep) {
        dep = { id: item.id, nome: item.nome, partidos: {}, ufs: {}, legs: [] }
        camaraByDep.set(item.id, dep)
      }
      dep.partidos[leg.id] = item.siglaPartido
      dep.ufs[leg.id] = item.siglaUf
      if (!dep.legs.includes(leg.id)) dep.legs.push(leg.id)
    }
  }
  console.log(`[camara] ${camaraByDep.size} deputados únicos (2015-2026)`)

  // ---------- Casamento com candidatos ----------
  const camaraToCandidate = new Map<number, string>()
  for (const [camaraId, candidateId] of incumbentByCamara) {
    camaraToCandidate.set(camaraId, candidateId)
  }

  const unbound = [...camaraByDep.values()].filter(
    (dep) => !incumbentByCamara.has(dep.id),
  )
  const people = await Promise.all(
    unbound.map(async (dep) => {
      const detail = await fetchDeputadoDetalhe(dep.id)
      return {
        id: dep.id,
        nome: dep.nome,
        dataNascimento: detail?.dataNascimento ?? null,
      }
    }),
  )
  const { matched: matchedCamara, unmatched: unmatchedCamara } =
    matchHistoryPeople(candidates, people)
  for (const [camaraId, candidateId] of matchedCamara) {
    camaraToCandidate.set(camaraId, candidateId)
  }
  console.log(
    `[camara] casamentos: ${camaraToCandidate.size}/428 (incumbentes + ex-deputados)`,
  )
  if (unmatchedCamara.length > 0) {
    console.log(
      `[camara] sem candidato correspondente (n=${unmatchedCamara.length}): ` +
        unmatchedCamara.map((p) => p.nome).join(' | '),
    )
  }

  // ---------- Câmara: mandatos, métricas e despesas ----------
  const mandates: ParliamentaryMandate[] = []
  const records: ParliamentaryRecord[] = []

  for (const dep of camaraByDep.values()) {
    const candidateId = camaraToCandidate.get(dep.id)
    if (!candidateId) continue

    let proposicoesPorAno: Record<string, number> = {}
    let comissoes: ParliamentaryRecord['comissoes'] = []
    let despesasPorAno: Record<string, number> = {}
    let erros: string[] = []

    try {
      const proposicoes = await fetchProposicoesPorAutor(dep.id)
      proposicoesPorAno = {}
      for (const item of proposicoes) {
        const year = (item.dataApresentacao ?? '').slice(0, 4)
        if (year >= '2015' && year <= '2026') {
          proposicoesPorAno[year] = (proposicoesPorAno[year] ?? 0) + 1
        }
      }
    } catch (error) {
      erros.push(
        `proposicoes: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    try {
      const orgaos = await fetchOrgaos(dep.id)
      comissoes = orgaos
        .filter((o) => o.siglaOrgao && o.siglaOrgao !== 'PLEN')
        .sort((a, b) => (b.dataInicio ?? '').localeCompare(a.dataInicio ?? ''))
        .slice(0, 10)
        .map((o) => ({
          sigla: o.siglaOrgao,
          nome: o.nomeOrgao || o.siglaOrgao,
        }))
    } catch (error) {
      erros.push(
        `orgaos: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    try {
      despesasPorAno = {}
      for (const leg of dep.legs) {
        const despesas = await fetchDespesas(dep.id, leg)
        for (const item of despesas) {
          despesasPorAno[String(item.ano)] =
            (despesasPorAno[String(item.ano)] ?? 0) + item.valorLiquido
        }
      }
    } catch (error) {
      erros.push(
        `despesas: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    if (erros.length > 0) {
      console.log(`[camara] aviso ${dep.id} (${dep.nome}): ${erros.join('; ')}`)
    }

    for (const leg of dep.legs) {
      const period = LEGISLATURAS.find((item) => item.id === leg)!
      mandates.push({
        candidateId,
        casa: 'camara',
        legislatura: String(leg),
        idParlamentar: dep.id,
        nomeParlamentar: dep.nome,
        partido: dep.partidos[leg] ?? null,
        uf: dep.ufs[leg] ?? null,
        dataInicio: period.dataInicio,
        dataFim: period.dataFim,
      })
    }

    records.push({
      candidateId,
      casa: 'camara',
      proposicoesPorAno,
      comissoes,
      despesasPorAno,
    })
  }
  console.log(
    `[camara] records: ${records.length} (mandatos: ${mandates.length})`,
  )

  // ---------- Senado: mandatos por legislatura ----------
  const senadoresByCodigo = new Map<
    number,
    {
      nome: string
      partido: string | null
      mandatos: Map<
        number,
        {
          uf: string
          partido: string | null
          dataInicio: string
          dataFim: string
        }
      >
    }
  >()

  for (const leg of LEGISLATURAS) {
    let senadores: SenadorLista[] = []
    try {
      senadores = await fetchSenadoresPorLegislatura(leg.id)
    } catch (error) {
      console.log(
        `[senado] aviso legislatura ${leg.id}: ` +
          (error instanceof Error ? error.message : String(error)),
      )
    }
    console.log(`[senado] legislatura ${leg.id}: ${senadores.length} senadores`)
    for (const senador of senadores) {
      let entry = senadoresByCodigo.get(senador.codigo)
      if (!entry) {
        entry = {
          nome: senador.nomeCompleto || senador.nome,
          partido: null,
          mandatos: new Map(),
        }
        senadoresByCodigo.set(senador.codigo, entry)
      }
      const mando = senador.mandatos.find((m) => m.legislatura === leg.id)
      entry.mandatos.set(leg.id, {
        uf: mando?.uf ?? '',
        partido: senador.partido || null,
        dataInicio: mando?.dataInicio ?? '',
        dataFim: mando?.dataFim ?? '',
      })
    }
  }
  console.log(`[senado] ${senadoresByCodigo.size} senadores únicos (2015-2026)`)

  const senadoPeople = [...senadoresByCodigo.entries()].map(
    ([codigo, senador]) => ({
      id: codigo,
      nome: senador.nome,
      dataNascimento: null,
    }),
  )
  const { matched: matchedSenado } = matchHistoryPeople(
    candidates,
    senadoPeople,
  )

  let senadoMatched = 0
  for (const [codigo, candidateId] of matchedSenado) {
    const senador = senadoresByCodigo.get(codigo)!
    for (const [leg, mando] of senador.mandatos) {
      const period = LEGISLATURAS.find((item) => item.id === leg)!
      mandates.push({
        candidateId,
        casa: 'senado',
        legislatura: String(leg),
        idParlamentar: codigo,
        nomeParlamentar: senador.nome,
        partido: mando.partido,
        uf: mando.uf || null,
        dataInicio: period.dataInicio,
        dataFim: period.dataFim,
      })
    }
    records.push({
      candidateId,
      casa: 'senado',
      proposicoesPorAno: {},
      comissoes: [],
      despesasPorAno: {},
    })
    senadoMatched += 1
  }
  console.log(`[senado] casamentos: ${senadoMatched}`)

  // ---------- Votos em votações-chave (Câmara) ----------
  const votes: ParliamentaryVote[] = []
  const camaraIdsPerCandidate = new Map<string, number>()
  for (const [camaraId, candidateId] of camaraToCandidate) {
    camaraIdsPerCandidate.set(candidateId, camaraId)
  }

  for (const pauta of PAUTAS_CHAVE) {
    const votoPorDeputado = new Map<number, VotoValor | null>()
    let votos: Awaited<ReturnType<typeof fetchVotosVotacao>> = []
    try {
      votos = await fetchVotosVotacao(pauta.votacaoId)
    } catch (error) {
      console.log(
        `[votos] aviso ${pauta.tema}: ` +
          (error instanceof Error ? error.message : String(error)),
      )
    }
    for (const item of votos) {
      votoPorDeputado.set(item.idDeputado, normalizeVoto(item.voto))
    }

    // Votação simbólica/sem registro nominal: não gera dados por candidato.
    if (votos.length === 0) {
      console.log(
        `[votos] ${pauta.tema}: sem registro nominal de votos, pulada`,
      )
      continue
    }

    for (const [candidateId, camaraId] of camaraIdsPerCandidate) {
      votes.push({
        candidateId,
        votacaoId: pauta.votacaoId,
        tema: pauta.tema,
        rotulo: pauta.rotulo,
        proposicao: pauta.proposicaoLabel,
        data: pauta.data,
        casa: pauta.casa,
        voto: votoPorDeputado.get(camaraId) ?? null,
      })
    }
    console.log(
      `[votos] ${pauta.tema}: ${votos.length} registrados, gravados p/ ${camaraIdsPerCandidate.size} candidatos`,
    )
  }

  const data: ParliamentaryData = { mandates, records, votes }
  replaceParliamentary(db, data)
  console.log(
    `[ficha] gravados ${mandates.length} mandatos, ${records.length} registros, ${votes.length} votos`,
  )
} finally {
  db.close()
}
