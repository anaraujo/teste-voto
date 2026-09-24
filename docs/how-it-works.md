# Como o teste-voto funciona

Um passeio pela arquitetura, pelo modelo de dados e pelo modelo de pontuação —
escrito para que uma pessoa recém-chegada consiga guardar o projeto inteiro na
cabeça em uma única leitura.

## Princípios

O projeto valoriza a leveza acima de tudo:

- Elementos HTML nativos com seu estilo padrão. Sem framework de CSS, sem
  biblioteca de componentes. Uma passada de estilização virá depois.
- Nenhuma dependência desnecessária. Toda dependência precisa conquistar seu
  lugar em uma conversa primeiro.
- Módulos pequenos e focados, cada um com uma única responsabilidade.
- A lógica é pura e os dados são declarativos, para que o aplicativo possa ser
  auditado, estendido e testado sem cerimônia.

## Estrutura do projeto

```
src/
├── data/quiz.ts             Conteúdo declarativo: perguntas + candidatos
├── shared/                  Configuração de eleições e contratos de domínio/API
├── data-sources/            Repositório SQLite + módulo TSE (CSV, fotos, normalize)
├── lib/scoring.ts           Pontuação pura: ranking de candidatos
├── lib/distribution.ts      Auditoria pura de imparcialidade sobre as combinações
├── components/              Um componente por tela
│   ├── StartScreen.tsx      Boas-vindas
│   ├── CandidatesScreen.tsx Lista de candidatos oficiais (via API)
│   ├── QuestionStep.tsx     Uma pergunta e suas opções
│   ├── ResultScreen.tsx     Ranking completo dos candidatos
│   └── FairnessScreen.tsx   Auditoria de imparcialidade
└── App.tsx                  A máquina de estados das telas
server/index.ts              API HTTP (node:http): candidatos + fotos
scripts/                     ingestão, dev runner, auditoria CLI e testes
```

## Modelo de dados

O conteúdo do *quiz* é declarativo em `src/data/quiz.ts`.

```
Pergunta
├── id       ex.: "q1"
├── title    ex.: "Pergunta 1"
└── options  Option[]

Opção
├── id       ex.: "a" | "b" | "c"
├── label    texto curto da resposta
└── photo?   foto de apoio (opcional)

Candidato
├── id           ex.: "c1"
├── name         ex.: "Candidato 1"
├── description  exibida na tela de resultado
├── photo?       foto do resultado (opcional)
└── profile      Record<QuestionId, OptionId>  ← as respostas que este candidato daria
```

O `profile` é o coração do modelo: é um gabarito completo de respostas, um id
de opção por pergunta. O aplicativo nunca precisa saber *por que* um candidato
combina com uma resposta — apenas que combina.

## O fluxo

`App.tsx` é uma máquina de estados pequena, com cinco telas.

```
início ──▶ candidatos ──┐
   │                    │
   ▼                    ▼
pergunta(0) ──▶ … ──▶ resultado ──▶ imparcialidade
   ▲                             │
   └──────────── reinício ◀──────┘
```

- A tela inicial pode levar direto à lista de **candidatos** (foto, nome e
  descrição) ou ao quiz.
- As respostas acumulam em um `Record<QuestionId, OptionId>`.
- Escolher uma opção registra a resposta e avança para a próxima pergunta — ou
  para a tela de resultado, após a última.
- A tela de resultado oferece duas saídas: reiniciar ou auditar a
  imparcialidade.

## O modelo de pontuação

Cada candidato tem um perfil. Após a última pergunta, todos os candidatos são
pontuados contando quantas respostas da pessoa coincidem com o perfil do
candidato.

```
pontuação(candidato) = número de perguntas em que
                       respostas[pergunta.id] === candidato.perfil[pergunta.id]
```

`rankResults` pondera todos os candidatos e ordena do maior para o menor número
de compatibilidades. Os empates são resolvidos de forma determinística: entre
candidatos com a mesma pontuação, vale a ordem de declaração no array
(`sort` estável). Assim, um mesmo conjunto de respostas sempre produz o mesmo
ranking, sem ambiguidade.

