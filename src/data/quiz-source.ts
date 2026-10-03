/**
 * Fonte oficial do quiz (data-driven).
 *
 * As perguntas de perfil saem do TSE e valem para qualquer UF. As de pauta
 * saem de votações nominais da Câmara (voto do candidato, senão a orientação
 * do partido). Cada pergunta declara o texto, as opções, um resolvedor puro
 * e a proveniência.
 *
 * Regras documentadas em docs/quiz-design.md.
 */

import rawPautas from '../../content/quiz/pautas-quiz.json' with { type: 'json' }
import type {
  ApiCandidate,
  ApiQuizMetrics,
  ApiQuizPosition,
} from '../shared/api.ts'
import { parsePautasQuiz, type PautaQuiz } from '../shared/quiz-pautas.ts'
import { alignmentBucket, trajetoriaBucket } from '../shared/quiz-metrics.ts'
import { stateByCode, type BrazilState } from './brazil-map.ts'
import type {
  Candidate,
  CandidateFact,
  Option,
  OptionId,
  Question,
  QuestionId,
} from './quiz.ts'

const PAUTAS: readonly PautaQuiz[] = parsePautasQuiz(rawPautas)

/** Campos do candidato necessários para montar o perfil do quiz. */
export type ProfileSource = Pick<
  ApiCandidate,
  'occupation' | 'birthDate' | 'candidacyType' | 'birthState'
> & {
  quizPositions?: readonly ApiQuizPosition[]
  quizMetrics?: ApiQuizMetrics | null
  partyAcronym?: string | null
}

const DEPUTADO_RE = /\bDEPUTADO\b/i
const MANDATO_ELEITO_RE = /\b(VEREADOR|SENADOR|GOVERNADOR|PREFEITO)\b/i

export type SectorId =
  | 'politica-e-gestao'
  | 'saude'
  | 'educacao'
  | 'direito'
  | 'economia'
  | 'seguranca'
  | 'agro'
  | 'comunicacao'
  | 'servicos'
  | 'outros'

/** Classificação por setor, derivada da ocupação declarada. */
export function resolveSector(occupation: string | null): SectorId {
  const o = (occupation ?? '').trim().toUpperCase()
  const rules: readonly [RegExp, SectorId][] = [
    [
      /\b(DEPUTADO|VEREADOR|SENADOR|GOVERNADOR|PREFEITO|MINISTRO|SECRETÁRIO|AGENTE ADMINISTRATIVO|AGENTE POSTAL|SERVIDOR PÚBLICO (CIVIL|ESTADUAL|FEDERAL|MUNICIPAL))/,
      'politica-e-gestao',
    ],
    [
      /\b(MÉDICO|ENFERMEIR|ENFERMAGEM|FISIOTERAP|ODONTÓLOG|BIOMÉDIC|FONOAUDIÓLOG|FARMACÊUTIC|PSICÓLOG|ASSISTENTE SOCIAL|SANITARISTA|TERAPEUTA|ESTETICISTA|VETERINÁRIO)/,
      'saude',
    ],
    [
      /\b(PROFESSOR|PEDAGOG|DIRETOR DE ESTABELECIMENTO DE ENSINO|INSPETOR ALUNO)/,
      'educacao',
    ],
    [/\bADVOGADO/, 'direito'],
    [
      /\b(EMPRESÁRIO|COMERCIANTE|ADMINISTRADOR|DIRETOR DE EMPRESAS|CONTADOR|CORRETOR|BANCÁRIO|ECONOMISTA|ANALISTA|CONSULTOR|AUXILIAR DE ESCRITÓRIO)/,
      'economia',
    ],
    [
      /\b(POLICIAL|BOMBEIRO|MILITAR|VIGILANTE|GUARDA|FORÇAS ARMADAS)/,
      'seguranca',
    ],
    [
      /\b(AGRICULTOR|PECUARISTA|PRODUTOR AGRO|ENGENHEIRO AGRÔNOMO|ZOOTECNISTA)/,
      'agro',
    ],
    [
      /\b(JORNALISTA|LOCUTOR|RADIALISTA|MÚSICO|ARTISTA|PUBLICITÁRIO|FOTÓGRAFO|CANTOR|ESCULTOR|DECORADOR|ATLETA|CIENTISTA POLÍTICO|TÉCNICO EM COMUNICAÇÃO)/,
      'comunicacao',
    ],
    [
      /\b(MOTORISTA|MECÂNICO|MOTOBOY|ELETRICISTA|CONSTRUÇÃO|PEDREIRO|RECEPCIONISTA|TÉCNICO|CABELEIREIRO|DONA DE CASA|VENDEDOR|OPERADOR|OPERÁRIO|PORTEIRO|COZINHEIR|MASSAGISTA|TATUADOR)/,
      'servicos',
    ],
  ]
  for (const [re, id] of rules) {
    if (re.test(o)) return id
  }
  return 'outros'
}

