/**
 * Gera o site estático: renderiza cada rota em HTML (com `react-dom/server`) e
 * escreve em `dist/`.
 *
 *   npm run build  →  vite build  →  dist/index.html + dist/.vite/manifest.json
 *                      vite build --ssr  →  dist-ssr/entry-server.js
 *                      este script  →  dist/<rota>/index.html, sitemap, robots
 *
 * Os dados vêm do mesmo SQLite da API (`src/data-sources/apiPayload.ts`), então
 * a página pré-renderizada e a resposta de `/api` são idênticas. Se o banco não
 * existir, o script avisa para rodar `npm run ingest` e sai.
 */

import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openRepository } from '../src/data-sources/repository.ts'
import {
  buildCandidateDetailPayload,
  buildCandidatesPayload,
} from '../src/data-sources/apiPayload.ts'
import { defaultDataDir } from '../src/data-sources/tse/candidates.ts'
import { questions } from '../src/data/quiz.ts'
import { renderPage } from '../src/shared/html.ts'
import type {
  PrerenderData,
  RenderRouteInput,
  RouteMeta,
} from '../src/shared/prerender.ts'
import { routeToPath, type Route } from '../src/shared/router.ts'
import type {
  ApiCandidateDetail,
  ApiCandidatesResponse,
} from '../src/shared/api.ts'

const DIST = 'dist'
/** Shell vazio, para as rotas que só existem no cliente (`/resultado`). */
const CLIENT_SHELL = 'app.html'
/** Bundle SSR, relativo a este arquivo (scripts/ → ../dist-ssr). */
const SSR_ENTRY_URL = new URL('../dist-ssr/entry-server.js', import.meta.url)
const SSR_ENTRY = fileURLToPath(SSR_ENTRY_URL)
const SITE_URL = (process.env.SITE_URL ?? 'http://localhost:2026').replace(
  /\/$/,
  '',
)

type RenderRoute = (input: RenderRouteInput) => string

async function loadRenderRoute(): Promise<RenderRoute> {
  if (!existsSync(SSR_ENTRY)) {
    throw new Error(
      `bundle de pré-render ausente (${SSR_ENTRY}); rode "npm run build:ssr" antes`,
    )
  }
  const module = (await import(SSR_ENTRY_URL.href)) as {
    renderRoute?: RenderRoute
  }
  if (typeof module.renderRoute !== 'function') {
    throw new Error(`${SSR_ENTRY} não exporta renderRoute`)
  }
  return module.renderRoute
}

async function writePage(
  path: string,
  html: string,
): Promise<{ path: string; bytes: number }> {
  const filePath =
    path === '/' ? join(DIST, 'index.html') : join(DIST, path, 'index.html')
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, html)
  return { path, bytes: Buffer.byteLength(html) }
}

function listMeta(list: ApiCandidatesResponse): RouteMeta {
  const { state, office, year } = list.election
  const title = `Candidatos a ${office} — ${state} ${year} | Teste de Voto`
  const description = `Os ${list.total} candidatos a ${office} em ${state} (${year}), com partido, ocupação, bens declarados, redes e dados oficiais do TSE.`
  return { title, description, path: routeToPath({ name: 'candidates' }) }
}

function candidateMeta(detail: ApiCandidateDetail): RouteMeta {
  const party = detail.partyAcronym ? ` (${detail.partyAcronym})` : ''
  const title = `${detail.ballotName}${party} — ficha | Teste de Voto`
  const description = `Ficha comparável de ${detail.ballotName}${party}: dados do TSE, mandato e histórico parlamentar, votações em votações-chave e posições com fonte.`
  return {
    title,
    description,
    path: routeToPath({ name: 'candidate', id: detail.id }),
    image: detail.photoUrl,
  }
}

function homeMeta(list: ApiCandidatesResponse): RouteMeta {
  const { office, state } = list.election
  return {
    title: `Teste de Voto: qual dos ${list.total} candidatos a ${office} combina com você?`,
    description: `Responda ${questions.length} perguntas e descubra qual candidato a deputado federal do ${state} combina melhor com as suas prioridades. Quiz imparcial, com dados oficiais do TSE.`,
    path: '/',
  }
}

