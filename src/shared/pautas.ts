/**
 * Votações-chave usadas na ficha comparável por candidato.
 *
 * São proposições reais deliberadas no Plenário da Câmara na legislatura
 * 2023-2026, escolhidas por tema. Cada entrada aponta para uma votação
 * nominal registrada na API de Dados Abertos da Câmara (/votacoes/{id}/votos),
 * da qual extraímos o voto (Sim/Não/Abstenção/Obstrução) de cada deputado.
 *
 * A lista é deliberadamente pequena e revisável: serve como referência de
 * posicionamento em questões relevantes, nunca como opinião editada do app.
 */

export type PautaCasa = 'camara'

export interface PautaChave {
  /** Identificador do tema (agenda da ficha). */
  tema: string
  /** Nome legível da votação, com a data, para exibição. */
  rotulo: string
  /** Proposição votada (ex.: "PEC 45/2019"). */
  proposicaoLabel: string
  /** Id da proposição na API da Câmara. */
  proposicaoId: number
  /** Id da votação nominal na API da Câmara. */
  votacaoId: string
  /** Data da votação (AAAA-MM-DD). */
  data: string
  casa: PautaCasa
}

export const PAUTAS_CHAVE: readonly PautaChave[] = [
  {
    tema: 'reforma-tributaria',
    rotulo: 'Reforma tributária (PEC 45/2019) — votação nominal em Plenário',
    proposicaoLabel: 'PEC 45/2019',
    proposicaoId: 2196833,
    votacaoId: '2196833-395',
    data: '2023-07-07',
    casa: 'camara',
  },
  {
    tema: 'marco-temporal',
    rotulo:
      'Marco temporal (PL 490/2007) — aprovação do texto-base em Plenário',
    proposicaoLabel: 'PL 490/2007',
    proposicaoId: 345311,
    votacaoId: '345311-270',
    data: '2023-05-30',
    casa: 'camara',
  },
  {
    tema: 'plataformas',
    rotulo:
      'Regulação das plataformas (PL 2630/2020) — requerimento de urgência',
    proposicaoLabel: 'PL 2630/2020',
    proposicaoId: 2256735,
    votacaoId: '2310837-8',
    data: '2023-04-25',
    casa: 'camara',
  },
]

/** Mapas tema -> nome legível, usado na exibição e no export. */
export const TEMA_LABEL: Record<string, string> = {
  'reforma-tributaria': 'Reforma tributária',
  'marco-temporal': 'Marco temporal',
  plataformas: 'Regulação das plataformas (fake news)',
}