export type ExperienceId = 'ja-deputado' | 'outro-mandato' | 'sem-mandato'

/** Experiência política prévia, derivada da ocupação declarada. */
export function resolveExperience(occupation: string | null): ExperienceId {
  const o = (occupation ?? '').trim()
  if (DEPUTADO_RE.test(o)) return 'ja-deputado'
  if (MANDATO_ELEITO_RE.test(o)) return 'outro-mandato'
  return 'sem-mandato'
}

export type AgeBandId = 'ate-39' | '40-49' | '50-59' | '60-mais'

const ELECTION_DATE = new Date('2026-10-04T00:00:00Z')

function ageAtElection(birthDate: string | null): number | null {
  if (!birthDate) return null
  const birth = new Date(birthDate)
  if (Number.isNaN(birth.getTime())) return null
  let age = ELECTION_DATE.getUTCFullYear() - birth.getUTCFullYear()
  const before = new Date(ELECTION_DATE)
  before.setUTCFullYear(birth.getUTCFullYear())
  if (before.getTime() < birth.getTime()) age -= 1
  return age
}

/** Faixa etária na data da eleição, derivada da data de nascimento. */
export function resolveAgeBand(birthDate: string | null): AgeBandId | null {
  const age = ageAtElection(birthDate)
  if (age === null) return null
  if (age <= 39) return 'ate-39'
  if (age <= 49) return '40-49'
  if (age <= 59) return '50-59'
  return '60-mais'
}

export type CandidacyId = 'federacao' | 'isolado'

/** Tipo de agremiação da candidatura. */
export function resolveCandidacy(candidacyType: string | null): CandidacyId {
  const t = (candidacyType ?? '').trim().toUpperCase()
  return t === 'FEDERAÇÃO' ? 'federacao' : 'isolado'
}

export type LocalId = 'aqui' | 'fora'

/** Vínculo territorial: nascido na UF da eleição, ou fora dela. */
export function resolveLocal(
  birthState: string | null,
  electionState: string,
): LocalId {
  const birth = (birthState ?? '').trim().toUpperCase()
  const election = electionState.trim().toUpperCase()
  return birth !== '' && birth === election ? 'aqui' : 'fora'
}

interface QuestionDefinition {
  id: QuestionId
  kind: Question['kind']
  title: string
  hint: string
  options: readonly Option[]
  resolve: (source: ProfileSource) => OptionId | null
  fact: (source: ProfileSource) => CandidateFact | null
}

const SECTORS: readonly { readonly id: SectorId; readonly label: string }[] = [
  { id: 'politica-e-gestao', label: 'Política e gestão pública' },
  { id: 'saude', label: 'Saúde' },
  { id: 'educacao', label: 'Educação' },
  { id: 'direito', label: 'Direito' },
  { id: 'economia', label: 'Negócios e economia' },
  { id: 'seguranca', label: 'Segurança pública' },
  { id: 'agro', label: 'Agropecuária' },
  { id: 'comunicacao', label: 'Comunicação e cultura' },
  { id: 'servicos', label: 'Serviços e trabalho' },
  { id: 'outros', label: 'Outra área' },
]

const sectorOptions: readonly Option[] = SECTORS.map(({ id, label }) => ({
  id: `setor:${id}`,
  label,
}))

const options = {
  sector: sectorOptions,
  trajetoria: [
    { id: 'trajetoria:renovacao', label: 'Um nome novo, sem mandato anterior' },
    {
      id: 'trajetoria:alguma-experiencia',
      label: 'Alguém com um ou dois mandatos',
    },
    {
      id: 'trajetoria:carreira-longa',
      label: 'Alguém com uma trajetória longa na política',
    },
  ] as readonly Option[],
  alinhamento: [
    {
      id: 'alinhamento:governista',
      label: 'Quem costuma votar com o governo',
    },
    {
      id: 'alinhamento:independente',
      label: 'Quem fica no meio, nem sempre com o governo nem sempre contra',
    },
    {
      id: 'alinhamento:oposicao',
      label: 'Quem costuma votar contra a orientação do governo',
    },
  ] as readonly Option[],
  age: [
    { id: 'idade:ate-39', label: 'Até 39 anos' },
    { id: 'idade:40-49', label: 'Entre 40 e 49 anos' },
    { id: 'idade:50-59', label: 'Entre 50 e 59 anos' },
    { id: 'idade:60-mais', label: '60 anos ou mais' },
  ] as readonly Option[],
  candidacy: [
    { id: 'agremiacao:federacao', label: 'Federação partidária' },
    { id: 'agremiacao:isolado', label: 'Partido isolado' },
  ] as readonly Option[],
} as const

