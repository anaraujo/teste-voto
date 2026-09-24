export type QuestionId = string
export type OptionId = string
export type CandidateId = string

export interface Option {
  id: OptionId
  label: string
  photo?: string
}

export interface Question {
  id: QuestionId
  title: string
  options: readonly Option[]
}

export interface Candidate {
  id: CandidateId
  name: string
  description: string
  photo?: string
  profile: Record<QuestionId, OptionId>
}

const photo = (seed: string): string =>
  `https://picsum.photos/seed/${seed}/400/300`

const placeholderOptions = (seed: string): readonly Option[] => [
  { id: 'a', label: 'Opção A', photo: photo(`${seed}-a`) },
  { id: 'b', label: 'Opção B', photo: photo(`${seed}-b`) },
  { id: 'c', label: 'Opção C', photo: photo(`${seed}-c`) },
]

export const questions: readonly Question[] = [
  { id: 'q1', title: 'Pergunta 1', options: placeholderOptions('pergunta-1') },
  { id: 'q2', title: 'Pergunta 2', options: placeholderOptions('pergunta-2') },
  { id: 'q3', title: 'Pergunta 3', options: placeholderOptions('pergunta-3') },
  { id: 'q4', title: 'Pergunta 4', options: placeholderOptions('pergunta-4') },
  { id: 'q5', title: 'Pergunta 5', options: placeholderOptions('pergunta-5') },
]

export const candidates: readonly Candidate[] = [
  { id: 'c1', name: 'Candidato 1', description: 'Descrição do Candidato 1.', photo: photo('candidato-1'), profile: { q1: 'c', q2: 'c', q3: 'a', q4: 'b', q5: 'c' } },
  { id: 'c2', name: 'Candidato 2', description: 'Descrição do Candidato 2.', photo: photo('candidato-2'), profile: { q1: 'c', q2: 'c', q3: 'a', q4: 'b', q5: 'a' } },
  { id: 'c3', name: 'Candidato 3', description: 'Descrição do Candidato 3.', photo: photo('candidato-3'), profile: { q1: 'a', q2: 'c', q3: 'a', q4: 'b', q5: 'a' } },
  { id: 'c4', name: 'Candidato 4', description: 'Descrição do Candidato 4.', photo: photo('candidato-4'), profile: { q1: 'c', q2: 'c', q3: 'c', q4: 'b', q5: 'b' } },
  { id: 'c5', name: 'Candidato 5', description: 'Descrição do Candidato 5.', photo: photo('candidato-5'), profile: { q1: 'b', q2: 'a', q3: 'a', q4: 'b', q5: 'a' } },
  { id: 'c6', name: 'Candidato 6', description: 'Descrição do Candidato 6.', photo: photo('candidato-6'), profile: { q1: 'c', q2: 'a', q3: 'a', q4: 'b', q5: 'c' } },
  { id: 'c7', name: 'Candidato 7', description: 'Descrição do Candidato 7.', photo: photo('candidato-7'), profile: { q1: 'c', q2: 'a', q3: 'b', q4: 'b', q5: 'a' } },
  { id: 'c8', name: 'Candidato 8', description: 'Descrição do Candidato 8.', photo: photo('candidato-8'), profile: { q1: 'b', q2: 'a', q3: 'c', q4: 'b', q5: 'a' } },
  { id: 'c9', name: 'Candidato 9', description: 'Descrição do Candidato 9.', photo: photo('candidato-9'), profile: { q1: 'a', q2: 'b', q3: 'a', q4: 'a', q5: 'a' } },
  { id: 'c10', name: 'Candidato 10', description: 'Descrição do Candidato 10.', photo: photo('candidato-10'), profile: { q1: 'c', q2: 'a', q3: 'a', q4: 'c', q5: 'b' } },
  { id: 'c11', name: 'Candidato 11', description: 'Descrição do Candidato 11.', photo: photo('candidato-11'), profile: { q1: 'c', q2: 'b', q3: 'a', q4: 'b', q5: 'c' } },
  { id: 'c12', name: 'Candidato 12', description: 'Descrição do Candidato 12.', photo: photo('candidato-12'), profile: { q1: 'b', q2: 'c', q3: 'a', q4: 'a', q5: 'b' } },
  { id: 'c13', name: 'Candidato 13', description: 'Descrição do Candidato 13.', photo: photo('candidato-13'), profile: { q1: 'a', q2: 'b', q3: 'c', q4: 'a', q5: 'b' } },
  { id: 'c14', name: 'Candidato 14', description: 'Descrição do Candidato 14.', photo: photo('candidato-14'), profile: { q1: 'b', q2: 'c', q3: 'c', q4: 'c', q5: 'a' } },
  { id: 'c15', name: 'Candidato 15', description: 'Descrição do Candidato 15.', photo: photo('candidato-15'), profile: { q1: 'a', q2: 'c', q3: 'b', q4: 'a', q5: 'c' } },
]