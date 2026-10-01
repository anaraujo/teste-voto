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
  /* Verde — variante primary do botão */
  --color-primary: #009739;
  --color-primary-soft: #069400;

  /* Laranja — variante secondary do botão */
  --color-secondary: #f59e0b;
  --color-secondary-soft: #fb3f13;

  /* Neutros */
  --color-gray: #bcb7bc;
  --color-eggshell: #f0ead6;
}
```

Cada `--color-*` declarado em `@theme` gera, de uma vez:

1. uma **variável CSS** em `:root` (ex.: `var(--color-primary)`); e
2. os **utilitários Tailwind** correspondentes (ex.: `bg-primary`,
   `text-primary-soft`, `border-secondary`).

### Tokens atuais

| Token                    | Hex       | Papel                    | Uso principal                       |
| ------------------------ | --------- | ------------------------ | ----------------------------------- |
| `--color-primary`        | `#009739` | Verde principal (escuro) | texto/linha do botão primary        |
| `--color-primary-soft`   | `#069400` | Verde intermediário      | tint/borda do botão primary         |
| `--color-secondary`      | `#fb3f13` | Laranja                  | texto/linha do botão secondary      |
| `--color-secondary-soft` | `#f97316` | Laranja claro            | tint/borda do botão secondary       |
| `--color-tertiary`       | `#f59e0b` | Amarelo                  | texto/linha do botão tertiary       |
| `--color-tertiary-soft`  | `#fedd00` | Amarelo vivo             | tint/borda do botão tertiary        |
| `--color-primary-on`     | `#111111` | Texto sobre `primary`    | conteúdo sobre superfície primary   |
| `--color-secondary-on`   | `#111111` | Texto sobre `secondary`  | conteúdo sobre superfície secondary |
| `--color-tertiary-on`    | `#111111` | Texto sobre `tertiary`   | conteúdo sobre superfície tertiary  |
| `--color-gray`           | `#bcb7bc` | Cinza da urna eletrônica | detalhes de interface               |
| `--color-eggshell`       | `#f0ead6` | Fundo creme da página    | fundo do app (`bg-eggshell`)        |

Os tokens `-on` existem porque nenhuma das três cores da marca passa em
WCAG AA com texto branco (3,83:1, 3,61:1 e 2,15:1 contra `#ffffff`); com
`#111` as três passam (4,93:1, 5,24:1 e 8,79:1). Quem pinta uma superfície
com a cor cheia pega o `-on` correspondente.

## A camada semântica (`:root`)

Os componentes em `src/components/ui/` (kit no padrão shadcn) usam nomes
semânticos — `background`, `muted`, `border`, `ring`, `primary-foreground` —
que não são tokens da marca. Para que continuem lendo as cores **da mesma
fonte**, `src/index.css` tem um segundo bloco, logo abaixo do `@theme`:

```css
:root {
  --foreground: #111111;
  --background: var(--color-eggshell);
  --card: color-mix(in srgb, var(--color-eggshell) 70%, #ffffff);
  --card-foreground: var(--foreground);
  --muted: color-mix(in srgb, var(--color-gray) 22%, transparent);
  --accent: color-mix(in srgb, var(--color-primary-soft) 12%, transparent);
  --border: color-mix(in srgb, var(--color-gray) 55%, transparent);
  --input: color-mix(in srgb, var(--color-gray) 70%, transparent);
  --ring: var(--color-primary);
  --destructive: var(--color-secondary);
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
   token de `@theme`. Os dois hex que aparecem — `#111111` (texto base) e
   `#ffffff` (misturado no card) — não são cores da marca.
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
<main className="min-h-screen bg-primary">…</main>
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
contexto próprio, e o navegador aceita poucos. Por isso a lista de 428 candidatos
usa o `.sb-link` (um `<a>` de verdade) e o resultado, quando mostra todos, também.
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
