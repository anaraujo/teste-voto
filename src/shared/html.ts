/**
 * Montagem do HTML de cada página estática a partir do shell construído pelo
 * Vite (`dist/index.html`): injeta o app pré-renderizado, os dados da rota, o
 * `<title>`, a descrição e as tags Open Graph.
 *
 * Puro e sem DOM, para poder ser testado com `node:test` (ver
 * `scripts/router.test.ts`).
 */

import {
  PRERENDER_DATA_ID,
  type PrerenderData,
  type RouteMeta,
} from './prerender.ts'

export interface RenderPageInput {
  /** HTML do shell gerado pelo Vite (contém `<div id="root"></div>`). */
  shell: string
  /** Markup do app já renderizado por `renderRoute`. */
  appHtml: string
  meta: RouteMeta
  /** Dados da rota, embutidos para semear a hidratação. */
  data?: PrerenderData
  /** Origem pública do site (usada em canonical, og:url e sitemap). */
  siteUrl: string
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function absolute(pathOrUrl: string, siteUrl: string): string {
  if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl
  return new URL(pathOrUrl, siteUrl).toString()
}

function headTags(meta: RouteMeta, siteUrl: string): string {
  const url = absolute(meta.path, siteUrl)
  const tags = [
    `<title>${escapeAttribute(meta.title)}</title>`,
    `<meta name="description" content="${escapeAttribute(meta.description)}">`,
    `<link rel="canonical" href="${escapeAttribute(url)}">`,
    `<meta property="og:site_name" content="Teste de Voto">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${escapeAttribute(meta.title)}">`,
    `<meta property="og:description" content="${escapeAttribute(meta.description)}">`,
    `<meta property="og:url" content="${escapeAttribute(url)}">`,
    `<meta name="twitter:card" content="summary">`,
  ]
  if (meta.image) {
    const image = absolute(meta.image, siteUrl)
    tags.push(`<meta property="og:image" content="${escapeAttribute(image)}">`)
  }
  return tags.join('\n    ')
}

/** Remove o title/description que o shell do Vite traz, se existirem. */
function stripHeadMeta(shell: string): string {
  return shell
    .replace(/[ \t]*<title>.*?<\/title>\n?/s, '')
    .replace(/[ \t]*<meta name="description"[^>]*>\n?/g, '')
}

/** Aplica head/dados/app sobre o shell do Vite. */
export function renderPage({
  shell,
  appHtml,
  meta,
  data,
  siteUrl,
}: RenderPageInput): string {
  const rootRe = /<div id="root"[^>]*><\/div>/
  if (!rootRe.test(shell)) {
    throw new Error('shell sem <div id="root"></div>: refaça o build do Vite')
  }
  if (!shell.includes('</head>') || !shell.includes('</body>')) {
    throw new Error('shell sem </head> ou </body>: refaça o build do Vite')
  }

  const dataScript = data
    ? `\n    <script type="application/json" id="${PRERENDER_DATA_ID}">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`
    : ''

  return stripHeadMeta(shell)
    .replace('</head>', `    ${headTags(meta, siteUrl)}\n  </head>`)
    .replace(rootRe, `<div id="root">${appHtml}</div>`)
    .replace('</body>', `${dataScript}\n  </body>`)
}
