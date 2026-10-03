# O mapa de estados (a rota principal, `/`)

A tela de seleção de estado (a antiga `/estados`) deixa a pessoa escolher o
estado antes de ver a lista de candidatos. Ela tem duas navegações que apontam
para o mesmo lugar:

- o **mapa do Brasil**, com uma forma clicável por unidade federativa;
- a **grade de siglas**, que funciona em qualquer largura de tela.

Hoje as 27 UFs têm lista. Cada uma navega para `/estados/:uf` (candidatos,
quiz, resultado e imparcialidade daquela UF). A ficha continua em
`/candidato/:id`.

## A forma da tela: empilhada no celular, lado a lado no desktop

Duas formas, um breakpoint (`md`, 768px), e a escolha é de **altura**, não de
gosto: mapa e 27 cartões juntos não cabem na altura de um celular.

| Largura      | Forma                                                                | Rolagem                     |
| ------------ | -------------------------------------------------------------------- | --------------------------- |
| `< 768px`    | empilhada: mapa primeiro (no máximo `65svh`), grade de siglas depois | sim, a página cresce        |
| `768–1023px` | lado a lado, grade com **3 colunas**                                 | não — a tela para na janela |
| `>= 1024px`  | lado a lado, grade com **4 colunas**                                 | não — a tela para na janela |

O corte fica em `md` e não em `lg` porque quem manda é a **largura**: uma janela
de 1280px com o console do navegador ancorado na lateral chega a ~900px de
viewport e, com o corte em `lg`, caía na forma empilhada — 1270px de página
numa janela de 700px de altura. Entre `md` e `lg` a grade fica com três colunas
porque com quatro ela tem 551px de largura e sobra menos de 130px para o mapa
aos 768px; a única coisa que a largura troca dentro da forma lado a lado é esse
número de colunas.

Em cima de `md` o `<main>` da rota ganha `h-dvh` (altura **definida**, não
`max-h-dvh`) e vira coluna de flex, a seção e a linha dividem o que sobra, e o
mapa deixa de ser medido pela **largura** para ser medido pela **altura**
(`height: 100%` na media query de `BrazilMap.css`, com o `preserveAspectRatio`
padrão centralizando a malha na caixa). A altura definida é o que faz a cadeia
de `flex-basis: 0%` e o `height: 100%` do mapa resolverem no **primeiro**
layout; com `max-height` a `height` do `<main>` ficava `auto` (indefinida) e o
mapa só acertava a proporção depois de um resize.
Quem encolhe é sempre o mapa: ele é imagem, então se ajusta sem distorcer nem
perder proporção. A grade mantém altura própria e fica centralizada na coluna.

O cartão tem uma versão compacta a partir de `md` (`py-1.5`, sigla em
`text-base`, nome em `0.6875rem`, "Em breve" em `0.5625rem`), e é ela que faz a
tela caber: as linhas de 69px dão uma tela inteira a partir de uns **700px de
altura de janela** (com quatro colunas; são 9 linhas de 69px entre `md` e `lg`).
Abaixo disso a página rola — preferível a esticar os cartões, que criaria
caixas com ar por dentro.

### Janela baixa: um degrau a menos

Com o console do navegador aberto a janela perde uns 200px de altura e a tela
parava de caber. `EstadosScreen.css` resolve em dois passos, ambos só de `md`
para cima:

- **`align-content: safe center`** na grade. Com o centro simples e as linhas
  maior que a caixa, a grade transbordava para os dois lados: a primeira linha
  de siglas subia por cima do `h1` e a última passava do rodapé. `safe center`
  centraliza enquanto cabe e encosta em cima quando não cabe — o excesso vai só
  para baixo, que é o sentido em que a página rola.
- **Compressão** a partir de `44rem` de altura de janela (abaixo de `md` isso não
  existe: a grade está no fluxo e a página rola de qualquer jeito). Encolhe um
  degrau o gap da seção, o título da tela, o gap da grade e a tipografia do
  cartão (padding, sigla, nome e "Em breve"): as linhas vão de 69px para 56px.
  A tela passa a caber a partir de uns **490px de janela** a partir de `lg` (sete
  linhas de cartão) e de **~600px** entre `md` e `lg`, onde são nove. Um degrau
  só, e não uma escala contínua em `clamp()`: em escala a sigla do cartão só
  ficaria legível numa faixa estreita de alturas.

Abaixo desses pisos a página volta a rolar — e só para baixo, por causa do
`safe center`.

