# Changelog

Todas as mudanças notáveis deste projeto são documentadas neste arquivo.

O formato segue o [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) e o
projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Não lançado]

### Adicionado

- **Seleção de estado** (`/estados`): nova tela com o **mapa do Brasil** em SVG
  e uma grade com as 27 UFs, que leva aos candidatos. Hoje só o Paraná tem
  lista, então só ele navega (para `/candidatos`); os demais aparecem como "em
  breve". A malha é estática, sem biblioteca de mapa em tempo de execução —
  derivada do IBGE via `@svg-maps/brazil` (CC BY 4.0), com a proveniência no
  próprio dado (`src/data/brazil-map.ts`) e em `docs/mapa-estados.md`. O SVG não
  usa `role="img"`, cada UF disponível é um `<a>` de verdade (abre em nova aba
  com modificador) e as indisponíveis ficam fora da ordem de foco; o mapa some
  abaixo de 640px e a grade, que funciona em qualquer largura, continua sendo a
  navegação.
- **Trilho lateral e navegação gooey na ficha** (`/candidato/:id`): as seis abas
  (Resumo, Mandato e histórico, Posições anteriores, Votações, Posições,
  Fontes) passam a ser uma **navegação gooey** logo abaixo do cabeçalho, e cada
  aba ganha um **trilho de seções** à esquerda que acompanha a rolagem. Os dois
  são ports de [React Bits](https://www.reactbits.dev) (`LineSidebar` e
  `GooeyNav`), adaptados ao projeto: a navegação é **controlada pela URL** em
  vez de guardar o índice em estado próprio, os itens são `<button role="tab">`
  e não links, e as partículas só disparam no cliente — `Math.random` durante a
  renderização quebraria a hidratação das 436 páginas estáticas. As partículas
  saem da primária do partido, em cor sólida — numa camada própria, fora do
  `filter`/`blend` da pílula, para o `contrast(100)` não esmagá-las para
  preto/branco. O efeito gooey depende
  desse blend sobre fundo escuro, então a navegação traz a própria cápsula,
  tingida com a cor do partido e escurecida para o branco da pílula ter
  contraste. As abas viraram `tablist` de verdade — `role="tab"`,
  `aria-selected`, `aria-controls` e navegação por setas, Home e End — com o
  nome completo de cada aba no `aria-label`; o trilho some abaixo de 900px e
  ambos respeitam `prefers-reduced-motion` (com movimento reduzido a pílula se
  move, mas sem partículas).
- **Abas da ficha na URL**: a aba viva passa a viajar em `?tab=` na query da
  ficha, então uma aba pode ser compartilhada e sobrevive a um F5. A query não
  entra em `matchRoute`, que continua casando só o pathname — por isso as 436
  páginas do build estático não mudam. Trocar de aba usa `replaceState`, para o
  botão voltar continuar sendo "sair da ficha" em vez de desandar aba por aba.

### Corrigido

- **Rolagem ao trocar de rota**: a navegação troca o conteúdo mas mantinha a
  posição de rolagem da tela anterior, então sair de uma tela longa (a nova
  seleção de estados, por exemplo) abria a próxima já no meio. Agora o roteador
  volta ao topo a cada troca de rota, como a ficha já fazia ao trocar de aba.

### Removido

- A dependência `motion`. Ela existia só para a dock flutuante que a navegação
  gooey substituiu; o `GooeyNav` é CSS puro, então ela saiu do `package.json`.

- **Listras na pílula "Ver ficha"**: a pílula ganhou listras de 2,5px a cada
  5px, num tom de 20% da tinta **contrária** à do texto — brancas a 20% quando
  o texto é #111, pretas a 20% quando é branco. No hover a pílula inverte: o
  fundo fica sólido na tinta, o texto na tinta contrária e as listras viram um
  tom de 20% da cor do partido, que é a direção oposta do texto de novo. O
  detalhe que faz a diferença é a listra ser sempre o tom da cor **oposta** ao
  texto que está sobre ela: com um tom da própria tinta o texto senta em cima
  de listras da sua cor, e o contraste despenca — 19 dos 31 partidos ficavam
  abaixo de 4,5:1 no repouso (pior 3,28:1) e os 31 no hover (pior 1,09:1). No
  estado final o pior caso é 4,66:1 no repouso, no vão entre as listras onde
  aparece a cor do card, e 12,21:1 no hover. O alfa vem de `color-mix`, porque
  `var()` não aceita função dentro e a cor do partido é um hex. A secundária
  do partido nunca chegou a servir: ela é cor de bandeira, não de fundo, e em
  20 das 31 entradas da paleta ficaria entre 1,00:1 e 3,93:1 atrás do texto.