const COMBINATIONS = questions.reduce(
  (total, question) => total * question.options.length,
  1,
)

const FAIRNESS_META: RouteMeta = {
  title: 'Imparcialidade do teste — todas as combinações | Teste de Voto',
  description: `Auditoria de imparcialidade: as ${COMBINATIONS} combinações possíveis de respostas, com as vitórias de cada candidato.`,
  path: '/imparcialidade',
}

const STATES_META: RouteMeta = {
  title: 'Escolha o seu estado — candidatos por UF | Teste de Voto',
  description:
    'Mapa do Brasil para escolher o estado e ver os candidatos. O Paraná já está disponível; os demais estados chegam nas próximas rodadas.',
  path: '/estados',
}

function sitemapXml(paths: string[]): string {
  const urls = paths
    .map(
      (path) => `  <url><loc>${new URL(path, `${SITE_URL}/`).href}</loc></url>`,
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

async function main(): Promise<void> {
  const renderRoute = await loadRenderRoute()
  const dbPath = join(defaultDataDir(), 'tse.db')
  if (!existsSync(dbPath)) {
    console.error(
      `[prerender] banco não encontrado em ${dbPath}.\n` +
        `[prerender] rode "npm run ingest" antes de "npm run build".`,
    )
    process.exitCode = 1
    return
  }

  const shell = await readFile(join(DIST, 'index.html'), 'utf8')
  const db = await openRepository(dbPath)
  const list = buildCandidatesPayload(db)
  const listData: PrerenderData = { kind: 'candidates', payload: list }

  // `/quiz/N` é conteúdo estático (a pergunta e as opções não dependem das
  // respostas), então entra no build também: as perguntas viram texto
  // indexável. Só `/resultado` fica no cliente — o ranking depende de quem
  // respondeu, e por isso usa o shell vazio.
  const pages: Array<{ route: Route; meta: RouteMeta; data?: PrerenderData }> =
    [
      { route: { name: 'start' }, meta: homeMeta(list), data: listData },
      { route: { name: 'candidates' }, meta: listMeta(list), data: listData },
      { route: { name: 'states' }, meta: STATES_META, data: listData },
      { route: { name: 'fairness' }, meta: FAIRNESS_META, data: listData },
      ...questions.map((question, index) => ({
        route: { name: 'question' as const, step: index + 1 },
        meta: {
          title: `${question.title} | Teste de Voto`,
          description: `${questions.length} perguntas, ${
            list.total
          } candidatos a deputado federal no ${list.election.state}: ${question.hint}`,
          path: routeToPath({ name: 'question', step: index + 1 }),
        },
      })),
    ]

  const seen = new Set<string>()
  const written: string[] = []
  let bytes = 0

  const emit = async (page: (typeof pages)[number]): Promise<void> => {
    const path = routeToPath(page.route)
    if (seen.has(path)) return
    seen.add(path)
    const html = renderPage({
      shell,
      appHtml: renderRoute({ route: page.route, data: page.data }),
      meta: page.meta,
      data: page.data,
      siteUrl: SITE_URL,
    })
    const result = await writePage(path, html)
    bytes += result.bytes
    written.push(path)
  }

  for (const page of pages) await emit(page)

  let skipped = 0
  for (const candidate of list.candidates) {
    const detail = await buildCandidateDetailPayload(db, candidate.id)
    if (!detail) {
      skipped += 1
      continue
    }
    await emit({
      route: { name: 'candidate', id: candidate.id },
      meta: candidateMeta(detail),
      data: { kind: 'candidate', payload: detail },
    })
  }

  db.close()

  await writeFile(join(DIST, CLIENT_SHELL), shell)
  await writeFile(join(DIST, 'sitemap.xml'), sitemapXml(written))
  await writeFile(
    join(DIST, 'robots.txt'),
    `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`,
  )

  const mb = (bytes / 1024 / 1024).toFixed(1)
  console.log(
    `[prerender] ${written.length} páginas (${mb} MB) em ${DIST}/ · ` +
      `sitemap com ${written.length} URLs · site ${SITE_URL} · ` +
      `shell do cliente em ${DIST}/${CLIENT_SHELL}` +
      (skipped ? ` · ${skipped} candidatos sem ficha` : ''),
  )
}

await main()
