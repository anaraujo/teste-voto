# Ficha comparável por candidato

A ficha reúne, para cada um dos 428 candidatos a deputado federal pelo Paraná
(2026), **fatos oficiais verificáveis** e **registros editoriais**, sempre
separando o que é de cada camada.

## As três camadas

1. **Dados do TSE** (importados por `npm run ingest`): dados pessoais, situação,
   bens, teto de gastos, redes sociais, município de nascimento, etc. São a base
   de toda a ficha e também do quiz.

2. **Histórico parlamentar oficial** (`npm run sync:parliament`), gravado nas
   tabelas `parliamentary_mandates`, `parliamentary_records` e `votes`:

   - **Câmara** (API de Dados Abertos): mandatos por legislatura (55ª, 56ª,
     57ª), proposições de autoria por ano, comissões e despesas reembolsadas por
     ano — além dos **votos em votações-chave** (reforma tributária, marco
     temporal e regulação das plataformas).
   - **Senado** (Dados Abertos do Senado, XML): histórico de mandato por
     legislatura. O Senado **não expõe votações por API pública**; por isso a
     ficha registra apenas o mandato para ex-senadores.

3. **Camada editorial** (`content/editorial/<id>.json`, já com 428 templates
   gerados por `npm run editorial:templates`): posições e propostas com
   **evidência e fonte**. Cada campo editorial tem um tipo de evidência
   (`proposta`, `declaração`, `histórico parlamentar`) e uma URL de fonte.

4. **Histórico de posições políticas** (`npm run sync:history`, tabela
   `political_mandates`): todas as posições que o candidato já ocupou nas
   eleições de **2004 a 2024** (vereador, prefeito, vice-prefeito, deputado
   estadual, deputado federal, senador, governador e vice-governador), tiradas
   das consultas de candidatos abertas do TSE. Consideramos **eleitos e
   suplentes** (quem assume vaga de suplente manda no mandato). O casamento com
   os 428 candidatos usa nome normalizado + data de nascimento.

5. **Prestação de contas de campanha** (`npm run sync:finance`, tabelas
   `campaign_receitas` e `campaign_despesas`): receitas (doadores) e despesas
   contratadas (fornecedores) do dataset oficial do TSE
   (`prestacao-de-contas-eleitorais-candidatos`, sistema SPCE). Um ZIP nacional
   com um arquivo por UF; o casamento com o candidato é pelo `SQ_CANDIDATO`. A
   ficha mostra o total recebido, o total contratado e os maiores doadores e
   fornecedores, com a fonte.

## A regra de ouro

> **O candidato afirma X** (camada editorial) ≠ **o histórico parlamentar mostra
> X** (camada oficial).

O padrão é **"não encontrei evidência suficiente"**. Um campo editorial só
passa a mostrar um posicionamento quando alguém preenche `content/editorial/`
com valor, tipo de evidência e fonte. A ficha nunca deduz posição a partir de
votos ou métricas por conta própria.