- **Páginas estáticas no build**: `npm run build` agora gera um HTML por rota
  (`dist/candidatos/index.html`, `dist/candidato/<id>/index.html`,
  `dist/quiz/1…5/index.html` — 436 páginas, 5,3 MB) com título, description,
  canonical, Open Graph e o texto real da tela, mais `sitemap.xml` e
  `robots.txt` (domínio pelo `SITE_URL`). O navegador hidrata a partir desse
  HTML, então a primeira pintura não espera a API; a lista vai embutida em
  `<script type="application/json">` (74 KB gzipped). `/resultado`, que
  depende de quem respondeu o quiz, é a única rota que usa o shell vazio
  (`dist/app.html`). A API e o build leem o mesmo `src/data-sources/apiPayload.ts`
  para o HTML pré-renderizado não poder divergir da resposta de `/api`, e o
  `vite preview` passou a servir as páginas como um host estático faria.
- **Rotas de verdade** no lugar da máquina de estados em memória: cada tela tem
  URL (`/`, `/candidatos`, `/candidato/:id`, `/quiz/:n`, `/resultado`,
  `/imparcialidade`), a ficha de um candidato pode ser compartilhada e o botão
  voltar do navegador funciona. `src/shared/router.ts` concentra o par
  caminho ↔ tela em código puro (sem `react-router`), com destino
  determinístico para o botão de voltar do cabeçalho; as respostas do quiz
  passam a viver em `sessionStorage`, para `/resultado` sobreviver a um F5; e o
  "Ver ficha" da lista virou `<a href>`, abrindo em nova aba quando pedido.
- **Design system** (`docs/design-tokens.md`): Tailwind CSS v4 integrado ao
  Vite com uma página de tokens de cor (`src/index.css`, bloco `@theme`) que
  vira variáveis CSS globais e utilitárias (`bg-primary` etc.);
  `SpecularButton` com variantes **primary** (verde) e **secondary** (laranja)
  que compartilham o mesmo estilo (shader WebGL via `ogl`), aplicado nos CTAs
  de Início e Resultado; `npm run format`/`format:check` com Prettier
  configurado no padrão do projeto (aspas simples, sem ponto-e-vírgula).
- **Ficha comparável por candidato** (`docs/ficha-comparavel.md`): para cada um
  dos 428 candidatos, fatos oficiais (TSE + Câmara + Senado) e registros
  editoriais separados por camada, com a regra de ouro de que o padrão é
  "não encontrei evidência suficiente".
  - **Histórico parlamentar** (`npm run sync:parliament`): mandatos (Câmara por
    legislatura, ex-senadores via Senado), proposições de autoria por ano,
    comissões, despesas reembolsadas e **votos nominais em votações-chave**
    (reforma tributária, marco temporal, regulação das plataformas); tabelas
    `parliamentary_mandates`, `parliamentary_records` e `votes`, com
    sincronização idempotente e tolerante a falhas (70 mandatos, 41 registros,
    117 votos para 39 candidatos com histórico).
  - **Página de ficha no app** (`CandidateDetailScreen`, abas Resumo/Mandato e
    histórico/Posições anteriores/Votações/Posições/Fontes), acessível pela
    lista de candidatos e pelo resultado do quiz; `GET /api/candidates/:id`
    estende o detalhe com histórico parlamentar, posições anteriores e
    editorial.
  - **Export aberto** (`npm run export:ficha`): CSV (`;`, BOM) e JSON com os
    428 candidatos em `data/ficha/`.
  - **Camada editorial** (`content/editorial/<id>.json`, templates gerados por
    `npm run editorial:templates`): posições com tipo de evidência e fonte.
  - **Histórico de posições políticas** (`npm run sync:history`, tabela
    `political_mandates`): todas as posições ocupadas nas eleições de 2004 a
    2024 (vereador, prefeito, vice-prefeito, deputado estadual/federal, senador,
    governador e vice-governador), eleitos **e suplentes**, baixadas das
    consultas de candidatos abertas do TSE (streaming, com cache e tolerância
    por ano) e casadas por nome normalizado + data de nascimento (638 mandatos
    para 257/428 candidatos). Nova aba "Posições anteriores" na ficha e colunas
    `historico_posicoes`/`historico_posicoes_total` no export CSV/JSON.
  - Testes novos (`scripts/parliament.test.ts`) para senado/identidade/export —
    58 testes no total; depois `scripts/history.test.ts` (resultado, data,
    casamento, resumo) — **73 testes no total**.
  - **Busca de candidatos** (`src/lib/search.ts`, `searchCandidates` + campo na
    tela de candidatos): correspondência fuzzy priorizada por nome (de urna e
    completo) e número de urna, além de ocupação, município, federação e
    coligação. Buscar uma sigla ("PT") ou o nome ("Partido dos Trabalhadores")
    filtra todos os candidatos da agremiação. Índice normalizado memoizado
    (`buildSearchIndex`) e fuzzy por Levenshtein limitado a tamanhos próximos
    para manter a digitação fluida; testes em `scripts/search.test.ts`.

