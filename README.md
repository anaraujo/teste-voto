# teste-voto

Um quiz imparcial para ajudar os moradores do condomínio a descobrir qual
candidato combina melhor com seus ideais, valores e prioridades.

[![Licença: MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-blue)](LICENSE)
[![React](https://img.shields.io/badge/react-19-blue?logo=react&logoColor=61DAFB)](https://react.dev)
[![Vite](https://img.shields.io/badge/vite-8-646CFF?logo=vite&logoColor=646CFF)](https://vite.dev)
[![TypeScript](https://img.shields.io/badge/typescript-6-3178C6?logo=typescript&logoColor=3178C6)](https://www.typescriptlang.org)

---

## O que é isto?

Um aplicativo web no espírito de um quiz clássico: poucas perguntas curtas,
respostas curtas e um resultado no final. Ele responde a uma pergunta para o
prédio inteiro: **"Em quem eu voto?"**

Cada candidato é descrito por um _perfil_ — as respostas que ele daria a cada
pergunta. Você responde o quiz e recebe um **ranking de todos os candidatos**,
da melhor compatibilidade para a pior.

## Como funciona

```
┌────────┐   ┌──────────────────────────┐   ┌──────────────────────────────┐
│  Início │──▶│ 5 perguntas (10/3/4/2/2)│──▶│ Resultado: ranking dos       │
└────────┘   └──────────────────────────┘   │ candidatos (1º destacado)    │
                                            └────────────────┬─────────────┘
                                                             │
                                 ┌───────────────────────────┤
                                 ▼                           ▼
                     ┌─────────────────────────┐   ┌──────────────────────┐
                     │ "Verificar imparcialidade│   │ "Recomeçar"          │
                     └─────────────────────────┘   └──────────────────────┘
```

O quiz é **imparcial por construção** e usa os **428 candidatos reais** a
deputado federal pelo Paraná em 2026 (dados do TSE). Suas 5 perguntas têm
10×3×4×2×2 = **480 combinações** possíveis de respostas, e a auditoria verifica
que nenhum candidato vence de forma desproporcional. Qualquer pessoa pode
auditar pelo resultado, pela tela **"Verificar imparcialidade"**.

Uma rápida visão do desenho do quiz (perguntas, resolvedores, cobertura) está
em [docs/quiz-design.md](docs/quiz-design.md); para a arquitetura completa,
veja [docs/how-it-works.md](docs/how-it-works.md).

## Começando

**Pré-requisitos:** [Node.js](https://nodejs.org) 22 ou mais novo (usa o
type-stripping nativo do TypeScript e o `node:sqlite` experimental, sem
ferramentas extras) e o binário `unzip` do sistema.

```sh
npm install              # instala as dependências
npm run ingest           # baixa e sincroniza os dados oficiais do TSE (SQLite)
npm run sync:incumbents  # marca os deputados federais em exercício (API Câmara)
npm run dev              # inicia app (2026) + API (2027) → http://localhost:2026
```

A primeira execução do `npm run ingest` baixa os arquivos oficiais do TSE para
a eleição configurada e, no caminho, valida o schema real do CSV. Para
documentar o que foi observado no arquivo baixado:

```sh
npm run ingest -- --inspect   # gera/atualiza docs/tse-schema.md
```

### Scripts

| Comando                       | O que faz                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| `npm run dev`                 | Inicia o app (Vite) e a API juntos; app na 2026, API na 2027                                           |
| `npm start`                   | Inicia somente o app (Vite) na porta 2026                                                              |
| `npm run api`                 | Inicia somente a API HTTP na porta 2027                                                                |
| `npm run ingest`              | Baixa e sincroniza os dados do TSE no SQLite local (com complementar, bens e redes)                    |
| `npm run ingest -- --inspect` | Documenta o schema observado em `docs/tse-schema.md`                                                   |
| `npm run ingest -- --force`   | Rebaixa os arquivos do TSE mesmo se já existirem                                                       |
| `npm run sync:incumbents`     | Casa os deputados PR em exercício com os candidatos (API Câmara)                                       |
| `npm run build`               | Checa os tipos e gera o build de produção em `dist/`                                                   |
| `npm run preview`             | Visualiza o build de produção na porta 2026                                                            |
| `npm run lint`                | Executa o lint com Oxlint                                                                              |
| `npm run format`              | Aplica o Prettier em todo o repositório (aspas simples, sem `;`)                                       |
| `npm run format:check`        | Verifica a formatação sem alterar arquivos                                                             |
| `npm run test`                | Roda os testes (node:test): CSV, normalização, repositório, complementar, identidade, quiz e pontuação |
| `npm run check:distribution`  | Audita a imparcialidade em todas as 480 combinações                                                    |

## Dados oficiais do TSE

A lista de candidatos é alimentada pelos dados abertos do TSE, não por um
arquivo manual. O pipeline:

```
ZIP do TSE → download → extração → parse CSV → validação → normalização
   → SQLite (atualização incremental) → enriquecimento (complementar, bens,
   redes) → API local → página de candidatos → fotos → /photos
   → Câmara (incumbentes) → marcação de reeleição
```

- **Fonte única de verdade:** os arquivos oficiais do TSE, configurados em
  `src/shared/elections.ts` (`ElectionConfig`) para a eleição atual
  (2026 / PR / Deputado Federal) e prontos para futuras eleições.
- **Proveniência:** cada candidato guarda a URL, o dataset, o arquivo-fonte e a
  data de obtenção; o histórico de sincronizações fica na tabela `sync_log`.
- **Incremental:** candidatos novos são inseridos, alterados são atualizados e
  removidos do arquivo ficam marcados como inativos — nada é sobrescrito às
  cegas.
- **Enriquecimento por `SQ_CANDIDATO`:** município de nascimento, etnia/quilombola,
  teto de gastos, bens declarados e redes sociais são unidos na mesma rodada.
- **Incumbentes:** os ~25 deputados federais em exercício que concorrem de novo
  são casados por nome + data de nascimento com registros da Câmara
  (`npm run sync:incumbents`).
- **Sem dependências:** o backend usa apenas o padrão do Node (`node:sqlite`,
  `node:http`, `node:test`) para manter um banco local em `data/tse.db`.
- **Fotos** são um dataset opcional: se o download falhar, a lista carrega sem
  elas.

Detalhes de arquitetura e decisões em
[docs/how-it-works.md](docs/how-it-works.md).

## Estrutura do projeto

```
src/
├── data/
│   ├── quiz.ts             Tipos + re-exportação das perguntas (contrato)
│   └── quiz-source.ts      Fonte oficial do quiz: perguntas + resolvedores
├── shared/
│   ├── elections.ts        Configuração das eleições (2026/PR/Deputado Federal)
│   ├── domain.ts           Modelo de domínio (CandidateRecord, Source)
│   └── api.ts              Contratos da API compartilhados com o frontend
├── hooks/useCandidates.ts  Estado de carregamento da lista de candidatos
├── hooks/useQuizAnswers.ts Respostas do quiz (sessionStorage)
├── shared/router.ts        Rotas puras: caminho de URL ↔ tela
├── data-sources/
│   ├── repository.ts       Banco SQLite (node:sqlite): candidatos, incumbentes, auditoria
│   ├── tse/
│   │   ├── csv.ts          Leitor de CSV mínimo (latin1, aspas, separador)
│   │   ├── download.ts     Download e extração dos ZIPs do TSE
│   │   ├── schema.ts       Dicionário de colunas e inspeção de schema
│   │   ├── candidates.ts   Ingestão base + loadDescriptorCsv (helper de datasets)
│   │   ├── complementar.ts Dados complementares (município, teto de gastos, etnia, urna)
│   │   ├── assets.ts       Bens declarados (soma por candidato)
│   │   ├── social.ts       Redes sociais (links por candidato)
│   │   ├── images.ts       Fotos oficiais
│   │   ├── normalize.ts    Normalização de valores (datas, números, texto)
│   │   ├── validate.ts     Validação dos registros
│   │   └── enrich.ts       Merge puro dos enriquecimentos no registro
│   └── camara/
│       ├── deputados.ts   Deputados em exercício (API de Dados Abertos)
│       └── identity.ts    Casamento por nome + data de nascimento
├── lib/scoring.ts          Pontuação por compatibilidade de perfil + desempate
├── index.css               Design tokens (Tailwind v4 @theme) — veja docs/design-tokens.md
├── components/
│   ├── StartScreen.tsx     Tela de boas-vindas
│   ├── CandidatesScreen.tsx Lista de candidatos oficiais (via API)
│   ├── QuestionStep.tsx     Uma pergunta, suas opções e o progresso
│   ├── ResultScreen.tsx     Ranking de todos os candidatos, 1º destacado
│   ├── FairnessScreen.tsx   Auditoria de distribuição imparcial
│   ├── AppHeader.tsx        Cabeçalho com o botão de voltar
│   ├── NotFoundScreen.tsx   Rota desconhecida
│   ├── SpecularButton.tsx   Botão de CTA com variantes primary/secondary (WebGL)
│   └── specularTheme.ts     Mapeamento variante→token; lê as cores do CSS
├── AppRouter.tsx           Cliente do roteamento (History API)
└── App.tsx                 Renderiza a tela da rota
server/index.ts             API HTTP (node:http): candidatos + fotos
scripts/
├── ingest.ts               CLI de ingestão (--inspect, --force)
├── sync-incumbents.ts      Casa deputados PR com candidatos (--force)
├── dev.ts                  Roda app + API juntos no desenvolvimento
├── check-distribution.ts   Auditoria de imparcialidade via CLI
├── *.test.ts               Testes (node:test)
docs/                       Guias de arquitetura, schema do TSE, quiz e de conteúdo
```

## Criando conteúdo

O conteúdo do quiz vive em
[`src/data/quiz-source.ts`](src/data/quiz-source.ts): perguntas, opções,
resolvedores puros e proveniência. Os perfis dos candidatos são derivados dos
dados oficiais do TSE — nada é escrito à mão por candidato. Um guia passo a
passo está em [docs/authoring-content.md](docs/authoring-content.md) e o desenho
do quiz em [docs/quiz-design.md](docs/quiz-design.md).

## Rotas

Cada tela tem uma URL — `/`, `/candidatos`, `/candidato/:id`, `/quiz/:n`,
`/resultado` e `/imparcialidade` — então a ficha de um candidato pode ser
compartilhada e o botão voltar do navegador funciona. O par caminho ↔ tela mora
em [`src/shared/router.ts`](src/shared/router.ts), um módulo puro sem
dependência de roteamento; o botão de voltar do cabeçalho tem destino
determinístico. As páginas são geradas estaticamente no build: ver
[docs/how-it-works.md](docs/how-it-works.md).

## Design system

As cores do app são declaradas em uma única página de tokens
(`src/index.css`, bloco `@theme` do Tailwind v4): cada cor vira uma variável
CSS global e utilitárias (`bg-primary`, `text-primary-soft` etc.). O
`SpecularButton` usa essas cores em duas variantes que compartilham o mesmo
estilo — **primary** (verde) e **secondary** (laranja). Formatação padronizada
com Prettier (aspas simples, sem `;`). Leia [docs/design-tokens.md](docs/design-tokens.md).

## Contribuindo

Contribuições são bem-vindas. Leia primeiro o
[CONTRIBUTING.md](CONTRIBUTING.md) e o
[Código de Conduta](CODE_OF_CONDUCT.md). Este projeto valoriza a leveza:
estilo guiado pelo design system (tokens + Tailwind), dependências novas
apenas com uma conversa antes.

## Licença

[MIT](LICENSE) © 2026 Ana Laura de Araujo
