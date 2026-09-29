/**
 * Enriquecimento dos candidatos com os datasets complementares do TSE
 * (complementar, bens e redes sociais). Funções puras e determinísticas:
 * dado o registro base e os resumos por SQ_CANDIDATO, devolvem o registro
 * completo.
 */

import type { CandidateRecord } from '../../shared/domain.ts'
import type { ComplementarySummary } from './complementar.ts'

export function applyComplementary(
  candidate: CandidateRecord,
  summary: ComplementarySummary,
): CandidateRecord {
  return {
    ...candidate,
    birthMunicipality: summary.birthMunicipality ?? candidate.birthMunicipality,
    quilombola: summary.quilombola ?? candidate.quilombola,
    indigenousEthnicity:
      summary.indigenousEthnicity ?? candidate.indigenousEthnicity,
    inBallot: summary.inBallot ?? candidate.inBallot,
    substituted: summary.substituted ?? candidate.substituted,
    accountsDeclared: summary.accountsDeclared ?? candidate.accountsDeclared,
    assetsDeclared: summary.assetsDeclared ?? candidate.assetsDeclared,
    isReelection: summary.isReelection ?? candidate.isReelection,
    campaignSpendingCap:
      summary.campaignSpendingCap ?? candidate.campaignSpendingCap,
  }
}

export function applyAssets(
  candidate: CandidateRecord,
  totalAssets: number | null,
): CandidateRecord {
  return { ...candidate, totalAssets: totalAssets ?? candidate.totalAssets }
}

export function applySocialLinks(
  candidate: CandidateRecord,
  socialLinks: readonly string[],
): CandidateRecord {
  return { ...candidate, socialLinks: [...socialLinks] }
}
