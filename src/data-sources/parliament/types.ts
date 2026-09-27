/**
 * Tipos da camada parlamentar da ficha comparável (Câmara e Senado).
 *
 * Separados do modelo do TSE: os dados vêm das APIs oficiais de cada Casa
 * e são gerados por scripts de sincronização próprios.
 */

export type CasaParlamentar = 'camara' | 'senado'

export interface ParliamentaryMandate {
  candidateId: string
  casa: CasaParlamentar
  /** Número da legislatura (ex.: "57"). */
  legislatura: string
  /** Id do parlamentar na Casa (idDeputado / CodigoParlamentar). */
  idParlamentar: number
  nomeParlamentar: string
  partido: string | null
  uf: string | null
  dataInicio: string | null
  dataFim: string | null
}

/** Lista de comissões de que o parlamentar fez/faz parte (siglas legíveis). */
export interface Comissao {
  sigla: string
  nome: string
}

export interface ParliamentaryRecord {
  candidateId: string
  casa: CasaParlamentar
  /** Proposições de autoria, contadas por ano (e.g. {"2023": 4}). */
  proposicoesPorAno: Record<string, number>
  /** Comissões do parlamentar. */
  comissoes: Comissao[]
  /** Despesas/ressarcimentos (cota parlamentar etc.) por ano, em R$. */
  despesasPorAno: Record<string, number>
}

export type VotoValor = 'Sim' | 'Não' | 'Abstenção' | 'Obstrução'

export interface ParliamentaryVote {
  candidateId: string
  votacaoId: string
  tema: string
  rotulo: string
  proposicao: string
  data: string
  casa: CasaParlamentar
  /** null = parlamentar não registrou voto naquela votação. */
  voto: VotoValor | null
}

export interface ParliamentaryData {
  mandates: ParliamentaryMandate[]
  records: ParliamentaryRecord[]
  votes: ParliamentaryVote[]
}