# Como o teste-voto funciona

Um passeio pela arquitetura, pelo modelo de dados e pelo modelo de pontuação —
escrito para que uma pessoa recém-chegada consiga guardar o projeto inteiro na
cabeça em uma única leitura.

## Princípios

O projeto valoriza a leveza acima de tudo:

- Cores guiadas por um design system enxuto: tokens em `src/index.css`
  (Tailwind v4 `@theme`), uma camada semântica que aponta para eles, e dois
  botões com fronteiras explícitas (`SpecularButton`, CTA de destaque com
  WebGL, e `Button`, do kit, para o resto). Nada de hexes soltos no código —
  veja [docs/design-tokens.md](design-tokens.md).
- Nenhuma dependência desnecessária. Toda dependência precisa conquistar seu
  lugar em uma conversa primeiro. Os componentes básicos em
  `src/components/ui/` seguem o formato do shadcn/ui mas são **código do
  repositório**, não um pacote: por isso não contam como dependência.
- Módulos pequenos e focados, cada um com uma única responsabilidade.
- A lógica é pura e os dados são declarativos, para que o aplicativo possa ser
  auditado, estendido e testado sem cerimônia.

## Estrutura do projeto

```
src/
├── data/
│   ├── quiz.ts               Tipos + re-exportação das perguntas (contrato)
│   └── quiz-source.ts        Fonte oficial do quiz: perguntas + resolvedores
├── entry-server.tsx         Renderização no servidor (renderToString)
├── shared/
│   ├── elections.ts          Configuração de eleições (2026/PR/DEPUTADO FEDERAL)
│   ├── domain.ts             Modelo de domínio (CandidateRecord, Source)
│   └── api.ts                Contratos da API compartilhados com o frontend
├── AppRouter.tsx             Cliente do roteamento (History API no navegador)
├── hooks/useCandidates.ts    Estado de carregamento da lista (API ou seed)
├── hooks/useCandidateDetail.ts  Estado de carregamento da ficha (API ou seed)
├── hooks/useQuizAnswers.ts   Respostas do quiz (sessionStorage)
├── lib/scoring.ts            Pontuação pura + desempate (ranking)
├── components/               Um componente por tela
│   ├── StartScreen.tsx       Boas-vindas (com opção de ver candidatos)
│   ├── CandidatesScreen.tsx  Lista de candidatos oficiais (via API)
│   ├── QuestionStep.tsx      Uma pergunta e suas opções
│   ├── ResultScreen.tsx      Ranking completo dos candidatos
│   ├── FairnessScreen.tsx    Auditoria de parcialidade
│   ├── AppHeader.tsx         Cabeçalho com o botão de voltar
│   └── NotFoundScreen.tsx    Rota desconhecida
├── data-sources/
│   ├── repository.ts         SQLite (node:sqlite): candidatos, incumbentes,
│   │                         mandatos, registros, votos, posições anteriores,
│   │                         auditoria
│   ├── tse/                  Adaptadores do TSE (CSV, candidatos, complementar, bens,
│   │                         redes, fotos, histórico de posições 2004–2024)
│   ├── camara/               Adaptadores da Câmara (deputados, identidade, registros,
│   │                         Senado) para a ficha comparável
│   └── parliament/           Montagem do histórico parlamentar + export da ficha
├── App.tsx                   Renderiza a tela da rota
server/index.ts               API HTTP (node:http): candidatos, ficha detalhada + fotos
scripts/                      pré-renderização, ingestão, incumbentes, sincronização
                              parlamentar e de histórico de posições, export da
                              ficha, auditoria, dev runner e testes
```

> A **ficha comparável** (histórico parlamentar, votações, posições, histórico
> de posições anteriores e fontes) é descrita em
> [`docs/ficha-comparavel.md`](ficha-comparavel.md).

## O build gera as páginas

Não existe backend de render, e renderizar as 436 telas a cada visita seria
lento. O build renderiza cada rota uma vez, com `renderToString`, e escreve
HTML estático em `dist/`:

```
npm run build        # tsc -b → bundle do app (dist/assets) → SSR → páginas
npm run build:ssr    # vite build --ssr → dist-ssr/entry-server.js
npm run build:pages  # node scripts/prerender.ts → dist/**/index.html
```

`scripts/prerender.ts` lê o mesmo SQLite da API e, para cada rota, chama
`renderRoute` (`src/entry-server.tsx`) e monta a página com `renderPage`
(`src/shared/html.ts`): título e description próprios, canonical, Open Graph e
o texto real da tela. `dist/` fica com:

```
dist/
├── index.html                     /  e  app.html (shell vazio)
├── candidatos/index.html          lista
├── imparcialidade/index.html      auditoria
├── quiz/1…5/index.html            as perguntas
├── candidato/<id>/index.html      uma ficha por candidato (428)
├── sitemap.xml, robots.txt
└── assets/                        bundle do cliente
```

Três decisões que evitam surpresa:

- **Os dados embutidos vêm do mesmo módulo que a API.**
  `src/data-sources/apiPayload.ts` monta a resposta de `/api/candidates` e de
  `/api/candidates/:id`; a API e o build chamam a mesma função, então o HTML
  pré-renderizado e a resposta da API não podem divergir. O `seed` vai em um
  `<script type="application/json">` e o `AppRouter` o lê na partida.
- **Só `/resultado` fica no cliente.** Ela depende de quem respondeu o quiz, e
  um HTML estático mentiria. As outras rotas são as mesmas para todo mundo —
  até `/quiz/n`, que é conteúdo fixo — então entram no build e viram texto
  indexável. O shell vazio vai para `dist/app.html` e serve de fallback no
  preview.
