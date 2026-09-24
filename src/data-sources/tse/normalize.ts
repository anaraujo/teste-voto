/**
 * Normalização de valores do TSE para o modelo do domínio.
 */

import type { RawCandidateRow } from './schema.ts'
import type { CandidateRecord } from '../../shared/domain.ts'

const EMPTY = /^\s*$/

export function clean(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/** Converte "DD/MM/AAAA" para ISO "AAAA-MM-DD". Null quando inválido/vazio. */
export function parseDate(value: string): string | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed)
  if (!match) return null
  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])
  if (day < 1 || day > 31 || month < 1 || month > 12) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * Converte valores monetários do TSE ("1250,5" ou "1.250,50") para número.
 * Retorna null quando vazio ou não numérico.
 */
export function parseMoney(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '' || EMPTY.test(trimmed)) return null
  // Remove separadores de milhar, normaliza vírgula decimal.
  const normalized = trimmed.replace(/\./g, '').replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Monta o registro de candidato normalizado (sem source/timestamps,
 * preenchidos pelo pipeline/ingestão).
 */
export function normalizeCandidate(
  raw: RawCandidateRow,
  importContext: {
    electionYear: number
    state: string
    office: string
  },
): Omit<CandidateRecord, 'id' | 'source' | 'importedAt' | 'updatedAt'> {
  return {
    tseSequence: raw.sequence.trim(),
    electionYear: importContext.electionYear,
    state: importContext.state,
    office: importContext.office,
    ballotName: clean(raw.ballotName) ?? 'Sem nome de urna',
    fullName: clean(raw.fullName) ?? 'Sem nome completo',
    ballotNumber: raw.ballotNumber.trim(),
    party: clean(raw.party),
    partyAcronym: clean(raw.partyAcronym),
    coalition: clean(raw.coalition),
    status: clean(raw.status),
    campaignStatus: clean(raw.campaignStatus),
    candidacyType: clean(raw.candidacyType),
    occupation: clean(raw.occupation),
    education: clean(raw.education),
    birthDate: parseDate(raw.birthDate),
    gender: clean(raw.gender),
    race: clean(raw.race),
    nationality: clean(raw.nationality),
    city: clean(raw.city),
    email: clean(raw.email),
    website: null,
    socialLinks: [],
    photoUrl: null,
    totalAssets: null,
  }
}

/** Subconjunto de um registro usado para detectar mudanças entre sincronizações. */
export function candidateChecksum(
  candidate: Omit<CandidateRecord, 'id' | 'source' | 'importedAt' | 'updatedAt'>,
): string {
  return JSON.stringify({
    tseSequence: candidate.tseSequence,
    ballotName: candidate.ballotName,
    fullName: candidate.fullName,
    ballotNumber: candidate.ballotNumber,
    party: candidate.party,
    partyAcronym: candidate.partyAcronym,
    coalition: candidate.coalition,
    status: candidate.status,
    campaignStatus: candidate.campaignStatus,
    candidacyType: candidate.candidacyType,
    occupation: candidate.occupation,
    education: candidate.education,
    birthDate: candidate.birthDate,
    gender: candidate.gender,
    race: candidate.race,
    nationality: candidate.nationality,
    city: candidate.city,
    email: candidate.email,
    photoUrl: candidate.photoUrl,
  })
}