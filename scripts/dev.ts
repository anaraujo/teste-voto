/**
 * Roda o app (Vite) e a API (node:http) juntos, no modo desenvolvimento.
 *
 * Execução: npm run dev
 *  - API  : http://localhost:2027 (dados do TSE, SQLite)
 *  - App  : http://localhost:2026 (Vite, com proxy /api e /photos)
 */

import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { join } from 'node:path'

const children: Array<ReturnType<typeof spawn>> = []

const api = spawn(
  process.execPath,
  ['--experimental-sqlite', '--experimental-strip-types', 'server/index.ts'],
  { stdio: 'inherit' },
)
children.push(api)

// Resolve o binário do Vite localmente (node_modules/.bin), sem depender
// do PATH — robusto também fora do contexto do npm.
const localVite = join(process.cwd(), 'node_modules', '.bin', 'vite')
const viteCommand = existsSync(localVite) ? localVite : 'vite'
const vite = spawn(viteCommand, [], { stdio: 'inherit', shell: true })
children.push(vite)

function shutdown(): void {
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM')
  }
}

process.on('SIGINT', () => process.exit(0))
process.on('SIGTERM', () => shutdown())
process.on('exit', shutdown)

for (const child of children) {
  child.on('exit', (code) => {
    shutdown()
    process.exit(code ?? 0)
  })
}