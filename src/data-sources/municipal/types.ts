/**
 * Domínio da camada municipal: mandato de vereador e atuação legislativa em
 * Câmaras Municipais.
 *
 * Separado do modelo do TSE (`tse/history.ts`) e da camada federal
 * (`parliament/types.ts`) de propósito. O mandato de vereador já vem
 * comprovado pelo histórico eleitoral do TSE (`political_mandates`); o que esta
 * camada acrescenta é a **atividade legislativa** e o **período efetivo** do
 * mandato, que só a Câmara tem.
 *
 * Regra que atravessa o arquivo: nenhuma informação sem `source`, e nenhum
 * vínculo entre duas pessoas sem `matchingStatus` (§8).
 */

/** Nível da casa legislativa — mantém municipal e federal separados (§7). */
export type LegislativeLevel = 'municipal' | 'state' | 'federal'

/** Cargo legislativo. O histórico do TSE usa grafia com espaço; aqui, hífen. */
export type LegislativeOffice =
  | 'vereador'
  | 'deputado-estadual'
  | 'deputado-federal'
  | 'senador'

/** Como a Câmara publica (ou deveria publicar) os dados (§4). */
export type MunicipalChamberSourceType =
  | 'sapl'
  | 'official-api'
  | 'open-data'
  | 'csv'
  | 'official-web'
  | 'unknown'

/**
 * Estado de acesso verificado em uma data. Distingue "não existe fonte" de
 * "existe, mas não dá para ler sem credencial" — informação que o leitor
 * precisa ter.
 */
export type MunicipalSourceAccess =
  /** API respondeu JSON na verificação. */
  | 'verified'
  /** Fonte existe, mas exige credencial (ex.: token de acesso). */
  | 'requires-auth'
  /** Existe e é pública, mas bloqueia acesso automatizado (ex.: WAF). */
  | 'blocked'
  /** Só publica HTML, sem formato estruturado; exigiria raspar a página. */
  | 'html-only'
  /** Nenhuma fonte localizada na verificação. */
  | 'not-found'

/** O que a fonte entrega. Preenchido pelo sync a partir do que respondeu. */
export interface MunicipalCapabilities {
  legislators: boolean
  legislatures: boolean
  mandates: boolean
  bills: boolean
  sessions: boolean
  attendance: boolean
  votes: boolean
  committees: boolean
  speeches: boolean
}

/** Nenhuma capacidade verificada: o padrão é não afirmar o que não se viu. */
export const NO_CAPABILITIES: Readonly<MunicipalCapabilities> = Object.freeze({
  legislators: false,
  legislatures: false,
  mandates: false,
  bills: false,
  sessions: false,
  attendance: false,
  votes: false,
  committees: false,
  speeches: false,
})

/**
 * Uma Câmara Municipal e a forma de falar com ela.
 *
 * O registry existe porque a infraestrutura é heterogênea: não há API
 * nacional, e não se deve adivinhar URL — toda `apiBaseUrl` aqui foi
 * verificada antes de ser escrita.
 */
export interface MunicipalChamberSource {
  /** Código IBGE de 7 dígitos (fonte: API de localidades do IBGE). */
  municipalityIbgeCode: string
  municipalityName: string
  state: string

  chamberName: string
  /** null quando a fonte não foi localizada — não inventar URL. */
  chamberUrl: string | null

  sourceType: MunicipalChamberSourceType
  /**
   * Raiz da API **sem** o sufixo `/api/`. O SAPL responde em `<raiz>/api/`,
   * então a barra final fica por conta do client.
   */
  apiBaseUrl: string | null
  access: MunicipalSourceAccess

  capabilities: MunicipalCapabilities
  lastVerifiedAt: string | null
  /** Por que a fonte está bloqueada/ausente, em português. */
  note?: string
}

/**
 * Referência à fonte de um dado municipal (§16). `retrievedAt` e `url`
 * permitem abrir a origem; `publisher` identifica o órgão responsável.
 */
export interface MunicipalSourceRef {
  id: string
  title: string
  url: string
  publisher: string
  sourceType: 'official-chamber' | 'official-api' | 'official-document' | 'other'
  publishedAt: string | null
  retrievedAt: string
}

/**
 * Pessoa registrada na Câmara (não confundir com o candidato do TSE).
 *
 * `fullName` é o nome civil quando a Câmara o publica; senão é o nome de
 * gabinete. `alternateName` guarda o outro, porque o casamento precisa tentar
 * os dois: em Castro, por exemplo, os 32 cadastro têm `nome_completo` vazio e
 * só o nome de gabinete preenchido.
 */
export interface MunicipalLegislator {
  sourceId: string
  sourcePersonId: string
  fullName: string
  /** O outro nome publicado pela Câmara, quando existir. */
  alternateName: string | null
  municipalityIbgeCode: string
}

/**
 * Mandato municipal (§9).
 *
 * `startDate`/`endDate` vêm da Câmara (período efetivo). O histórico do TSE
 * só traz o ano da eleição — são fatos diferentes e ficam guardados separados.
 */
export interface MunicipalMandate {
  legislatureId: string
  municipalityIbgeCode: string
  sourceId: string
  sourceMandateId: string
  /**
   * Parlamentar do SAPL a quem o mandato pertence (`sourcePersonId` no
   * cadastro). Sem isto o mandato fica órfão e o período não pode ser
   * atribuído a ninguém.
   */
  sourcePersonId: string | null

  office: string
  legislatureLabel: string | null
  startDate: string | null
  endDate: string | null
  /** false quando o registro é de suplente que não exerceu. */
  titular: boolean | null
  party: string | null
  /** Cargos na Mesa/comissões, como a fonte informa. Nada é inferido. */
  roles: string[]
  source: MunicipalSourceRef
}

/** Confiança no vínculo entre candidato do TSE e vereador da Câmara (§8). */
export type MatchingStatus = 'confirmed' | 'probable' | 'unresolved'

/** Como o vínculo foi estabelecido, em ordem de força (§8). */
export type MatchingMethod =
  | 'sq-candidato'
  | 'exact-name-plus-context'
  | 'manual-confirmation'
  | 'other'

/**
 * Vínculo candidato -> vereador. `matchingStatus` decide o que a ficha pode
 * afirmar: nada com `unresolved`.
 */
export interface MunicipalLegislatorIdentity {
  candidateId: string
  sourceId: string
  sourcePersonId: string | null

  fullName: string
  municipalityIbgeCode: string

  matchingStatus: MatchingStatus
  matchingMethod: MatchingMethod
  /** Texto que explica a decisão, para auditoria. */
  matchingEvidence: string | null
  verifiedAt: string
}

/**
 * Interface comum das fontes legislativas municipais (§5).
 *
 * Só a Fase 1 está implementada. As entradas de Phase 4 (matérias, presenças,
 * votações, comissões) entram aqui conforme o SAPL confirmar o formato; até
 * lá, uma fonte que não suporta a operação diz isso, em vez de devolver vazio
 * — "não achei" e "essa fonte não tem" são respostas diferentes.
 */
export interface MunicipalLegislativeSource {
  readonly chamber: MunicipalChamberSource
  listMandates(): Promise<MunicipalMandate[]>
  findLegislators(): Promise<MunicipalLegislator[]>
}

/** Erro de operação não suportada pela fonte. */
export class MunicipalCapabilityError extends Error {
  readonly capability: keyof MunicipalCapabilities

  constructor(capability: keyof MunicipalCapabilities, chamberName: string) {
    super(`A fonte de ${chamberName} não oferece a capacidade "${capability}"`)
    this.name = 'MunicipalCapabilityError'
    this.capability = capability
  }
}
