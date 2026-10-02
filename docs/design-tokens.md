# Design tokens e o sistema visual

Este documento é a página única onde o sistema visual do app é decidido: quais
cores existem, onde vivem e como o código deve usá-las.

## Como o Tailwind está configurado

O projeto usa **Tailwind CSS v4**, integrado como plugin do Vite — não existe
`tailwind.config`; a configuração é declarativa, em CSS.

- `vite.config.ts` registra o plugin `tailwindcss()`.
- `src/main.tsx` importa `src/index.css`, o único arquivo de estilo global.
- `src/index.css` começa com `@import 'tailwindcss';` (theme + preflight +
  utilitários) e declara os tokens em um bloco `@theme`.

## A página de tokens: `src/index.css`

```css
@import 'tailwindcss';

@theme {
  /* Paleta de origem: bandeira do Brasil */
  --color-flag-green: #009739;
  --color-flag-yellow: #fedd00;
  --color-flag-blue: #012169;
  --color-flag-white: #ffffff;

  /* Paleta de origem: TSE (dadosabertos.tse.jus.br) */
  --color-tse-primary: #206b82;
  --color-tse-ink-900: #13404e;
  --color-tse-ink-700: #1a5668;
  --color-tse-ink-500: #2e759e;
  --color-tse-ink-200: #90b5c1;
  --color-tse-mist: #d2e1e6;
  --color-tse-mist-100: #e9ecef;
  --color-tse-body: #333333;
  --color-tse-success: #3a833a;
  --color-tse-danger: #d43f3a;
  --color-tse-warning: #fd7e14;
  --color-tse-info: #0dcaf0;

  /* Paleta de origem: marca do TSE (logo tse.svg) */
  --color-logo-yellow: #fcc200;
  --color-logo-slate: #5f7199;
  --color-logo-sage: #5b6e6e;

  /* Papéis — referenciam as paletas, não repetem hex */
  --color-primary: var(--color-flag-green);
  --color-primary-soft: #069400;
  --color-secondary: var(--color-tse-warning);
  --color-secondary-soft: #f97316;
  --color-tertiary: #f59e0b;
  --color-tertiary-soft: var(--color-flag-yellow);
  --color-canvas: var(--color-tse-ink-200);
  --color-panel: var(--color-logo-slate);
  --color-deep: var(--color-flag-blue);
  --color-link: var(--color-tse-primary);
  --color-ink: #242424;
  --color-gray: #bcb7bc;
}
```

### As três paletas de origem

O app tem três fontes de cor, e elas não se misturam num gradiente: cada uma
entra inteira, com o nome da fonte no prefixo do token.

| Prefixo  | Fonte                                             | Uso no app                                     |
| -------- | ------------------------------------------------- | ---------------------------------------------- |
| `flag-*` | bandeira do Brasil (flagcolorcodes.com/brazil)    | verde e amarelo dos botões, azul de superfície |
| `tse-*`  | portal de dados abertos (dadosabertos.tse.jus.br) | neutros de superfície, link, destrutivo        |
| `logo-*` | logo do TSE (`tse.svg`)                           | o painel do grid                               |

Três coisas que valem registrar:

- **`tse-primary` (`#206b82`) é a cor do portal, não do logo.** O portal é um
  Bootstrap 4 com a pele trocada: o TSE sobrescreveu `primary`/`blue` com um
  teal e a escala `success`/`danger`/`warning`/`info`. O resto é cinza de tabela.
- **O logo tem três preenchimentos e nenhum é o teal do site** — amarelo do
  losango (`#fcc200`), azul-acinzentado do círculo (`#5f7199`) e
  verde-acinzentado do triângulo (`#5b6e6e`). O `#5f7199` é o que virou
  `--color-panel`.
- **Nenhum papel aponta direto para um hex de paleta.** Todos referenciam pelo
  nome, o que dá para responder "de onde veio essa cor?" olhando o token, e
  trocar uma paleta inteira sem caçar hex solto pelo CSS.

Cada `--color-*` declarado em `@theme` gera, de uma vez:

