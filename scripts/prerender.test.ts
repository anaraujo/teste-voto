import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderPage } from '../src/shared/html.ts'

const SHELL = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <title>Teste de Voto</title>
    <link rel="stylesheet" crossorigin href="/assets/index-abc.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" crossorigin src="/assets/index-abc.js"></script>
  </body>
</html>`

test('renderPage injeta o app, o head e os dados da rota', () => {
  const html = renderPage({
    shell: SHELL,
    appHtml: '<section><h2>Ficha</h2></section>',
    meta: {
      title: 'FULANO (PTE) — ficha | Teste de Voto',
      description: 'Ficha comparável de FULANO.',
      path: '/candidato/2026-PR-1',
      image: '/photos/2026-PR-1.jpg',
    },
    data: {
      kind: 'candidates',
      payload: { total: 1, candidates: [] } as never,
    },
    siteUrl: 'https://exemplo.org',
  })

  assert.match(
    html,
    /<div id="root"><section><h2>Ficha<\/h2><\/section><\/div>/,
  )
  assert.match(html, /<title>FULANO \(PTE\) — ficha \| Teste de Voto<\/title>/)
  assert.equal(html.match(/<title>/g)?.length, 1)
  assert.match(
    html,
    /<link rel="canonical" href="https:\/\/exemplo.org\/candidato\/2026-PR-1">/,
  )
  assert.match(
    html,
    /<meta property="og:url" content="https:\/\/exemplo.org\/candidato\/2026-PR-1">/,
  )
  assert.match(
    html,
    /<meta property="og:image" content="https:\/\/exemplo.org\/photos\/2026-PR-1.jpg">/,
  )
  assert.match(html, /<script type="application\/json" id="__prerender-data">/)
  assert.match(html, /href="\/assets\/index-abc.css"/)
})

test('renderPage escapa o title e não quebra com shell inválido', () => {
  const html = renderPage({
    shell: SHELL,
    appHtml: '<p>oi</p>',
    meta: { title: 'A <b>B</b> & "C"', description: 'd', path: '/' },
    siteUrl: 'https://exemplo.org',
  })
  assert.match(
    html,
    /<title>A &lt;b&gt;B&lt;\/b&gt; &amp; &quot;C&quot;<\/title>/,
  )
  assert.ok(!html.includes('id="__prerender-data"'))

  assert.throws(
    () =>
      renderPage({
        shell: '<html><body></body></html>',
        appHtml: '',
        meta: { title: 't', description: 'd', path: '/' },
        siteUrl: 'https://exemplo.org',
      }),
    /<div id="root">/,
  )
})

test('renderPage escapa < no JSON embutido', () => {
  const html = renderPage({
    shell: SHELL,
    appHtml: '<p>oi</p>',
    meta: { title: 't', description: 'd', path: '/' },
    data: {
      kind: 'candidate',
      payload: { ballotName: '</script><b>' } as never,
    },
    siteUrl: 'https://exemplo.org',
  })
  assert.ok(!html.includes('</script><b>'))
  assert.match(html, /\\u003c\/script>/)
})
