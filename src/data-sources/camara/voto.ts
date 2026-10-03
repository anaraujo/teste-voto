/**
 * Normalização do voto nominal da Câmara (Dados Abertos).
 *
 * P-NRV e vazio significam que não houve voto registrado.
 */

import type { VotoValor } from '../parliament/types.ts'

export function normalizeVoto(voto: string): VotoValor | null {
  const value = voto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
  if (value === 'P-NRV' || value === '' || value === 'NRV') return null
  if (value === 'SIM') return 'Sim'
  if (value === 'NAO') return 'Não'
  if (value === 'ABSTENCAO') return 'Abstenção'
  if (value === 'OBSTRUCAO') return 'Obstrução'
  return null
}

/** Sim/Não viram lado da pergunta; abstenção e obstrução não são lado. */
export function votoToSide(voto: VotoValor | null): 'sim' | 'nao' | null {
  if (voto === 'Sim') return 'sim'
  if (voto === 'Não') return 'nao'
  return null
}
