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

Cada candidato é descrito por um *perfil* — as respostas que ele daria a cada
pergunta. Você responde o quiz e recebe um **ranking de todos os candidatos**,
da melhor compatibilidade para a pior.

## Como funciona

```
┌────────┐   ┌──────────────────────────┐   ┌──────────────────────────────┐
│  Início │──▶│ 5 perguntas × 3 opções  │──▶│ Resultado: ranking dos       │
└────────┘   └──────────────────────────┘   │ candidatos (1º destacado)    │
                                            └────────────────┬─────────────┘
                                                             │
                                ┌────────────────────────────┤
                                ▼                            ▼
                    ┌─────────────────────────┐   ┌──────────────────────┐
                    │ "Verificar imparcialidade│   │ "Recomeçar"          │
                    └─────────────────────────┘   └──────────────────────┘
```

O quiz é **imparcial por construção**. Com 5 perguntas e 3 opções existem
3⁵ = 243 combinações possíveis de respostas, e a pontuação é desenhada para
que, em média, cada um dos 15 candidatos vença uma parte delas. Qualquer
pessoa pode auditar isso a partir do resultado, pela tela
**"Verificar imparcialidade"**, que mostra a distribuição de vitórias entre
todas as 243 combinações.

Para um mergulho mais profundo, veja [docs/how-it-works.md](docs/how-it-works.md).

## Começando

**Pré-requisitos:** [Node.js](https://nodejs.org) 22 ou mais novo (usa o
type-stripping nativo do TypeScript e o `node:sqlite` experimental, sem
ferramentas extras) e o binário `unzip` do sistema.

```sh
npm install              # instala as dependências
npm run ingest           # baixa e sincroniza os dados oficiais do TSE (SQLite)
npm run dev              # inicia app (2026) + API (2027) → http://localhost:2026
```

A primeira execução do `npm run ingest` baixa os arquivos oficiais do TSE para
a eleição configurada e, no caminho, valida o schema real do CSV. Para
documentar o que foi observado no arquivo baixado:

```sh
npm run ingest -- --inspect   # gera/atualiza docs/tse-schema.md
```

### Scripts

| Comando                        | O que faz                                                     |
| ------------------------------ | ------------------------------------------------------------- |
| `npm run dev`                  | Inicia o app (Vite) e a API juntos; app na 2026, API na 2027  |
| `npm start`                    | Inicia somente o app (Vite) na porta 2026                     |
| `npm run api`                  | Inicia somente a API HTTP na porta 2027                       |
| `npm run ingest`               | Baixa e sincroniza os dados do TSE no SQLite local            |
| `npm run ingest -- --inspect`  | Documenta o schema observado em `docs/tse-schema.md`          |
| `npm run ingest -- --force`    | Rebaixa os arquivos do TSE mesmo se já existirem              |
| `npm run build`                | Checa os tipos e gera o build de produção em `dist/`          |
| `npm run preview`              | Visualiza o build de produção na porta 2026                   |
| `npm run lint`                 | Executa o lint com Oxlint                                     |
| `npm run test`                 | Roda os testes (node:test) do parser, da normalização e do repositório |
| `npm run check:distribution`   | Audita a imparcialidade em todas as 243 combinações           |

## Dados oficiais do TSE

A lista de candidatos é alimentada pelos dados abertos do TSE, não por um
arquivo manual. O pipeline:

```
ZIP do TSE → download → extração → parse CSV → validação → normalização
   → SQLite (atualização incremental) → API local → página de candidatos
   → fotos → pasta local → servidas por /photos
```

- **Fonte única de verdade:** os arquivos oficiais do TSE, configurados em
  `src/shared/elections.ts` (`ElectionConfig`) para a eleição atual
  (2026 / PR / Deputado Federal) e prontos para futuras eleições.
- **Proveniência:** cada candidato guarda a URL, o dataset, o arquivo-fonte e a
  data de obtenção; o histórico de sincronizações fica na tabela `sync_log`.
- **Incremental:** candidatos novos são inseridos, alterados são atualizados e
  removidos do arquivo ficam marcados como inativos — nada é sobrescrito às
  cegas.
- **Sem dependências:** o backend usa apenas o padrão do Node (`node:sqlite`,
  `node:http`, `node:test`) para monetar um banco local em `data/tse.db`.
- **Fotos** são um dataset opcional: se o download falhar, a lista carrega sem
  elas.

Detalhes de arquitetura e decisões em
[docs/how-it-works.md](docs/how-it-works.md).

## Estrutura do projeto

```
src/
├── data/quiz.ts             Tipos + conteúdo do quiz (perguntas, candidatos)
├── shared/
│   ├── elections.ts         Configuração das eleições (2026/PR/Deputado Federal)
│   ├── domain.ts            Modelo de domínio (CandidateRecord, Source)
│   └── api.ts               Contratos da API compartilhados com o frontend
├── data-sources/
│   ├── repository.ts        Banco SQLite (node:sqlite): candidatos, auditoria, sincronização
│   └── tse/
│       ├── csv.ts           Leitor de CSV mínimo (latin1, aspas, separador)
│       ├── download.ts      Download e extração dos ZIPs do TSE
│       ├── schema.ts        Dicionário de colunas e inspeção de schema
│       ├── candidates.ts    Ingestão dos candidatos da eleição configurada
│       ├── images.ts        Ingestão das fotos dos candidatos
│       ├── normalize.ts     Normalização de valores (datas, números, texto)
│       ├── validate.ts      Validação dos registros
│       └── assets/social/history.ts  Stubs tipados (próximas rodadas)
├── lib/scoring.ts           Pontuação por compatibilidade de perfil (ranking)
├── lib/distribution.ts      Auditoria de imparcialidade sobre todas as combinações
├── components/
│   ├── StartScreen.tsx      Tela de boas-vindas
│   ├── CandidatesScreen.tsx Lista de candidatos oficiais (via API)
│   ├── QuestionStep.tsx     Uma pergunta, suas opções e o progresso
│   ├── ResultScreen.tsx     Ranking de todos os candidatos, 1º destacado
│   └── FairnessScreen.tsx   Auditoria de distribuição imparcial
└── App.tsx                  Máquina de estados das telas
server/index.ts              API HTTP (node:http): candidatos + fotos
scripts/
├── ingest.ts                CLI de ingestão (--inspect, --force)
├── dev.ts                   Roda app + API juntos no desenvolvimento
├── check-distribution.ts    Auditoria de imparcialidade via CLI
├── csv.test.ts / normalize.test.ts / repository.test.ts  Testes (node:test)
docs/                        Guias de arquitetura, schema do TSE e de criação de conteúdo
```

## Criando conteúdo

O conteúdo do quiz vive inteiramente em
[`src/data/quiz.ts`](src/data/quiz.ts): perguntas, opções de resposta, perfis
dos candidatos e fotos de apoio. Um guia passo a passo está em
[docs/authoring-content.md](docs/authoring-content.md).

## Contribuindo

Contribuições são bem-vindas. Leia primeiro o
[CONTRIBUTING.md](CONTRIBUTING.md) e o
[Código de Conduta](CODE_OF_CONDUCT.md). Este projeto valoriza a leveza:
componentes nativos, estilos padrão e nenhuma dependência nova sem uma
conversa antes.

## Licença

[MIT](LICENSE) © 2026 Ana Laura de Araujo