O quiz usa os mesmos votos e orientações, mas só como fato literal ("votou
Sim" ou "o partido orientou Não") e como métrica numérica publicada
(alinhamento com a orientação do Governo, contagem de mandatos). Isso não é
posição editorial e não entra na aba Posições.

## Como a ficha é exibida

- Página de detalhe no app (`CandidateDetailScreen`), com 6 abas:
  **Resumo** (TSE), **Mandato e histórico** (mandatos, proposições, comissões,
  despesas), **Posições anteriores** (mandatos eleitos/suplentes desde 2004,
  com cargo, município e partido), **Votações** (voto nominal por pauta + link
  para o registro oficial), **Posições** (camada editorial) e **Fontes** (todas
  as URLs usadas).
- As abas ficam numa **navegação gooey** logo abaixo do cabeçalho
  (`src/components/GooeyNav.tsx`) e são `tablist` de verdade: `role="tab"`,
  `aria-selected`, `aria-controls` e navegação por setas, Home e End. A aba viva
  viaja em `?tab=` na query, sem entrar no `matchRoute` — a rota continua sendo
  só o pathname, e por isso o build estático não muda. Trocar de aba faz
  `replaceState`.
- A navegação é **controlada**: o índice ativo vem da URL, não de um estado
  interno, então as setas do teclado também movem a pílula. O efeito gooey
  depende de `mix-blend-mode: lighten` sobre fundo escuro, e por isso a
  navegação tem cápsula própria (a cor do partido escurecida) em vez de usar o
  fundo claro da página. As partículas só nascem no cliente: são `Math.random` e
  `document.createElement`, que quebrariam a hidratação das páginas estáticas.
- As partículas são **filhas do elemento filtrado**, junto com a pílula, e é isso
  que faz o efeito existir: `blur(7px) contrast(100)` é a técnica de metaball, e
  ela só cria fusão e filamento onde duas formas borradas se tocam. Com uma
  forma só dentro do filtro o blur arredonda e o contraste reendurece, e o
  resultado é a mesma forma de antes — um círculo, sem nada derretido. Por isso
  elas não podem viver numa camada irmã, fora do filtro.
- A partícula é da **cor da pílula**, e não da cor do partido. O `contrast(100)`
  é um limiar duro: um tom médio sai preto, e o preto é exatamente o que o
  `lighten` esconde — nos partidos escuros o estouro simplesmente não apareceria.
  Com a cor da pílula a fusão funciona nos 30 partidos.
- O `::before` preto do elemento filtrado, com 75px de folga em volta do item,
  faz duas coisas: impede que o filtro tosque as partículas na borda (elas voam
  até ~90px) e dá ao `lighten` uma tela para comparar — `lighten(preto, o que
está atrás)` devolve o que está atrás, então o bloco é invisível em qualquer
  fundo.
- Dentro de cada aba, um **trilho de seções** à esquerda
  (`src/components/LineSidebar.tsx`) marca em que parte do conteúdo a leitura
  está. As seções e o trilho saem da mesma função de âncoras, ao lado do
  componente que as desenha (`resumoAnchors`, `mandatoAnchors` etc.), para o
  item do trilho não poder apontar para uma seção que não existe. Aba com uma
  seção só — Fontes, por exemplo — esconde o trilho. Ambos os componentes
  respeitam `prefers-reduced-motion` e o trilho some abaixo de 900px.
- A cor de destaque vem da **primária** do partido
  (`partyColor(candidate.partyAcronym).primary`), mas ela não pode ser tinta em
  toda parte. Na navegação ela é a cápsula, escurecida a 55% de preto para o
  branco da pílula ter contraste. No trilho, sobre o fundo âmbar da ficha, o
  amarelo de PSB e MISSÃO daria ~1,1:1 com qualquer tinta que passasse com a cor
  do partido — não há tinta que salve — então a primária entra diluída a 25% na
  direção do `ink-900`, que é o ponto em que os 31 partidos passam dos 3:1 de
  indicador não textual (a 30% o pior caso dava 2,88:1). O rótulo do item, por
  isso, escurece no hover em vez de se colorir. O card da lista usa
  `secondary[0]` como fundo, então a ficha mostra justamente a cor que a lista
  não mostra.
- A aba "Posições" mostra "Não encontrei evidência suficiente" enquanto o
  template editorial estiver vazio.
- Export aberto: `npm run export:ficha` gera
  `data/ficha/ficha-2026-pr-deputado-federal.csv` (BOM, `;`, 51 colunas) e
  `.json`, cobrindo os 428 candidatos com as três camadas em uma linha cada.
  As colunas `historico_posicoes` e `historico_posicoes_total` resumem a
  trajetória política anterior ("2008 Vereador em Curitiba/PR (PTE) · eleito | …").

## Limitações documentadas

- Presença em Plenário e emendas orçamentárias **não têm endpoint oficial** na
  Câmara; não estão na ficha.
- Votações simbólicas (ex.: agenda de saúde, aborto) não produzem registro
  nominal por deputado e foram excluídas das pautas-chave — incluí-las seria
  enganoso.
- Voto **nulo** no histórico significa "não registrou voto naquele dia"
  (ausência ou não participação), não uma opinião.
- Votos são da Câmara apenas (o Senado não os expõe).
- A sincronização é idempotente e tolerante a falhas (retry em 5xx/429); se
  uma votação retorna 0 votos, a pauta é pulada sem gravar `null`.
- O histórico de posições anteriores depende dos arquivos históricos do TSE;
  anos sem arquivo disponível são ignorados com aviso. O casamento por nome +
  data de nascimento pode deixar de fora quem mudou completamente o nome (ex.:
  mudou sobrenome após casamento).

## Comandos

```bash
npm run sync:parliament   # Câmara + Senado -> tabelas parliament_*
npm run sync:history      # TSE 2004–2024 -> tabela political_mandates
npm run sync:finance      # TSE prestação de contas -> campaign_receitas/despesas
npm run editorial:templates  # gera/atualiza content/editorial/<id>.json
npm run export:ficha      # gera CSV + JSON em data/ficha/
```
