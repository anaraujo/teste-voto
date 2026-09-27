/**
 * Formatação compartilhada exibida no app (datas, idades e moeda),
 * usada pela lista de candidatos e pela ficha detalhada.
 */

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export function formatBRL(value: number | null): string | null {
  if (value === null) return null
  return brl.format(value)
}

/** Converte data ISO "AAAA-MM-DD" em "DD/MM/AAAA". */
export function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}

/** Idade em 04/10/2026 (data da eleição), a partir da data de nascimento. */
export function ageAtElection(birthDate: string | null): number | null {
  if (!birthDate) return null
  const birth = new Date(birthDate)
  if (Number.isNaN(birth.getTime())) return null
  const election = new Date('2026-10-04T00:00:00Z')
  let age = election.getUTCFullYear() - birth.getUTCFullYear()
  const birthdayThisYear = new Date(election)
  birthdayThisYear.setUTCFullYear(birth.getUTCFullYear())
  if (birthdayThisYear.getTime() < birth.getTime()) age -= 1
  return age
}