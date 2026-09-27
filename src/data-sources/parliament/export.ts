/**
 * Monta a linha exportável da ficha comparável, juntando:
 *   - dados do TSE (CandidateRecord),
 *   - incumbência (incumbents),
 *   - histórico parlamentar (mandatos, métricas, votos),
 *   - camada editorial (content/editorial/<id>.json).
 *
 * Usada pelo scripts/export-ficha.ts e pelos testes.
 */

import type { CandidateRecord } from '../../shared/domain.ts'
import type { IncumbentRow } from '../repository.ts'
import type {
  ParliamentaryVote,
  VotoValor,
} from './types.ts'
import {
  EDITORIAL_THEMES,
  hasEvidence,
  tipoEvidenciaLabel,
  type EditorialFicha,
} from '../../shared/ficha.ts'
import { PAUTAS_CHAVE } from '../../shared/pautas.ts'

export interface ParliamentSummary {
  mandates: Array<{ casa: string; legislatura: string; partido: string | null; uf: string | null }>
  records: Array<{
    casa: string
    proposicoesPorAno: Record<string, number>
    comissoes: Array<{ sigla: string; nome: string }>
    despesasPorAno: Record<string, number>
  }>
  votes: ParliamentaryVote[]
}

export interface FichaExportada {
  id: string
  nome_urna: string
  nome_completo: string
  numero: string
  partido_sigla: string | null
  partido_nome: string | null
  situacao: string | null
  ocupacao: string | null
  escolaridade: string | null
  natural_de: string | null
  sexo: string | null
  cor_raca: string | null
  quilombola: 'Sim' | 'Não' | null
  etnia_indigena: string | null
  bens_declarados_reais: number | null
  teto_gastos_reais: number | null
  redes_sociais: string | null
  tem_historico_parlamentar: 'Sim' | 'Não'
  deputado_atual: 'Sim' | 'Não'
  camara_legislaturas: string | null
  camara_proposicoes_total: number | null
  camara_proposicoes_por_ano: string | null
  camara_comissoes: string | null
  camara_despesas_total_reais: number | null
  camara_despesas_por_ano: string | null
  senado_legislaturas: string | null
  [votoKey: `voto_${string}`]: string
  [posicaoKey: `posicao_${string}`]: string
}

const SEM_EVIDENCIA = 'não encontrei evidência suficiente'

function simNao(value: boolean | null): 'Sim' | 'Não' | null {
  if (value === null) return null
  return value ? 'Sim' : 'Não'
}

function sumValues(value: Record<string, number>): number {
  return Object.values(value).reduce((acc, item) => acc + item, 0)
}

function formatMoney(value: number | null): number | null {
  return value === null ? null : Math.round(value * 100) / 100
}

function votoLabel(voto: VotoValor | null): string {
  if (voto === null) return 'Não registrou voto'
  return voto
}

export function emptyFichaParaCsv(
  candidate: CandidateRecord,
  incumbent: IncumbentRow | undefined,
  parliament: ParliamentSummary | undefined,
  editorial: EditorialFicha | null,
): FichaExportada {
  const linha: FichaExportada = {
    id: candidate.id,
    nome_urna: candidate.ballotName,
    nome_completo: candidate.fullName,
    numero: candidate.ballotNumber,
    partido_sigla: candidate.partyAcronym,
    partido_nome: candidate.party,
    situacao: candidate.status ?? candidate.campaignStatus,
    ocupacao: candidate.occupation,
    escolaridade: candidate.education,
    natural_de:
      candidate.birthMunicipality && candidate.birthState
        ? `${candidate.birthMunicipality} (${candidate.birthState})`
        : candidate.birthState,
    sexo: candidate.gender,
    cor_raca: candidate.race,
    quilombola: simNao(candidate.quilombola),
    etnia_indigena: candidate.indigenousEthnicity,
    bens_declarados_reais: candidate.totalAssets,
    teto_gastos_reais: formatMoney(candidate.campaignSpendingCap),
    redes_sociais:
      candidate.socialLinks.length > 0 ? candidate.socialLinks.join(' | ') : null,
    tem_historico_parlamentar: parliament && parliament.mandates.length > 0 ? 'Sim' : 'Não',
    deputado_atual: incumbent ? 'Sim' : 'Não',
    camara_legislaturas: null,
    camara_proposicoes_total: null,
    camara_proposicoes_por_ano: null,
    camara_comissoes: null,
    camara_despesas_total_reais: null,
    camara_despesas_por_ano: null,
    senado_legislaturas: null,
  }

  const camara = parliament?.records.find((record) => record.casa === 'camara')
  if (camara) {
    linha.camara_proposicoes_total = sumValues(camara.proposicoesPorAno)
    linha.camara_proposicoes_por_ano =
      Object.keys(camara.proposicoesPorAno).length > 0
        ? JSON.stringify(camara.proposicoesPorAno)
        : null
    linha.camara_comissoes =
      camara.comissoes.map((item) => item.sigla || item.nome).join(' | ') || null
    linha.camara_despesas_total_reais =
      sumValues(camara.despesasPorAno) > 0 ? formatMoney(sumValues(camara.despesasPorAno)) : null
    linha.camara_despesas_por_ano =
      Object.keys(camara.despesasPorAno).length > 0
        ? JSON.stringify(camara.despesasPorAno)
        : null
  }

  const camaraMandates = parliament?.mandates.filter((m) => m.casa === 'camara') ?? []
  if (camaraMandates.length > 0) {
    linha.camara_legislaturas = camaraMandates
      .map((m) => `${m.legislatura}ª (${m.partido ?? '?'})`)
      .join(', ')
  }
  const senadoMandates = parliament?.mandates.filter((m) => m.casa === 'senado') ?? []
  if (senadoMandates.length > 0) {
    linha.senado_legislaturas = senadoMandates
      .map((m) => `${m.legislatura}ª (${m.partido ?? '?'})`)
      .join(', ')
  }

  const votePorPauta = new Map(parliament?.votes.map((vote) => [vote.votacaoId, vote]) ?? [])
  for (const pauta of PAUTAS_CHAVE) {
    const vote = votePorPauta.get(pauta.votacaoId)
    const chave: `voto_${string}` = `voto_${pauta.tema}`
    if (!parliament || camaraMandates.length === 0) {
      linha[chave] = 'Sem histórico parlamentar'
    } else if (vote) {
      linha[chave] = votoLabel(vote.voto)
    } else {
      linha[chave] = 'Votação não disponível'
    }
  }

  for (const tema of EDITORIAL_THEMES) {
    const campo = editorial?.campos?.[tema.id]
    const chave: `posicao_${string}` = `posicao_${tema.id}`
    const chaveEvidencia: `posicao_${string}` = `posicao_${tema.id}_evidencia`
    linha[chave] = hasEvidence(campo) && campo ? campo.valor : SEM_EVIDENCIA
    linha[chaveEvidencia] = hasEvidence(campo) && campo
      ? tipoEvidenciaLabel(campo.tipo)
      : 'Sem evidência'
  }

  return linha
}