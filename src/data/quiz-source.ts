/**
 * Fonte oficial do quiz (data-driven).
 *
 * As perguntas são resolvidas exclusivamente a partir de dados oficiais do TSE
 * para os 428 candidatos a deputado federal pelo Paraná em 2026 (100% de
 * cobertura). Cada pergunta declara:
 *   - texto e opções apresentados ao eleitor;
 *   - um resolvedor puro (perfil do candidato -> opção);
 *   - a proveniência exibida na tela de resultado.
 *
 * Regras documentadas em docs/quiz-design.md.
 */

import type { ApiCandidate } from '../shared/api.ts'
import { stateByCode, type BrazilState } from './brazil-map.ts'
import type {
  Candidate,
  Option,
  OptionId,
  Question,
  QuestionId,
} from './quiz.ts'

export class QuizResolutionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'QuizResolutionError'
  }
}

/** Campos do candidato necessários para montar o perfil do quiz. */
export type ProfileSource = Pick<
  ApiCandidate,
  'occupation' | 'birthDate' | 'candidacyType' | 'birthState'
>

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
  title: string
  hint: string
  options: readonly Option[]
  resolve: (source: ProfileSource) => OptionId | null
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
  experience: [
    { id: 'experiencia:ja-deputado', label: 'Já foi deputado(a)' },
    { id: 'experiencia:outro-mandato', label: 'Teve outro mandato eletivo' },
    {
      id: 'experiencia:sem-mandato',
      label: 'Sem mandato anterior (área técnica/empresarial)',
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

function questionsOf(state: BrazilState): readonly QuestionDefinition[] {
  return [
    {
      id: 'sector',
      title:
        'Que experiência profissional você quer em quem vai te representar?',
      hint: 'Derivado da ocupação declarada ao TSE.',
      options: options.sector as readonly Option[],
      resolve: (s) => {
        const id = resolveSector(s.occupation)
        return `setor:${id}` as OptionId
      },
    },
    {
      id: 'experience',
      title: 'Você prefere alguém com mandato político anterior?',
      hint: 'Derivado da ocupação declarada ao TSE.',
      options: options.experience as readonly Option[],
      resolve: (s) =>
        `experiencia:${resolveExperience(s.occupation)}` as OptionId,
    },
    {
      id: 'age',
      title: 'Você prefere um representante da sua geração?',
      hint: 'Derivado da data de nascimento do TSE.',
      options: options.age as readonly Option[],
      resolve: (s) => {
        const id = resolveAgeBand(s.birthDate)
        return id ? (`idade:${id}` as OptionId) : null
      },
    },
    {
      id: 'candidacy',
      title: 'Você dá preferência a federação partidária ou partido isolado?',
      hint: 'Derivado do tipo de agremiação no TSE.',
      options: options.candidacy as readonly Option[],
      resolve: (s) =>
        `agremiacao:${resolveCandidacy(s.candidacyType)}` as OptionId,
    },
    {
      id: 'local',
      title: `Você valoriza um candidato nascido ${state.locative}?`,
      hint: 'Derivado da UF de nascimento do TSE.',
      options: localOptions(state),
      resolve: (s) =>
        `local:${resolveLocal(s.birthState, state.code)}` as OptionId,
    },
  ]
}

/** Perguntas do quiz para a UF escolhida. A de nascimento usa o nome do estado. */
export function questionsFor(state: BrazilState): readonly Question[] {
  return questionsOf(state).map((q) => ({
    id: q.id,
    title: q.title,
    hint: q.hint,
    options: q.options,
  }))
}

const paranaState = stateByCode('PR')
if (!paranaState) throw new Error('UF PR ausente da malha')
const PARANA: BrazilState = paranaState

/** Perguntas do Paraná — o mesmo formato das outras UFs, com o locativo local. */
export const quizQuestions: readonly Question[] = questionsFor(PARANA)

const QUESTION_IDS = quizQuestions.map((q) => q.id) as QuestionId[]

/**
 * Constrói o perfil completo (opção por pergunta) de um candidato.
 * Lança QuizResolutionError se alguma dimensão oficial estiver indisponível.
 */
export function buildProfile(
  source: ProfileSource,
  electionState: string,
): Record<QuestionId, OptionId> {
  const state = stateByCode(electionState)
  if (!state) {
    throw new QuizResolutionError(`UF desconhecida: ${electionState}`)
  }
  const profile = {} as Record<QuestionId, OptionId>
  for (const question of questionsOf(state)) {
    const optionId = question.resolve(source)
    if (optionId === null) {
      throw new QuizResolutionError(
        `Dimensão "${question.id}" não resolvível para o candidato com os dados atuais.`,
      )
    }
    if (!question.options.some((o) => o.id === optionId)) {
      throw new QuizResolutionError(
        `Opção "${optionId}" desconhecida para a dimensão "${question.id}".`,
      )
    }
    profile[question.id] = optionId
  }
  return profile
}

/** Nome estável (chave) do perfil completo — usado no desempate por raridade. */
export function profileKey(profile: Record<QuestionId, OptionId>): string {
  return QUESTION_IDS.map((id) => profile[id]).join('|')
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
    profile: buildProfile(api, electionState),
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