A tela de resultado exibe o ranking completo, com o primeiro colocado marcado
como **"Melhor compatibilidade"** (elemento `<mark>` nativo nessa posição).
Cada candidato pode ser expandido com o elemento nativo `<details>` para
revelar o detalhamento pergunta a pergunta: o que a pessoa respondeu, o que o
perfil do candidato previa e se houve correspondência (`questionMatches` em
`src/lib/scoring.ts`).

### Falha graciosa

O `computeResult` retorna `RankedEntry | null`. O único cenário em que é `null`
é quando a lista de candidatos está vazia. Nesse caso a tela de resultado mostra
uma mensagem de erro amigável e um botão **"Tentar novamente"** que recarrega a
página — sem exception para a pessoa ver.

### Por que um teste imparcial, e não um teste manipulado

Com 5 perguntas × 3 opções existem 3⁵ = 243 combinações possíveis de respostas.
`src/lib/distribution.ts` enumera cada uma delas e roda a mesma pontuação,
contabilizando quantas vezes cada candidato vence. Um quiz perfeito dividiria
as 243 combinações igualmente: 243 ÷ 15 ≈ 16 vitórias por candidato
(≈ 6,7% cada).

Essa auditoria é exposta em dois lugares:

1. **A tela "Verificar imparcialidade"** no app
   (`FairnessScreen.tsx`), acessível a partir de qualquer resultado — para que
   os eleitores possam verificar, dentro do próprio teste, que ele foi justo.
2. **`npm run check:distribution`**, um wrapper de CLI que imprime os mesmos
   números no terminal, para iteração rápida enquanto se escreve o conteúdo.

Como ambos consomem a mesma função pura
`computeDistribution(questions, candidates)`, o app e a CLI nunca podem
discordar.

## A camada de dados: ingestão do TSE e API

Além do quiz, o projeto mantém uma base local de candidatos oficiais. A regra
central é: **o TSE é a fonte única de verdade**, e nada de resposta é
inventado — tudo o que aparece veio de um arquivo oficial e carrega sua
proveniência.

### Configuração de eleição

`src/shared/elections.ts` define `ElectionConfig` e a eleição atual
(2026 / PR / Deputado Federal) com as URLs dos datasets oficiais. Nenhuma URL
vive na lógica — as próximas eleições (2028, 2030, outras UF/cargos) entram
apenas como uma nova configuração.

### O pipeline de ingestão (`scripts/ingest.ts`)

```
ZIP do TSE → download → extração (unzip) → parse CSV → validação
   → normalização → SQLite (incremental) → API → página de candidatos
```

1. **Download e extração** (`download.ts`): usa o `fetch` global e o binário
   `unzip` do sistema (sem dependência npm).
2. **Parse** (`csv.ts`): leitor mínimo que detecta encoding (latin1 por
   padrão; UTF-8 se houver BOM), detecta o separador (`;`, `,` ou tab) e trata
   campos entre aspas, aspas duplicadas e quebras de linha.
3. **Validação de schema** (`schema.ts`): o dicionário de colunas é comparado
   com o arquivo real e colunas obrigatórias precisam existir. O modo
   `npm run ingest -- --inspect` documenta o schema observado em
   `docs/tse-schema.md` — importante porque o TSE pode ajustar colunas a cada
   eleição.
4. **Filtro e validação de registro**: ficam apenas as linhas da eleição
   configurada (`SG_UF`, `DS_CARGO` e referência de ano); registros inválidos
   são agregados em `errors` em vez de derrubar a ingestão inteira.
5. **Normalização** (`normalize.ts`): datas `DD/MM/AAAA → AAAA-MM-DD`, valores
   monetários, limpeza de texto, nulos.
