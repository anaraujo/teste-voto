import { candidates, questions } from '../src/data/quiz.ts'
import { computeDistribution } from '../src/lib/distribution.ts'

const { entries, totalCombinations, idealShare } = computeDistribution(
  questions,
  candidates,
)

const idealPercent = (idealShare / totalCombinations) * 100
const highest = entries[0]?.wins ?? 1

console.log(`Combinações possíveis: ${totalCombinations}`)
console.log(
  `Distribuição ideal por candidato: ${idealShare.toFixed(1)} (${idealPercent.toFixed(1)}%)`,
)
console.log()

for (const entry of entries) {
  const percent = ((entry.wins / totalCombinations) * 100).toFixed(1)
  const bar = '#'.repeat(Math.round((entry.wins / highest) * 24))
  console.log(
    `${entry.candidate.name.padEnd(14)} ${String(entry.wins).padStart(3)} (${percent.padStart(5)}%) ${bar}`,
  )
}