1. uma **variável CSS** em `:root` (ex.: `var(--color-primary)`); e
2. os **utilitários Tailwind** correspondentes (ex.: `bg-primary`,
   `text-primary-soft`, `border-secondary`).

### Tokens atuais

| Token                    | Hex       | Papel                    | Uso principal                                         |
| ------------------------ | --------- | ------------------------ | ----------------------------------------------------- |
| `--color-primary`        | `#009739` | Verde principal (escuro) | texto/linha do botão primary                          |
| `--color-primary-soft`   | `#069400` | Verde intermediário      | tint/borda do botão primary                           |
| `--color-secondary`      | `#fd7e14` | Laranja                  | texto/linha do botão secondary                        |
| `--color-secondary-soft` | `#f97316` | Laranja claro            | tint/borda do botão secondary                         |
| `--color-tertiary`       | `#f59e0b` | Amarelo                  | texto/linha do botão tertiary                         |
| `--color-tertiary-soft`  | `#fedd00` | Amarelo vivo             | tint/borda do botão tertiary                          |
| `--color-primary-on`     | `#111111` | Texto sobre `primary`    | conteúdo sobre superfície primary                     |
| `--color-secondary-on`   | `#111111` | Texto sobre `secondary`  | conteúdo sobre superfície secondary                   |
| `--color-tertiary-on`    | `#111111` | Texto sobre `tertiary`   | conteúdo sobre superfície tertiary                    |
| `--color-gray`           | `#bcb7bc` | Cinza da urna eletrônica | detalhes de interface                                 |
| `--color-canvas`         | `#90b5c1` | Superfície média         | superfície sobre a qual o card se destaca             |
| `--color-ink`            | `#242424` | Tinta do texto           | texto base, herdado por `body`; também o anel de foco |
| `--color-panel`          | `#5f7199` | Painel do grid           | fundo do grid de candidatos (`var(--color-panel)`)    |
| `--color-deep`           | `#012169` | Superfície escura        | a superfície mais escura do app                       |
| `--color-link`           | `#206b82` | Link e fonte de dado     | link para a fonte oficial (ex.: o TSE)                |

Os tokens `-on` existem porque as famílias pedem tintas opostas: verde e
amarelo **só** passam em WCAG AA com `#111` (3,83:1, 2,57:1 e 2,15:1 contra
`#ffffff`), enquanto o teal e o azul **só** passam com `#ffffff` (6,02:1 e
14,76:1). Não dá para tratar "TSE + Brasil" como uma família única de cor, e
por isso cada cor cheia tem o seu `-on`. Quem pinta uma superfície com a cor
cheia pega o `-on` correspondente em vez de hardcodar branco.

### A tinta e o fundo, medidos

O fundo da página é `--color-tse-primary` (`#206b82`, o teal do portal) e a
tinta do texto base é o `--color-tse-mist-100` (`#e9ecef`). São o par que mais
aparece na tela, então vale registrar as razões de contraste:

| Combinação                            | Razão  | WCAG            |
| ------------------------------------- | ------ | --------------- |
| texto base sobre o fundo teal         | 5,08:1 | AA texto normal |
| texto base sobre o painel             | 4,11:1 | AA texto normal |
| texto base sobre o card               | 1,08:1 | reprova         |
| texto base sobre o branco             | 1,19:1 | reprova         |
| texto secundário (`muted-foreground`) | 1,86:1 | reprova         |
| borda (`border`) sobre o fundo teal   | 1,55:1 | reprova         |
| anel de foco sobre o card             | 4,46:1 | passa de 3:1    |
| anel de foco sobre o fundo teal       | 1,24:1 | reprova         |

A tinta é clara porque o fundo é escuro: trocar o fundo para um teal médio
inverteu a direção do par e deixou o texto base reprovando sobre o card, que é
claro. Por isso `--color-panel-on` continua branco e o card precisa de tinta
própria — ele não pode herdar a base.

O que **não** acompanhou a inversão foram os tokens que ainda são escuros: o
`--muted-foreground` (`ink-900`) e o `--border` (`ink-700`) continuam apontando
para o teal quase-preto do TSE, e os dois se desfazem sobre o fundo teal. Vale
registrar porque a correção é do fundo, não dos textos: ou o fundo volta a ser
claro, ou esses dois tokens ganham uma variante clara.