No celular o mapa vem **primeiro** e ocupa no máximo `65svh`: em 390px de
largura ele sai com 373px de altura (44svh), que é a altura que a largura da
tela pede, e o `max-height` só aperta a caixa quando a largura mandaria num mapa
maior que isso (tablet em pé). É a faixa em que a malha aparece primeiro e a
primeira linha da grade já começa dentro da primeira dobra.

A ordem no DOM é mapa e depois grade, então a ordem de teclado também é: quem
navega por Tab encontra primeiro as UFs do mapa e depois as da grade. A grade
permanece a navegação em qualquer largura — uma malha de 360px é um retrato do
país, não um alvo de clique confiável.

## Por que SVG estático, e não uma biblioteca de mapa

O mapa é um `<svg>` com **um `<path>` por UF**, com a geometria já simplificada
e projetada (coordenadas prontas no `viewBox`). Não há Leaflet, D3, TopoJSON,
GeoJSON nem projeção em tempo de execução — nada disso precisa rodar no
navegador para mostrar contornos fixos.

É a mesma escolha do resto do projeto: dado estático e auditável, sem
dependência que não pague o próprio peso. O mapa vira HTML no build estático
(`dist/index.html`, a rota principal), então também funciona sem JavaScript.

| Peça                          | Onde                               |
| ----------------------------- | ---------------------------------- |
| Geometria das 27 UFs          | `src/data/brazil-map.ts`           |
| Desenho do SVG                | `src/components/BrazilMap.tsx`     |
| Estilo (hover, foco, hachura) | `src/components/BrazilMap.css`     |
| Tela                          | `src/components/EstadosScreen.tsx` |
| Forma em janela baixa         | `src/components/EstadosScreen.css` |
| Rota                          | `src/shared/router.ts` (`/`)       |

## Proveniência da malha

A geometria é derivada, com simplificação, do pacote `@svg-maps/brazil`:

- **Pacote:** `@svg-maps/brazil` v2.0.0
- **Origem:** <https://github.com/VictorCazanave/svg-maps/tree/master/packages/brazil>
- **Licença:** CC BY 4.0
- **Malha original:** IBGE (via MapSVG, <https://mapsvg.com/maps/brazil>)

Os `path` foram copiados para `src/data/brazil-map.ts` na data registrada no
próprio arquivo. **Não** há dependência em `package.json`: a geometria é
vendida como dado, no mesmo espírito de `src/data/quiz-source.ts`. A atribuição
aparece na tela (linha de legenda) e neste documento.

> Para regerar a malha, rode `npm pack @svg-maps/brazil`, extraia `index.js` e
> transcreva o array `locations` para `src/data/brazil-map.ts` (sigla em
> maiúsculas, `name` e `path` como vêm). Mantenha a data em "Obtido em".

## Como a acessibilidade foi montada

- O `<svg>` **não** leva `role="img"`: isso achataria os links das UFs e eles
  sumiriam da árvore de acessibilidade. O nome do mapa vem de `<title>`/`<desc>`
  ligados por `aria-labelledby`; o de cada UF, do `aria-label` do próprio link.
- Cada UF disponível é um `<a>` de verdade com `href` — abre em nova aba com
  clique modificador (Cmd/Ctrl/Shift/Alt) e o clique simples vira rota interna,
  igual aos links de ficha. O padrão está em `src/lib/links.ts`.
- O anel de foco é um `stroke` grosso desenhado na forma (não um `outline` reto
  encostado na caixa), e por isso o SVG usa `overflow: visible`.
- UFs indisponíveis ficam com hachura, sem foco e com cursor `not-allowed`; a
  grade repete a informação com o rótulo "Em breve". A hachura é o mesmo verde
  da UF disponível
  (`--color-tse-success`, `#3a833a`) com as linhas no teal escuro
  (`--color-tse-ink-700`, `#1a5668`), que é o que faz a textura aparecer sobre
  ele (1,74:1).
- A UF disponível é `--color-tse-success` (`#3a833a`), o verde de "sucesso" do
  portal do TSE. O contorno é o `--color-tse-ink-700` nas duas situações, e é
  ele que separa a forma do fundo do app: o fundo deixou de ser o canvas e
  passou a ser `--color-tse-primary` (`#206b82`), contra o qual o verde
  disponível dá só 1,29:1 e o próprio contorno 1,35:1 — ambos abaixo do
  mínimo de 3:1 da WCAG para contraste não textual. **A diferença entre
  disponível e indisponível não é comunicada pela cor**: quem a carrega é o
  preenchimento sólido contra a hachura. Se a hachura sair, a informação passa a
  depender de uma cor que não tem contraste.
- Há suporte a `prefers-reduced-motion` (a transição de preenchimento só existe
  quando a pessoa aceita movimento) e a `forced-colors` (alto contraste).
