# Como o teste-voto funciona

Um passeio pela arquitetura, pelo modelo de dados e pelo modelo de pontuação —
escrito para que uma pessoa recém-chegada consiga guardar o projeto inteiro na
cabeça em uma única leitura.

## Princípios

O projeto valoriza a leveza acima de tudo:

- Cores guiadas por um design system enxuto: tokens em `src/index.css`
  (Tailwind v4 `@theme`) e um componente de botão com variantes
  (`SpecularButton`, primary verde / secondary laranja). Nada de hexes soltos
  no código — veja [docs/design-tokens.md](design-tokens.md).
- Nenhuma dependência desnecessária. Toda dependência precisa conquistar seu
  lugar em uma conversa primeiro.
- Módulos pequenos e focados, cada um com uma única responsabilidade.
- A lógica é pura e os dados são declarativos, para que o aplicativo possa ser
  auditado, estendido e testado sem cerimônia.

## Estrutura do projeto

```
src/
├── data/
│   ├── quiz.ts               Tipos + re-exportação das perguntas (contrato)
│   └── quiz-source.ts        Fonte oficial do quiz: perguntas + resolvedores
├── shared/
│   ├── elections.ts          Configuração de eleições (2026/PR/DEPUTADO FEDERAL)
│   ├── domain.ts             Modelo de domínio (CandidateRecord, Source)
│   └── api.ts                Contratos da API compartilhados com o frontend
├── hooks/useCandidates.ts    Estado de carregamento da lista (API)
├── lib/scoring.ts            Pontuação pura + desempate (ranking)
├── components/               Um componente por tela
│   ├── StartScreen.tsx       Boas-vindas (com opção de ver candidatos)
│   ├── CandidatesScreen.tsx  Lista de candidatos oficiais (via API)
│   ├── QuestionStep.tsx      Uma pergunta e suas opções
│   ├── ResultScreen.tsx      Ranking completo dos candidatos
│   └── FairnessScreen.tsx    Auditoria de imparcialidade
├── data-sources/
│   ├── repository.ts         SQLite (node:sqlite): candidatos, incumbentes,
│   │                         mandatos, registros, votos, posições anteriores,
│   │                         auditoria
│   ├── tse/                  Adaptadores do TSE (CSV, candidatos, complementar, bens,
│   │                         redes, fotos, histórico de posições 2004–2024)
│   ├── camara/               Adaptadores da Câmara (deputados, identidade, registros,
│   │                         Senado) para a ficha comparável
│   └── parliament/           Montagem do histórico parlamentar + export da ficha
└── App.tsx                   A máquina de estados das telas
server/index.ts               API HTTP (node:http): candidatos, ficha detalhada + fotos
scripts/                      ingestão, incumbentes, sincronização parlamentar e de
                              histórico de posições, export da ficha, auditoria, dev
                              runner e testes
```

> A **ficha comparável** (histórico parlamentar, votações, posições, histórico
> de posições anteriores e fontes) é descrita em
> [`docs/ficha-comparavel.md`](ficha-comparavel.md).

## O quiz é data-driven

O conteúdo do quiz em `src/data/quiz-source.ts` é **derivado dos dados
oficiais**, não um array de candidatos escrito à mão:

- Cada **pergunta** declara texto, opções e um _resolvedor_ puro: dado o
  candidato do TSE, qual opção ele "escolheria".
- Cada **candidato** participa com o perfil montado por esses resolvedores
  (`buildProfile` → opção por pergunta) e a proveniência de cada resposta.

As 5 dimensões e a distribuição real sobre os 428 candidatos estão em
[`docs/quiz-design.md`](quiz-design.md).

## O fluxo

`App.tsx` é uma máquina de estados pequena.

```
início ──▶ candidatos ──▶ ficha do candidato
   │                        ▲
   ▼                        │
pergunta(0) ──▶ … ──▶ resultado ──▶ imparcialidade
   ▲                             │        │
   └──────────── reinício ◀──────┘◀───────┘
```

- As respostas acumulam em um `Record<QuestionId, OptionId>`.
- A tela de resultado oferece reinício, auditoria de imparcialidade e a ficha
  de cada candidato (também acessível pela lista de candidatos).
- A **ficha do candidato** (`CandidateDetailScreen`) tem abas de Resumo
  (dados do TSE), Mandato e histórico, Posições anteriores, Votações, Posições
  e Fontes.

## O modelo de pontuação

Cada candidato é pontuado pelo número de coincidências entre as respostas da
pessoa e o perfil dele. `rankResults` ordena por:

1. **pontos** (desc);
2. **raridade do perfil** (asc — perfis mais raros primeiro), via `profileKey`;
3. **nome de urna** (`localeCompare` pt-BR).

