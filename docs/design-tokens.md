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

## O botão com variantes (`SpecularButton`)

O `SpecularButton` aplica o mesmo estilo estrutural em duas variantes de cor.

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

## Formatação (Prettier)

O padrão do projeto é **aspas simples e sem ponto-e-vírgula**, garantido pelo
`.prettierrc.json` na raiz.

```sh
npm run format        # aplica o Prettier em todo o repositório
npm run format:check  # verifica (útil em CI / antes do PR)
```

Arquivos ignorados: `data/` (banco local) e `dist/` (build) — ver
`.prettierignore`.