### Alterado

- **A lista de candidatos virou um grid de cards** (`CandidateGrid.tsx`): cada
  card traz a foto em 1:1 (161×225, sem upscale), o número de urna, a sigla do
  partido e o nome de urna, sobre a cor primária do partido e com a tinta
  escolhida por contraste (`readableOn`). O nome de urna encolhe em runtime para
  caber em uma linha. Junto vieram a fonte **Inter** (self-hospedada, variável) e
  uma paleta de duas superfícies — fundo do app `#FAD86A` e painel do grid
  `#5C719C` — mais o campo de busca (fuzzy) no topo da lista.
- **A lista de candidatos mostra os 428 de uma vez**: o botão "Mostrar mais"
  (50 por vez) foi removido. Ele existia só porque 428 cards de uma vez parecem
  caros, mas a medição mostra que não são: a API já devolve a lista inteira em
  uma requisição — o corte era um `slice` no cliente, sem ganho de rede —, as
  fotos são locais (161×225, ~5,5 KB de mediana) e já estavam em
  `loading="lazy"`. Renderizar tudo custa ~21 ms de layout. Ganho prático: o
  Ctrl+F acha qualquer candidato sem espera. O custo é o HTML pré-renderizado
  de `/candidatos`, de 589 KB para 785 KB.
- Lista de candidatos usa a ficha de detalhe; a tela de detalhe disponibiliza
  abas com fontes oficiais e links para os registros (Câmara, Senado e Dados
  Abertos).
- **Quiz data-driven com os 428 candidatos reais** (2026, PR, Deputado Federal):
  5 perguntas cujos perfis são derivados de dados oficiais do TSE por
  resolvedores puros (`src/data/quiz-source.ts`), com proveniência por resposta.
  Perguntas: setor (10 opções, por ocupação), mandato anterior (3), faixa
  etária (4, na data da eleição), agremiação (federação/isolado) e vínculo
  territorial (nascido no PR ou não).
- **Desempate por raridade de perfil** no ranking (pontos → raridade → nome),
  reduzindo a vantagem estrutural de perfis muito comuns.
- **Auditoria de distribuição sobre os 428 candidatos**
  (`npm run check:distribution`): cobertura por opção (alvo 5–50%) e vitórias
  por combinação nas 480 combinações possíveis (máx. observado ≈ 4,6%).
- **Enriquecimento TSE (Fase B):** ingestão dos datasets complementar, bens e
  redes por `SQ_CANDIDATO`, com novos campos no modelo/banco (município de
  nascimento, quilombola, etnia indígena, candidato na urna, substituído,
  contas/declaração de bens, reeleição `ST_REELEICAO`, teto de gastos, bens
  declarados e links de redes) e migração automática de schema.
  - `elections.ts` corrigido: o dataset antes chamado "histórico" agora é o
    **complementar** real (`consulta_cand_complementar_2026`); colunas de
    resultado do pleito são ignoradas nesta rodada (decisão documentada).
- **Incumbentes (Fase C):** adaptador da API de Dados Abertos da Câmara
  (`siglaUf=PR` + detalhe com data de nascimento), casamento por
  nome normalizado + data de nascimento (`scripts/sync-incumbents.ts`,
  `npm run sync:incumbents`), tabela `incumbents` e marcação de
  "Deputado(a) federal em exercício" na lista (25/428 casados; 5 deputados não
  concorrem à reeleição nesta eleição).
- Ficha do candidato enriquecida: natural de <município (UF)>, idade na eleição,
  quilombola/etnia indígena, bens declarados (R$) e redes sociais com links.
