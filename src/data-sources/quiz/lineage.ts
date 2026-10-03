/**
 * Casa a orientação oficial de uma bancada (Câmara) com o partido do
 * candidato em 2026. Fusão e renomeação só valem quando os antecessores
 * concordam; incorporação não empresta o voto de quem foi incorporado.
 */

export type Stance = 'sim' | 'nao'

export interface PartyMerger {
  kind: 'fusion' | 'rename' | 'incorporation'
  from: string[]
  to: string
  since: string
  source: string
}

export interface PartyLineage {
  aliases: Record<string, string>
  mergers: PartyMerger[]
}

const INSTITUTIONAL = new Set([
  'GOVERNO',
  'OPOSICAO',
  'MAIORIA',
  'MINORIA',
  'PRESIDENTE',
  'PRESIDENCIA',
])

export function normSigla(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

export function canonSigla(value: string, lineage: PartyLineage): string {
  const normalized = normSigla(value)
  return lineage.aliases[normalized] ?? normalized
}

function tokensOf(sigla: string, lineage: PartyLineage): string[] {
  return sigla
    .split(/[^A-Za-z0-9]+/)
    .map((token) => canonSigla(token, lineage))
    .filter((token) => token.length > 0)
}

function isIgnoredBancada(tokens: readonly string[]): boolean {
  const first = tokens[0]
  if (!first) return true
  if (first === 'BL' || first === 'BLOCO') return true
  if (INSTITUTIONAL.has(first) && tokens.length === 1) return true
  return false
}

function isFederation(tokens: readonly string[]): boolean {
  return tokens.includes('FDR') || tokens.includes('FEDERACAO')
}

/** Mapa sigla da bancada -> lado, só com Sim/Não. Bancadas institucionais ficam de fora. */
export function orientationMap(
  rows: readonly { sigla: string; stance: Stance | null }[],
  lineage: PartyLineage,
): Map<string, Stance> {
  const map = new Map<string, Stance>()
  for (const row of rows) {
    if (!row.stance) continue
    const tokens = tokensOf(row.sigla, lineage)
    if (isIgnoredBancada(tokens)) continue
    map.set(row.sigla, row.stance)
  }
  return map
}

function directStance(
  party: string,
  rows: ReadonlyMap<string, Stance>,
  lineage: PartyLineage,
): Stance | null {
  const target = canonSigla(party, lineage)
  for (const [sigla, stance] of rows) {
    const tokens = tokensOf(sigla, lineage)
    if (isIgnoredBancada(tokens) || isFederation(tokens)) continue
    if (tokens.length === 1 && tokens[0] === target) return stance
  }
  return null
}

function federationStance(
  party: string,
  rows: ReadonlyMap<string, Stance>,
  lineage: PartyLineage,
): Stance | null {
  const target = canonSigla(party, lineage)
  for (const [sigla, stance] of rows) {
    const tokens = tokensOf(sigla, lineage)
    if (!isFederation(tokens)) continue
    if (tokens.includes(target)) return stance
  }
  return null
}

/**
 * Lado Sim/Não do partido naquela data.
 * Ordem: bancada do próprio partido, federação que o inclui, antecessores
 * (só se todos tiverem o mesmo lado).
 */
export function resolvePartyStance(
  party: string | null,
  rows: ReadonlyMap<string, Stance>,
  voteDate: string,
  lineage: PartyLineage,
): Stance | null {
  if (!party) return null
  const canon = canonSigla(party, lineage)

  const own = directStance(canon, rows, lineage)
  if (own) return own
  const federation = federationStance(canon, rows, lineage)
  if (federation) return federation

  for (const merger of lineage.mergers) {
    const from = merger.from.map((item) => canonSigla(item, lineage))
    const to = canonSigla(merger.to, lineage)
    if (voteDate >= merger.since && from.includes(canon)) {
      return (
        directStance(to, rows, lineage) ?? federationStance(to, rows, lineage)
      )
    }
    if (voteDate < merger.since && canon === to && merger.kind !== 'incorporation') {
      const sides = from.map((item) => directStance(item, rows, lineage))
      if (sides.some((side) => side === null)) return null
      const unique = new Set(sides)
      if (unique.size === 1) return sides[0] ?? null
      return null
    }
  }
  return null
}

export function governoStance(
  rows: readonly { sigla: string; stance: Stance | null }[],
): Stance | null {
  for (const row of rows) {
    if (normSigla(row.sigla) === 'GOVERNO') return row.stance
  }
  return null
}