function localOptions(state: BrazilState): readonly Option[] {
  return [
    { id: 'local:aqui', label: `Nascido(a) ${state.locative}` },
    { id: 'local:fora', label: 'Nascido(a) em outro estado' },
  ]
}

function noFact(): null {
  return null
}

function stanceOptions(pautaId: string): readonly Option[] {
  return [
    { id: `pauta:${pautaId}:concordo`, label: 'Concordo' },
    { id: `pauta:${pautaId}:discordo`, label: 'Discordo' },
    { id: `pauta:${pautaId}:tanto-faz`, label: 'Tanto faz' },
  ]
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-')
  if (!year || !month || !day) return iso
  return `${day}/${month}/${year}`
}

function stanceFact(
  pauta: PautaQuiz,
  position: ApiQuizPosition | undefined,
): CandidateFact | null {
  if (!position || !position.origin) {
    return {
      text: 'Sem voto nominal deste candidato nem orientação do partido para esta votação.',
      sourceUrl: pauta.source,
      origin: null,
    }
  }
  const when = formatDate(pauta.data)
  if (position.origin === 'candidato') {
    const verbo =
      position.voto === 'Sim' || position.voto === 'Não'
        ? `Votou ${position.voto}`
        : `Registrou ${position.voto ?? 'voto'}`
    return {
      text: `${verbo} em ${when} (${pauta.proposicaoLabel}).`,
      sourceUrl: position.sourceUrl ?? pauta.source,
      origin: 'candidato',
    }
  }
  const party = position.partyAcronym ?? 'o partido'
  const lado = position.value === 'sim' ? 'Sim' : 'Não'
  return {
    text: `Partido ${party} orientou ${lado} em ${when} (${pauta.proposicaoLabel}).`,
    sourceUrl: position.sourceUrl ?? pauta.source,
    origin: 'partido',
  }
}

function questionsOf(state: BrazilState): readonly QuestionDefinition[] {
  return [
    {
      id: 'sector',
      kind: 'profile',
      title:
        'Que experiência profissional você quer em quem vai te representar?',
      hint: 'Derivado da ocupação declarada ao TSE.',
      options: options.sector as readonly Option[],
      resolve: (s) => {
        const id = resolveSector(s.occupation)
        return `setor:${id}` as OptionId
      },
      fact: noFact,
    },
    {
      id: 'trajetoria',
      kind: 'profile',
      title: 'Você prefere manter quem já está na política ou um nome novo?',
      hint: 'Contagem de mandatos eleitos ou suplentes no TSE desde 2004. O mandato atual entra quando o deputado em exercício ainda não aparece nesse histórico.',
      options: options.trajetoria as readonly Option[],
      resolve: (s) => {
        const metrics = s.quizMetrics
        if (!metrics) return null
        return `trajetoria:${trajetoriaBucket(metrics.trajetoria)}` as OptionId
      },
      fact: (s) => {
        const metrics = s.quizMetrics
        if (!metrics) return null
        return {
          text: `${metrics.trajetoria} mandato(s) eleito(s) ou suplente(s) no TSE desde 2004.`,
          sourceUrl: 'https://dadosabertos.tse.jus.br/dataset/candidatos-2024',
          origin: 'metrica',
        }
      },
    },
    {
      id: 'alinhamento',
      kind: 'profile',
      title:
        'Nas votações em que o governo orientou o voto, você prefere quem acompanha, quem fica no meio ou quem vota contra?',
      hint: 'Proporção de votos iguais à orientação do Governo na 57ª legislatura. Usa o voto do candidato quando há pelo menos 5; senão, a orientação do partido. Governista é 70% ou mais; oposição é 30% ou menos.',
      options: options.alinhamento as readonly Option[],
      resolve: (s) => {
        const bucket = alignmentBucket(s.quizMetrics?.alinhamentoGoverno ?? null)
        return bucket ? (`alinhamento:${bucket}` as OptionId) : null
      },
      fact: (s) => {
        const rate = s.quizMetrics?.alinhamentoGoverno
        if (rate === null || rate === undefined) return null
        const origem =
          s.quizMetrics?.alinhamentoOrigem === 'candidato'
            ? 'voto do candidato'
            : 'orientação do partido'
        return {
          text: `Acompanhou a orientação do Governo em ${Math.round(rate * 100)}% das votações comparáveis (${origem}).`,
          sourceUrl:
            'https://dadosabertos.camara.leg.br/arquivos/votacoesOrientacoes/csv/',
          origin: 'metrica',
        }
      },
    },
    {
      id: 'age',
      kind: 'profile',
      title: 'Você prefere um representante da sua geração?',
      hint: 'Derivado da data de nascimento do TSE.',
      options: options.age as readonly Option[],
      resolve: (s) => {
        const id = resolveAgeBand(s.birthDate)
        return id ? (`idade:${id}` as OptionId) : null
      },
      fact: noFact,
    },
    {
      id: 'candidacy',
      kind: 'profile',
      title: 'Você dá preferência a federação partidária ou partido isolado?',
      hint: 'Derivado do tipo de agremiação no TSE.',
      options: options.candidacy as readonly Option[],
      resolve: (s) =>
        `agremiacao:${resolveCandidacy(s.candidacyType)}` as OptionId,
      fact: noFact,
    },
    {
      id: 'local',
      kind: 'profile',
      title: `Você valoriza um candidato nascido ${state.locative}?`,
      hint: 'Derivado da UF de nascimento do TSE.',
      options: localOptions(state),
      resolve: (s) =>
        `local:${resolveLocal(s.birthState, state.code)}` as OptionId,
      fact: noFact,
    },
    ...PAUTAS.map(
      (pauta): QuestionDefinition => ({
        id: `pauta:${pauta.id}`,
        kind: 'stance',
        title: pauta.pergunta,
        hint: pauta.contexto,
        options: stanceOptions(pauta.id),
        resolve: (s) => {
          const position = s.quizPositions?.find(
            (item) => item.pautaId === pauta.id,
          )
          if (!position?.value) return null
          return `pauta:${pauta.id}:${position.value}` as OptionId
        },
        fact: (s) =>
          stanceFact(
            pauta,
            s.quizPositions?.find((item) => item.pautaId === pauta.id),
          ),
      }),
    ),
  ]
}

