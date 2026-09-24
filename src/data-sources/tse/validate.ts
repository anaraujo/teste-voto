/**
 * Validação dos registros de candidatos já mapeados do CSV.
 */

import type { RawCandidateRow } from './schema.ts'

export type ValidationError = { field: string; problem: string }

/** Valida um registro; retorna lista (vazia quando válido). */
export function validateCandidate(row: RawCandidateRow): ValidationError[] {
  const errors: ValidationError[] = []

  if (row.sequence.trim() === '') {
    errors.push({ field: 'SQ_CANDIDATO', problem: 'obrigatório' })
  }
  if (row.ballotName.trim() === '' && row.fullName.trim() === '') {
    errors.push({ field: 'NM_URNA_CANDIDATO/NM_CANDIDATO', problem: 'pelo menos um nome obrigatório' })
  }
  if (row.ballotNumber.trim() === '') {
    errors.push({ field: 'NR_CANDIDATO', problem: 'obrigatório' })
  }

  return errors
}

export function formatErrors(errors: ValidationError[], sequence: string): string {
  if (errors.length === 0) return ''
  const detail = errors.map((e) => `${e.field}: ${e.problem}`).join('; ')
  return `candidato ${sequence || '(sem número)'}: ${detail}`
}