O desempate por raridade reduz a vantagem estrutural de perfis muito comuns e é
declarado na tela de resultado. A tela de resultado mostra o ranking completo,
com o primeiro colocado marcado como **"Melhor compatibilidade"**; cada
candidato expande em `<details>` o detalhamento pergunta a pergunta
(`questionMatches`).

### Falha graciosa

`computeResult` retorna `null` quando a lista de candidatos está vazia; a tela
mostra mensagem amigável e botão de recarregar.

### Auditoria de imparcialidade

Com as 5 perguntas (10×3×4×2×2) existem **480 combinações**. A mesma função
pura de pontuação alimenta a tela **"Verificar imparcialidade"** e o CLI
`npm run check:distribution`, que contam os vencedores de cada combinação. O
contrato: nenhum candidato vence de forma desproporcional (máximo observado
≈ 4,6%). Veja [`docs/quiz-design.md`](quiz-design.md) para as métricas.

## A camada de dados: ingestão do TSE e API

Regra central: **o TSE é a fonte única de verdade**; tudo o que aparece veio de
um arquivo oficial e carrega sua proveniência.

### Configuração de eleição

`src/shared/elections.ts` define a eleição atual (2026/PR/Deputado Federal) e
descreve cinco datasets oficiais — `candidates`, `assets`, `social`,
`complementar` e `photos` — com URLs e padrões de arquivo. Próximas eleições
entram como nova configuração.

> Correção documentada: o dataset que vinha da URL "histórico" no rascunho foi
> substituído pelo arquivo **complementar** de verdade
> (`consulta_cand_complementar_2026.zip`, dataset `candidatos_complementar`,
> arquivo por UF `consulta_cand_complementar_2026_PR`). O arquivo real traz os
> dados de identificação por `SQ_CANDIDATO`.

### O pipeline de ingestão (`scripts/ingest.ts`)

```
ZIP do TSE → download → extração (unzip) → parse CSV → validação
   → normalização → SQLite (incremental) → enriquecimento → API
```

1. **Download e extração** (`download.ts`): `fetch` global + binário `unzip`.
2. **Parse** (`csv.ts`): leitor mínimo — encoding (latin1; UTF-8 com BOM),
   separador (`;`, `,`, tab), aspas, aspas duplicadas e quebras de linha.
3. **Validação de schema** (`schema.ts`): colunas obrigatórias presentes;
   `npm run ingest -- --inspect` documenta o schema em `docs/tse-schema.md`.
4. **Filtro**: apenas a eleição configurada; erros agregados sem derrubar.
5. **Normalização** (`normalize.ts`): datas `DD/MM/AAAA → AAAA-MM-DD`,
   valores monetários, sentinelas do TSE (`#NE`, `#NULO`, `NÃO DIVULGÁVEL`) → `null`.
6. **Persistência incremental** (`repository.ts`): checksum do conteúdo decide
   `inserted`/`updated`/`unchanged`; remoções viram `is_active=0`; linha bruta
   em `candidates_raw`; cada rodada registra `sync_log`.
7. **Enriquecimento** (mesma rodada): dados complementares, bens e redes são
   unidos por `SQ_CANDIDATO` e gravados no mesmo registro.

A proveniência viaja no registro: `source { provider, url, dataset, sourceFile,
retrievedAt }`.

### Enriquecimento (Fase B)

- **Complementar** (`tse/complementar.ts`): município de nascimento, idade na
  posse, quilombola, etnia indígena, teto de gastos, contas/declarações,
  candidato na urna, substituição. O arquivo usa **ponto decimal** para
  `VR_DESPESA_MAX_CAMPANHA` ("3176572.53") — parser próprio `parseDecimalDot`;
  não usar `parseMoney` aqui.
- **Bens** (`tse/assets.ts`): soma `VR_BEM_CANDIDATO` por candidato (**vírgula
  decimal** — `parseMoney`).
- **Redes** (`tse/social.ts`): `DS_URL` agrupado por candidato.
- Formato monetário do TSE vale só dentro do arquivo certo; normalização
  converte para número, e a interface formata com `Intl.NumberFormat('pt-BR')`.

Contagens reais observadas na ingestão: complementar 428/428, bens 320/428,
redes 408/428.

> **Decisão:** o arquivo complementar traz também as colunas de **resultado do
> pleito** (situação no pleito/total, diploma, julgamento). Nesta rodada elas
> são **ignoradas** — o produto quer ajudar na intenção de voto antes da
> eleição, não posteriormente. Se um dia quisermos mostrar resultado, basta
> mapear essas colunas.

### Incumbentes (Fase C)