function toQuestion(question: QuestionDefinition): Question {
  return {
    id: question.id,
    kind: question.kind,
    title: question.title,
    hint: question.hint,
    options: question.options,
  }
}

/** Perguntas do quiz para a UF escolhida. A de nascimento usa o nome do estado. */
export function questionsFor(state: BrazilState): readonly Question[] {
  return questionsOf(state).map(toQuestion)
}

const paranaState = stateByCode('PR')
if (!paranaState) throw new Error('UF PR ausente da malha')
const PARANA: BrazilState = paranaState

/** Perguntas do Paraná — o mesmo formato das outras UFs, com o locativo local. */
export const quizQuestions: readonly Question[] = questionsFor(PARANA)

const QUESTION_IDS = quizQuestions.map((q) => q.id) as QuestionId[]

function stateQuestions(electionState: string): readonly QuestionDefinition[] {
  const state = stateByCode(electionState)
  if (!state) throw new Error(`UF desconhecida: ${electionState}`)
  return questionsOf(state)
}

/**
 * Perfil do candidato. Dimensão sem dado fica `null` e não entra na conta.
 */
export function buildProfile(
  source: ProfileSource,
  electionState: string,
): Record<QuestionId, OptionId | null> {
  const profile = {} as Record<QuestionId, OptionId | null>
  for (const question of stateQuestions(electionState)) {
    const optionId = question.resolve(source)
    if (
      optionId !== null &&
      !question.options.some((option) => option.id === optionId) &&
      !optionId.endsWith(':sim') &&
      !optionId.endsWith(':nao')
    ) {
      profile[question.id] = null
      continue
    }
    profile[question.id] = optionId
  }
  return profile
}

export function buildFacts(
  source: ProfileSource,
  electionState: string,
): Record<QuestionId, CandidateFact | null> {
  const facts = {} as Record<QuestionId, CandidateFact | null>
  for (const question of stateQuestions(electionState)) {
    facts[question.id] = question.fact(source)
  }
  return facts
}

/** Nome estável (chave) do perfil completo — usado no desempate por raridade. */
export function profileKey(
  profile: Record<QuestionId, OptionId | null>,
): string {
  return QUESTION_IDS.map((id) => profile[id] ?? 'sem-dado').join('|')
}

/** Proveniência de cada resposta do candidato, exibida no detalhe do resultado. */
export function questionProvenance(questionId: QuestionId): string {
  const question = questionsOf(PARANA).find((q) => q.id === questionId)
  return question?.hint ?? 'Fonte não disponível.'
}

/** Converte um candidato da API em um participante do quiz, com perfil resolvido. */
export function toQuizCandidate(
  api: ApiCandidate,
  electionState: string,
): Candidate {
  return {
    id: api.id,
    name: api.ballotName,
    description: describeCandidate(api),
    photo: api.photoUrl ?? undefined,
    ballotNumber: api.ballotNumber,
    partyAcronym: api.partyAcronym,
    profile: buildProfile(api, electionState),
    facts: buildFacts(api, electionState),
  }
}

export function toQuizCandidates(
  list: readonly ApiCandidate[],
  electionState: string,
): readonly Candidate[] {
  return list.map((api) => toQuizCandidate(api, electionState))
}

function describeCandidate(api: ApiCandidate): string {
  return [api.partyAcronym ?? 'partido não informado', api.occupation ?? '']
    .filter(Boolean)
    .join(' · ')
}
