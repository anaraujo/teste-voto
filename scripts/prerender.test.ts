import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
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

/**
 * A lista de candidatos renderiza todos de uma vez, sem "Mostrar mais".
 *
 * Não há runner de DOM no projeto — `node --test` puro não compila JSX — então
 * um teste não consegue montar o componente e contar os cards. A garantia vem
 * de duas checagens que cobrem ângulos diferentes: o código-fonte, que sempre
 * roda, e o HTML realmente gerado, que roda depois de `npm run build`.
 */
test('a lista de candidatos não volta a paginar', () => {
  const source = readFileSync(
    new URL('../src/components/CandidatesScreen.tsx', import.meta.url),
    'utf8',
  )
  assert.ok(
    !source.includes('Mostrar mais'),
    'o botão "Mostrar mais" não deve voltar: a API já devolve a lista inteira',
  )
  assert.match(
    source,
    /items=\{candidates\.map\(toCandidateItem\)\}/,
    'o grid deve receber todos os candidatos, sem slice',
  )
})

const CANDIDATOS_HTML = new URL(
  '../dist/candidatos/index.html',
  import.meta.url,
)

test(
  'o HTML de /candidatos tem um card por candidato',
  {
    skip: existsSync(CANDIDATOS_HTML)
      ? false
      : 'rode `npm run build` antes de `npm test` para checar o HTML gerado',
  },
  () => {
    const html = readFileSync(CANDIDATOS_HTML, 'utf8')
    const seed = html.match(/id="__prerender-data"[^>]*>(.*?)<\/script>/s)?.[1]
    assert.ok(seed, 'o seed dos candidatos deveria estar embutido na página')

    const { payload } = JSON.parse(seed) as {
      payload: { total: number; candidates: unknown[] }
    }
    const cards = html.match(/class="candidate-card"/g) ?? []

    // Conta contra o seed, não contra um número fixo: a eleição pode mudar de
    // tamanho no próximo `npm run ingest` sem quebrar o teste.
    assert.equal(payload.candidates.length, payload.total)
    assert.equal(cards.length, payload.candidates.length)
    assert.ok(!html.includes('Mostrar mais'))
  },
)