- Testes novos: parser do complementar, identidade (casamento Câmara), campos
  novos do repositório — 51 testes no total.
- Documentação: `docs/quiz-design.md` (desenho e decisões do quiz, coberturas)
  e atualizações de `how-it-works`, `authoring-content`, `README` e changelog.

- Na ficha do candidato, resumo com partido, agremiação
  (federação/partido isolado), ocupação e detalhes expansíveis (`<details>`
  "Mais informações") com escolaridade, estado civil, nascimento (data e UF),
  sexo e cor/raça.
- Novos campos mapeados do TSE no modelo e no banco: estado civil
  (`DS_ESTADO_CIVIL`), estado de nascimento (`SG_UF_NASCIMENTO`) e composição
  da federação (`DS_COMPOSICAO_FEDERACAO`), com migração automática de colunas
  em bancos existentes.
- Tratamento de sentinelas do TSE (`#NE`, `#NULO`, `NÃO DIVULGÁVEL`) durante a
  normalização: esses valores viram `null` e deixam de aparecer na interface
  (ex.: "Situação: #NE").
- Página com a lista de todos os candidatos e suas informações (foto, nome e
  descrição), acessível pela tela inicial.
- Ao clicar em um candidato no resultado, detalhamento pergunta a pergunta: a
  resposta da pessoa, a resposta prevista pelo perfil do candidato e a
  indicação de Concorda (elemento nativo `<details>`).
- Pipeline de ingestão dos dados oficiais do TSE (`npm run ingest`): download,
  extração, parse do CSV (latin1, aspas, separador), validação de schema e de
  registro, normalização e atualização incremental no SQLite local, com
  proveniência por candidato e histórico em `sync_log`.
  - Modo `--inspect` documenta o schema real do arquivo baixado em
    `docs/tse-schema.md`; `--force` rebaixa os arquivos.
  - Fotos oficiais como dataset opcional (`src/data-sources/tse/images.ts`).
- Camada de configuração de eleições (`src/shared/elections.ts`,
  `ElectionConfig`) com a eleição atual 2026 / PR / Deputado Federal e estrutura
  pronta para futuras eleições e outras UF/cargos.
- API HTTP própria (`server/index.ts`, porta 2027): `GET /api/health`,
  `GET /api/candidates`, `GET /api/candidates/:id` e fotos estáticas em
  `/photos/*`, com proxy do Vite para `/api` e `/photos`.
- A lista de candidatos agora consome a API local e exibe os candidatos reais
  com foto, partido, coligação, situação, município e nota de fonte ("dados
  abertos do TSE"), com estados de carregamento, erro e vazio.
- `npm run dev` inicia app + API juntos; novos scripts `api`, `test`, `ingest`;
  testes com `node:test` para o parser CSV, a normalização e o repositório.
- Backend usando apenas o padrão do Node (zero dependências novas): `node:sqlite`,
  `node:http`, `node:test`.
- Documentação do schema do TSE (`docs/tse-schema.md`) e exemplo de variáveis
  de ambiente (`.env.example`).

### Alterado

- Lista de candidatos usa o hook `useCandidates` (estados de carregamento/erro/
  vazio) e remove a foto da etapa de pergunta do quiz.
- Banco e API expõem os campos de enriquecimento e a incumbência.

## [0.1.0] - 2026-09-23

### Adicionado

- Fluxo do quiz: tela inicial, perguntas sequenciais com foto por opção de
  resposta, tela de resultado e reinício.
- Resultado como ranking completo dos candidatos, da melhor para a pior
  compatibilidade, com destaque nativo para o primeiro colocado
  ("Melhor compatibilidade").
- Modelo de pontuação por compatibilidade de perfil, com desempate
  determinístico e falha graciosa caso o resultado não possa ser calculado.
- Auditoria de imparcialidade: tela "Verificar imparcialidade" no app e um
  script de CLI que enumeram todas as 3⁵ = 243 combinações de respostas e
  reportam as vitórias por candidato.
- Conteúdo provisório em português (15 candidatos, 5 perguntas, 3 opções cada)
  com fotos determinísticas de apoio.
- Kit open source: licença MIT, guia de contribuição com padrões de commit,
  código de conduta, changelog e modelos de issue/pull request — tudo em
  português.
- Servidor de desenvolvimento e preview na porta 2026; atalho `npm start`
  para `npm run dev`.

[Não lançado]: https://github.com/anaraujo/teste-voto
