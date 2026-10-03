/**
 * Posição de cada candidato em cada pauta fixa, e as duas métricas do eixo
 * "manter ou confrontar": alinhamento com a orientação do Governo e
 * quantidade de mandatos. Fórmulas publicadas em docs/quiz-design.md.
 */

import type { VotoValor } from '../parliament/types.ts'
import { votoToSide } from '../camara/voto.ts'
import type { Stance } from './lineage.ts'
import {
  alignmentRate,
  trajetoriaCount,
} from '../../shared/quiz-metrics.ts'

export const LEG_57_FROM = '2023-02-01'

export { alignmentRate, trajetoriaCount }

export interface ResolvedPosition {
  value: Stance | null
  origin: 'candidato' | 'partido' | null
  voto: VotoValor | null
}

/**
 * Voto nominal do candidato vem primeiro. Abstenção e obstrução não caem
 * para a orientação do partido. Sem registro, usa o partido.
 */
export function resolvePosition(
  personal: VotoValor | null | undefined,
  partyStance: Stance | null,
): ResolvedPosition {
  if (personal) {
    const side = votoToSide(personal)
    if (side) return { value: side, origin: 'candidato', voto: personal }
    return { value: null, origin: 'candidato', voto: personal }
  }
  if (partyStance) {
    return { value: partyStance, origin: 'partido', voto: null }
  }
  return { value: null, origin: null, voto: null }
}