Duas medidas explicam por que o anel deixou de ser uma cor de marca: o verde da
bandeira, que era a escolha antes, e o `--color-tse-primary` não chegam a 3:1
sobre a superfície onde o anel aparece, o mínimo de WCAG para indicador não
textual, e o anel de teclado é a única pista de foco de quem não usa mouse. O
`--color-panel` foi o que sobrava com contraste suficiente no card — mas é
justamente por ele não funcionar sobre o fundo teal que os elementos focáveis
que vivem direto na página não podem usar `outline-panel`.

## A camada semântica (`:root`)

Os componentes em `src/components/ui/` (kit no padrão shadcn) usam nomes
semânticos — `background`, `muted`, `border`, `ring`, `primary-foreground` —
que não são tokens da marca. Para que continuem lendo as cores **da mesma
fonte**, `src/index.css` tem um segundo bloco, logo abaixo do `@theme`:

```css
:root {
  --foreground: var(--color-ink);
  --background: var(--color-canvas);
  --card: color-mix(in srgb, var(--color-tse-mist-100) 55%, #ffffff);
  --card-foreground: var(--foreground);
  --muted: color-mix(in srgb, var(--color-gray) 22%, transparent);
  --muted-foreground: var(--color-tse-ink-900);
  --accent: color-mix(in srgb, var(--color-tse-primary) 12%, transparent);
  --border: color-mix(in srgb, var(--color-tse-ink-700) 65%, transparent);
  --input: color-mix(in srgb, var(--color-tse-ink-700) 85%, transparent);
  --ring: var(--color-ink);
  --destructive: var(--color-tse-danger);
}

@theme inline {
  --color-background: var(--background);
  --color-muted: var(--muted);
  /* … */
  --color-primary-foreground: var(--color-primary-on);
  --radius: 1rem;
  --radius-sm: calc(var(--radius) * 0.6);
  /* … */
}
```

Três regras mantêm a "fonte única" de verdade:

1. **A camada `:root` não repete hex da marca.** Cada valor aponta para um
   token de `@theme`. O único hex que aparece é o `#ffffff` misturado no card,
   que não é cor da marca. O texto base não aparece mais: é
   `var(--color-ink)`.
2. **`primary`, `secondary` e `tertiary` não são redeclarados.** O shadcn usa
   esses nomes com o mesmo sentido que o projeto já usava, então `bg-primary`
   continua resolvendo para `--color-primary`. O `@theme inline` expõe só os
   nomes que **ainda não existiam**.
3. **`-foreground` aponta para os tokens `-on`.** O shadcn usaria branco; o
   `--color-primary-on` garante o contraste AA que a tabela acima mediu.

O `--radius` segue a mesma lógica dos tokens de cor: um valor base e uma escala
derivada, então mudar `--radius` move o app inteiro.

### Como o kit consome os tokens

Os componentes em `src/components/ui/` são **código do próprio repositório**, não
um pacote: `npx shadcn@latest add <nome>` copia o arquivo para
`src/components/ui/` e a partir daí ele é seu. Editar o `button.tsx` do shadcn é
um commit normal neste projeto.

Isso é o que mantém a camada semântica honesta: como o código é nosso, nada
obriga o kit a usar nomes genéricos — `button.tsx` já mapeia suas variantes para
`primary`/`secondary`/`tertiary` do projeto, e `badge.tsx` expõe exatamente as
três cores da marca.

## Usando as cores no código

Em **JSX/TSX**, prefira as utilitárias Tailwind:

```tsx
<main className="min-h-screen bg-canvas">…</main>
<p className="text-primary-soft">…</p>
```

Em **CSS/estilos dinâmicos**, use a variável diretamente:

```css
background: var(--color-primary);
```

Regra prática: se a cor fica em HTML/componente, use utilitária; se precisa
calcular/compor com `color-mix` em runtime, use a variável CSS.

## Os dois botões: `SpecularButton` e `Button`

O app tem **dois** botões, com fronteiras explícitas.

