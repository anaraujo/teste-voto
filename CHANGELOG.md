# Changelog

Todas as mudanças notáveis deste projeto são documentadas neste arquivo.

O formato segue o [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) e o
projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Não lançado]

### Adicionado

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

### Alterado

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
- Card de candidato enriquecido: natural de <município (UF)>, idade na eleição,
  quilombola/etnia indígena, bens declarados (R$) e redes sociais com links.
- Testes novos: parser do complementar, identidade (casamento Câmara), campos
  novos do repositório — 51 testes no total.
- Documentação: `docs/quiz-design.md` (desenho e decisões do quiz, coberturas)
  e atualizações de `how-it-works`, `authoring-content`, `README` e changelog.

- Na lista de candidatos, resumo por candidato com partido, agremiação
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
