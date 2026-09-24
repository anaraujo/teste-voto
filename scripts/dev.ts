/**
 * Roda o app (Vite) e a API (node:http) juntos, no modo desenvolvimento.
 *
 * Execução: npm run dev
 *  - API  : http://localhost:2027 (dados do TSE, SQLite)
 *  - App  : http://localhost:2026 (Vite, com proxy /api e /photos)
 */

import { spawn } from 'node:child_process'

const children: Array<ReturnType<typeof spawn>> = []

const api = spawn(
  process.execPath,
  ['--experimental-sqlite', '--experimental-strip-types', 'server/index.ts'],
  { stdio: 'inherit' },
)
children.push(api)

const vite = spawn('vite', [], { stdio: 'inherit', shell: true })
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