| Componente                                             | Quando                                                                  | Por quê                                                                                        |
| ------------------------------------------------------ | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `SpecularButton` (`src/components/SpecularButton.tsx`) | CTA de destaque: "Começar", "Ver candidatos", "Recomeçar"               | É a assinatura visual do app — um shader WebGL que segue o ponteiro. Só onde o brilho importa. |
| `Button` (`src/components/ui/button.tsx`)              | Tudo o mais: opções do quiz, "Tentar novamente", voltar, ações de ficha | Botão comum, sem WebGL. É o que viabiliza listas longas.                                       |

A fronteira não é estética, é de contexto WebGL: cada `SpecularButton` abre um
contexto próprio, e o navegador aceita poucos. Por isso o resultado, quando
mostra todos de uma vez, usa o `.sb-link` (um `<a>` de verdade), e a lista de
428 candidatos usa os cards do `CandidateGrid`, que não abrem contexto nenhum.
Ver o comentário em `src/index.css`.

### O `SpecularButton` em detalhe

O `SpecularButton` aplica o mesmo estilo estrutural em variantes de cor.

```tsx
<SpecularButton variant="primary" size="lg">Começar</SpecularButton>
<SpecularButton variant="secondary" size="md">Ver candidatos</SpecularButton>
```

| Variante  | tint/base                | texto/linha         |
| --------- | ------------------------ | ------------------- |
| primary   | `--color-primary-soft`   | `--color-primary`   |
| secondary | `--color-secondary-soft` | `--color-secondary` |

As variantes leem as cores **do próprio CSS**: `specularTheme.ts` mapeia cada
variante para os nomes dos tokens (`TOKENS`) e resolve os valores com
`getComputedStyle` (`getSpecularTheme`). O shader WebGL precisa das cores como
valores RGB em **runtime**, então a resolução acontece em JS — mas a fonte é uma
só: o `@theme` em `src/index.css`.

- `src/index.css` (`@theme`) — **fonte única** das cores (utilitárias, CSS e
  shader).
- `src/components/specularTheme.ts` — só o mapeamento variante → token e um
  `FALLBACK` de hexes apenas se a variável CSS não estiver disponível no
  runtime.

**Regra:** para mudar uma cor, edite apenas `src/index.css` — o botão e as
utilitárias seguem automaticamente.

### Como adicionar uma variante de cor ao botão

1. Declare os tokens novos em `src/index.css` (`@theme`).
2. Adicione a entrada em `TOKENS` e o fallback em `FALLBACK`
   (`specularTheme.ts`).
3. Atualize o tipo `SpecularVariant`.

## O kit em `src/components/ui/`

Os componentes básicos (button, card, badge, input, label, skeleton, progress,
radio-group, sheet, tooltip, sonner) seguem o **formato** do shadcn/ui: código
copiado para o repositório, Radix por baixo, `class-variance-authority` para
variantes e `cn()` para classes. O que o diferencia do shadcn padrão é que as
cores apontam para os tokens deste projeto, não para uma paleta neutra.

Para adicionar um componente ao kit:

```sh
npx shadcn@latest add <nome>   # copia para src/components/ui/
```

Depois do `add`, revise o arquivo: as classes de cor precisam estar nos tokens
deste projeto (`primary`, `secondary`, `tertiary`, `muted`, `border`, `ring`,
`card`) e nunca em hex solto. É o mesmo trabalho de `button.tsx`.

Duas cuidados práticos:

- **`init` não deve ser rodado neste repositório.** Ele reescreve o bloco
  `@theme` de `src/index.css`, que é a fonte única das cores. O
  `components.json` da raiz já está configurado — só use `add`.
- **Componentes não usados não pesam no bundle.** `sheet.tsx`, `tooltip.tsx` e
  `sonner.tsx` estão no kit para telas futuras e ficam de fora do `dist/` até
  alguém importá-los.

## Formatação (Prettier)

O padrão do projeto é **aspas simples e sem ponto-e-vírgula**, garantido pelo
`.prettierrc.json` na raiz.

```sh
npm run format        # aplica o Prettier em todo o repositório
npm run format:check  # verifica (útil em CI / antes do PR)
```

Arquivos ignorados: `data/` (banco local) e `dist/` (build) — ver
`.prettierignore`.