6. **Persistência incremental** (`repository.ts`, `node:sqlite`): um checksum
   do conteúdo normalizado decide se o candidato é novo (`inserted`), mudou
   (`updated`) ou é idêntico (`unchanged`). Candidatos presentes no banco mas
   ausentes no último arquivo são marcados `is_active = 0` (nunca apagados).
   A linha original fica em `candidates_raw` e cada rodada registra um
   lançamento em `sync_log` (URL, arquivo, contagens, status).

A proveniência viaja com o registro: `source { provider, url, dataset,
sourceFile, retrievedAt }` — a interface mostra "Fonte: dados abertos do TSE"
sem afirmar nada além do que o arquivo contém.

### Fotos (`images.ts`)

As fotos oficiais são baixadas e extraídas para `data/photos`. O vínculo é
feito pelo número do candidato no nome do arquivo; quando não há foto, o
candidato aparece sem imagem. Fotos são um dataset opcional: falha no download
não aborta a ingestão.

### A API (`server/index.ts`)

Um servidor `node:http` na porta 2027 serve:

- `GET /api/health` — saúde e eleição configurada;
- `GET /api/candidates` — lista da eleição (projeção enxuta para a página);
- `GET /api/candidates/:id` — detalhe completo;
- `GET /photos/*` — arquivos de `data/photos` com guarda de path traversal.

O Vite encaminha `/api` e `/photos` para essa API tanto no dev quanto no
preview, então o frontend enxerga tudo na mesma origem (porta 2026).

### A página de candidatos

`CandidatesScreen.tsx` busca `GET /api/candidates` e cobre quatro estados:
carregando, erro (com sugestão de rodar `npm run ingest`), vazio e lista.
Nesta rodada, **a única mudança visível** é essa página; o quiz continua com o
conteúdo provisório em `src/data/quiz.ts`, que será substituído numa etapa
futura a partir dos dados oficiais.

### O que ainda não está implementado

Os módulos `assets.ts`, `social.ts` e `history.ts` são stubs tipados e
retornam `implemented: false`: a interface está pronta, o corpo virá nas
próximas rodadas (bens, redes sociais e histórico de candidaturas). O detalhe
por candidato (`/candidatos/:id`) e os adaptadores DivulgaCand/Câmara também
são etapas futuras, conforme a especificação.

## As decisões de projeto definitivas

| Decisão                | Por quê                                                              |
| ---------------------- | -------------------------------------------------------------------- |
| Compatibilidade de perfil | Simples de entender e explicar ("você concordou em 4 de 5 perguntas"). |
| Desempate determinístico | Todo conjunto de respostas precisa produzir um resultado inequívoco. |
| Resultado como ranking | Transparência: a pessoa vê o grau de alinhamento de todos os candidatos. |
| Módulos de lógica pura | A pontuação e a auditoria são livres de framework, testáveis e reutilizáveis pela CLI. |
| Conteúdo declarativo   | Perguntas/candidatos são dados, não código — o mantenedor edita um único arquivo. |
| Porta 2026             | O padrão do projeto; definida uma vez em `vite.config.ts`.           |
| TSE como fonte única de verdade | Nenhuma resposta é inventada; tudo carrega URL, dataset, arquivo e data de obtenção. |
| Backend só com o padrão do Node | `node:sqlite`, `node:http` e `node:test`; zero dependências novas para a ingestão. |
| Ingestão incremental   | Checksum por conteúdo; novos/alterados/removidos detectados sem sobrescrever às cegas. |
| Stubs tipados primeiro | `assets`/`social`/`history` definem contrato agora, corpo nas próximas rodadas. |
| Sem estilização        | Uma passada futura estilizará os mesmos componentes nativos.         |

## Convenções

- Componentes recebem props e renderizam; fora `App.tsx`, nenhuma tela guarda
  estado local.
- Use extensões explícitas `.ts` / `.tsx` nos imports relativos, para que os
  mesmos módulos rodem no Vite e no type-stripping do Node (CLI).
- Conteúdo da interface e documentação em português (PT-BR); código e
  comentários em inglês.