A Câmara não tem campo de "reeleição" no TSE (o `ST_REELEICAO` veio `#NE` para
100% das linhas PR), então a identificação de quem concorre à reeleição usa a
**API de Dados Abertos da Câmara**:

- `tse/camara/deputados.ts` busca os deputados federais do PR em exercício
  (`siglaUf=PR`) e, para cada um, a data de nascimento (detalhe). Resposta em
  cache em `data/camara/deputados_pr_2026.json` (use `--force` para renovar).
- `tse/camara/identity.ts` casa por **nome normalizado** (sem acentos/
  pontuação) do nome de urna ou completo; quando o nome é curto ou há
  candidatos homônimos, a **data de nascimento** confirma (quando ambos
  informam).
- `scripts/sync-incumbents.ts` (`npm run sync:incumbents`) grava os casamentos
  na tabela `incumbents` (`candidate_id` → `camara_id`, partido, nome, foto).

Resultado real: 30 deputados PR em exercício, **25** casados com candidatos
(5 não concorrem à reeleição como deputados federais PR nesta eleição e não
estão nos 428 — ex.: Gleisi Hoffmann, Filipe Barros). A API expõe
`isIncumbent` + `camaraPartyAcronym`, e a lista de candidatos marca
"Deputado(a) federal em exercício".

> Uma correção de premissa: mais cedo o modelo achava ~24 incumbentes; o dado
> real é 25 (mesma ordem de grandeza, confirmado pela base).

### Fotos (`images.ts`)

Fotos oficiais baixadas para `data/photos`, vinculadas pelo arquivo; dataset
opcional (falha não aborta).

### A API (`server/index.ts`)

`node:http` na porta 2027:

- `GET /api/health`
- `GET /api/candidates` — lista da eleição, com projeção + incumbência
- `GET /api/candidates/:id` — detalhe completo
- `GET /photos/*` — arquivos locais (guarda de path traversal)

O Vite encaminha `/api` e `/photos` para a API em dev e preview (mesma origem).

### A página de candidatos

`CandidatesScreen.tsx` consome `GET /api/candidates` via hook e cobre quatro
estados: carregando, erro (sugere `npm run ingest`), vazio e lista. O resumo
mostra foto, nome de urna, número, partido, agremiação e ocupação; `<details>`
expande escolaridade, estado civil, nascimento (data + município), idade na
eleição, quilombola/etnia, bens declarados e redes sociais. Marcas de
reeleição/incumbência aparecem como `<mark>`.

## As decisões de projeto definitivas

| Decisão                                                    | Por quê                                                                  |
| ---------------------------------------------------------- | ------------------------------------------------------------------------ |
| Quiz 100% data-driven                                      | Nada de opinião: perfis derivados de arquivos oficiais com proveniência. |
| Escopo 428 candidatos (PR, Deputado Federal)               | Combinado: foco em uma eleição/cargo no primeiro momento.                |
| Ignorar resultado do pleito nesta rodada                   | O produto serve para formar intenção de voto antes da eleição.           |
| Dataset `complementar` corrigido                           | Substitui o "histórico" do rascunho pelo arquivo real do TSE.            |
| Compatibilidade de perfil como pontuação                   | Simples de explicar ("você concordou em 4 de 5 perguntas").              |
| Desempate: pontos → raridade → nome                        | Determinístico e reduz a vantagem de perfis muito comuns.                |
| Regex por prefixo no setor                                 | `\b` do JS é ASCII e ignora acentos; prefixo evita faltar "MÉDICO".      |
| Formato: complementar `parseDecimalDot`, bens `parseMoney` | Os arquivos TSE usam decimais diferentes; cada um no lugar certo.        |
| `ST_REELEICAO` não usado (100% `#NE`)                      | Sem campo confiável; incumbente vem da API da Câmara.                    |
| Incumbente por nome + data de nascimento                   | Nome de urna ≠ nome civil; data desambigua homônimos.                    |
| Porta 2027 (API)                                           | Definida uma vez; app na 2026 via Vite.                                  |
| TSE como fonte única de verdade                            | Tudo carrega URL, dataset, arquivo e data de obtenção.                   |
| Backend só com o padrão do Node                            | `node:sqlite`, `node:http`, `node:test`; zero dependências.              |
| Ingestão incremental + `sync_log`                          | Novos/alterados/removidos sem sobrescrever às cegas; auditorável.        |
| Tabela `incumbents` separada                               | Dado derivado (Câmara) não contamina o registro TSE/checksum.            |

## Convenções

- Componentes recebem props e renderizam; fora `App.tsx`, nada de estado local.
- Imports relativos com `.ts`/`.tsx` explícitos (Vite e type-stripping do Node).
- Interface e documentação em PT-BR; código e comentários em inglês.