- **Nenhuma data ou aleatoriedade no render.** `Intl`, `Date.now` e
  `Math.random` ficam fora de todo caminho de render (as últimas posições
  Overall em `FairnessScreen` são o próprio dado), senão a hidratação quebraria.
  O botão specular usa `var(--color-*)` no estilo inline, lido dos tokens reais
  do `index.css`, e o `getComputedStyle` só alimenta os uniforms do shader.

O `vite preview` serve isso como um host estático faria: página pré-renderizada
quando existe, shell vazio quando não. Ao publicar, defina `SITE_URL` para o
canonical, o `og:url`, o sitemap e o robots apontarem para o domínio certo.
As fotos são a exceção: hoje são servidas pela API em `/photos`; num host
estático, copie `data/photos` para `dist/photos`.

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

A tela atual é a **rota**: cada tela tem uma URL e o botão voltar do navegador
funciona. `App.tsx` deriva o que renderizar da rota recebida em `route`; quem
dá a rota é o `AppRouter.tsx` no navegador (History API) ou o build estático.

| Rota              | Tela                    | Dados                 |
| ----------------- | ----------------------- | --------------------- |
| `/`               | `StartScreen`           | lista de candidatos   |
| `/candidatos`     | `CandidatesScreen`      | lista de candidatos   |
| `/candidato/:id`  | `CandidateDetailScreen` | ficha do candidato    |
| `/quiz/:n`        | `QuestionStep`          | pergunta (n de 1 a 5) |
| `/resultado`      | `ResultScreen`          | ranking das respostas |
| `/imparcialidade` | `FairnessScreen`        | lista de candidatos   |
| qualquer outra    | `NotFoundScreen`        | —                     |

`src/shared/router.ts` é puro (sem DOM, sem React) e concentra o par caminho
↔ tela: `matchRoute`, `routeToPath`, `candidatePath` e `parentPath`. Como não
depende do ambiente, o mesmo módulo serve o cliente, o build estático e os
testes.

```
início ──▶ /candidatos ──▶ /candidato/:id
   │                             ▲
   ▼                             │
 /quiz/1 ──▶ … ──▶ /resultado ──▶ /imparcialidade
   ▲                             │          │
   └──────────── reinício ◀──────┘◀─────────┘
```

- As respostas acumulam em um `Record<QuestionId, OptionId>` guardado em
  `sessionStorage` (`useQuizAnswers`), para que `/resultado` sobreviva a um F5 e
  ao histórico do navegador.
- O botão de voltar do cabeçalho (`AppHeader`) tem destino **determinístico**
  (`parentPath`): a ficha volta para a lista, a auditoria volta para o
  resultado, e as demais telas voltam para a inicial. Nenhum histórico é
  guardado em estado.
- A tela de resultado oferece reinício, auditoria de imparcialidade e a ficha de
  cada candidato (também acessível pela lista de candidatos, onde "Ver ficha" é
  um `<a href>` de verdade: abre em nova aba com clique modificado e é
  rastreável).

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

| Decisão                                                    | Por quê                                                                      |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Quiz 100% data-driven                                      | Nada de opinião: perfis derivados de arquivos oficiais com proveniência.     |
| Escopo 428 candidatos (PR, Deputado Federal)               | Combinado: foco em uma eleição/cargo no primeiro momento.                    |
| Ignorar resultado do pleito nesta rodada                   | O produto serve para formar intenção de voto antes da eleição.               |
| Dataset `complementar` corrigido                           | Substitui o "histórico" do rascunho pelo arquivo real do TSE.                |
| Compatibilidade de perfil como pontuação                   | Simples de explicar ("você concordou em 4 de 5 perguntas").                  |
| Desempate: pontos → raridade → nome                        | Determinístico e reduz a vantagem de perfis muito comuns.                    |
| Regex por prefixo no setor                                 | `\b` do JS é ASCII e ignora acentos; prefixo evita faltar "MÉDICO".          |
| Formato: complementar `parseDecimalDot`, bens `parseMoney` | Os arquivos TSE usam decimais diferentes; cada um no lugar certo.            |
| `ST_REELEICAO` não usado (100% `#NE`)                      | Sem campo confiável; incumbente vem da API da Câmara.                        |
| Incumbente por nome + data de nascimento                   | Nome de urna ≠ nome civil; data desambigua homônimos.                        |
| Porta 2027 (API)                                           | Definida uma vez; app na 2026 via Vite.                                      |
| TSE como fonte única de verdade                            | Tudo carrega URL, dataset, arquivo e data de obtenção.                       |
| Backend só com o padrão do Node                            | `node:sqlite`, `node:http`, `node:test`; zero dependências.                  |
| Ingestão incremental + `sync_log`                          | Novos/alterados/removidos sem sobrescrever às cegas; auditorável.            |
| Páginas estáticas geradas no build                         | Rotas com URL real, texto indexável e primeira pintura sem esperar a API.    |
| HTML e API lendo o mesmo `apiPayload.ts`                   | O que foi pré-renderizado não pode divergir do que a API devolve.            |
| Só `/resultado` fica no cliente                            | As outras rotas são iguais para todo mundo; o ranking depende das respostas. |
| Sem data/aleatoriedade no render                           | `Date.now` e `Math.random` quebrariam a hidratação.                          |
| Tabela `incumbents` separada                               | Dado derivado (Câmara) não contamina o registro TSE/checksum.                |

## Convenções

- Componentes recebem props e renderizam; fora `App.tsx`, nada de estado local.
- Imports relativos com `.ts`/`.tsx` explícitos (Vite e type-stripping do Node).
- Interface e documentação em PT-BR; código e comentários em inglês.
