/**
 * Fórmulas do eixo do quiz. O mesmo código vale no script que grava o banco
 * e na tela, para o rótulo não divergir do número.
 */

export const MIN_ALIGNMENT_VOTES = 5

export type AlignmentBucket = 'governista' | 'independente' | 'oposicao'
export type TrajetoriaBucket =
  | 'renovacao'
  | 'alguma-experiencia'
  | 'carreira-longa'
export type Stance = 'sim' | 'nao'

export function alignmentRate(
  comparisons: readonly { stance: Stance; governo: Stance }[],
): number | null {
  if (comparisons.length < MIN_ALIGNMENT_VOTES) return null
  let matches = 0
  for (const item of comparisons) {
    if (item.stance === item.governo) matches++
  }
  return matches / comparisons.length
}

export function alignmentBucket(rate: number | null): AlignmentBucket | null {
  if (rate === null) return null
  if (rate >= 0.7) return 'governista'
  if (rate <= 0.3) return 'oposicao'
  return 'independente'
}

export function trajetoriaCount(
  mandateCount: number,
  incumbentMissingFromHistory: boolean,
): number {
  return mandateCount + (incumbentMissingFromHistory ? 1 : 0)
}

export function trajetoriaBucket(count: number): TrajetoriaBucket {
  if (count <= 0) return 'renovacao'
  if (count <= 2) return 'alguma-experiencia'
  return 'carreira-longa'
}
