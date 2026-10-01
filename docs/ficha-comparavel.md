# Ficha comparável por candidato

A ficha reúne, para cada um dos 428 candidatos a deputado federal pelo Paraná
(2026), **fatos oficiais verificáveis** e **registros editoriais**, sempre
separando o que é de cada camada.

## As camadas da ficha

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

5. **Histórico municipal** (`npm run sync:municipal`, tabelas
   `municipal_chambers`, `municipal_identities` e `municipal_mandates`): o que as
   **Câmaras Municipais** publicam sobre si: cadastro de vereadores,
   mandatos com data de início e fim, legislatura e titularidade. Vem do SAPL de
   cada Câmara, lido pela API REST oficial de cada câmara.

   Esta camada é separada do `sync:history` de propósito. O TSE prova que a
   pessoa **foi candidata** a vereador; a Câmara diz quem **exerceu** e quando.
   Misturar os dois faria a ficha afirmar mandato onde houve apenas candidatura.

## O registro das Câmaras

Não existe API nacional de câmaras municipais, e a infraestrutura varia em cada
município. Por isso o projeto mantém um **registry** com as 55 Câmaras do Paraná
que aparecem no histórico de vereador dos 428 candidatos
(`src/data-sources/municipal/registry.seed.ts`). Regras:

- **Nenhuma URL é adivinhada.** Cada `apiBaseUrl` foi acessada antes de ser
  escrita; o que não respondeu ficou com `apiBaseUrl: null`.
- **`access` distingue ausências diferentes**, porque "não achei" e "não dá
  para ler" são respostas distintas:
  - `verified` (22) — a API respondeu JSON;
  - `not-found` (26) — nenhuma fonte localizada;
  - `blocked` (5) — existe, mas bloqueia acesso automatizado (WAF) ou devolve
    HTML no lugar do JSON (Curitiba, Maringá, Cianorte, Umuarama, Paranaguá);
  - `requires-auth` (1) — API real que exige token de cadastro (Londrina);
  - `html-only` (1) — publica só HTML, sem formato estruturado (Ponta Grossa).
- **Câmara sem acesso verificado tem `capabilities` toda falsa.** A regra é não
  afirmar o que não se viu.
- **Todas as 55 continuam no registry**, mesmo as inacessíveis, com a nota
  explicando por quê. Some do registro, a ficha não distinguiria "não exerceu
  mandato" de "não fui procurar".
- Os códigos IBGE são uma **tabela estática versionada**
  (`municipalities-pr.ts`), vinda da API de localidades do IBGE, para que o
  sync e os testes não dependam de rede.

Das 55 Câmaras, 22 são legíveis por script. As 33 restantes respondem por
scraping, token ou não publicam dado estruturado — trabalho que fica para
quando houver endpoint oficial ou credencial.

## Como o vínculo candidato → vereador é feito

O SAPL **não publica o número de candidato do TSE** (`numero_gab_parlamentar`
é a cadeira na Casa, não o número na urna). Sem esse identificador, não existe
como *confirmar* que o cadastro da Câmara é a mesma pessoa do candidato do TSE.
Por isso toda identidade guarda um `matchingStatus` explícito:

- **`confirmed`** — só quando `sq_candidato` bate nos dois lados. **Não ocorre
  hoje**: nenhuma das 22 Câmaras legíveis expõe esse campo.
- **`probable`** — nome idêntico após normalização **e** mesmo município **e**
  período do mandato compatível com o ano da eleição. É o máximo alcançável, e
  a ficha precisa dizer "provável" ao mostrar.
- **`unresolved`** — homônimo no mesmo município, nome curto demais, período
  contraditório ou nenhum cadastro com aquele nome. A ficha **não afirma nada**
  neste caso; a ausência aparece como "não encontrei evidência suficiente".

O SAPL também usa *nome de gabinete* ("Dra. Ana") quando o nome civil não está
preenchido, e algumas Câmaras preenchem só um dos dois: em Castro, os 32
cadastros têm `nome_completo` vazio. O casamento tenta **os dois nomes**, porque
casar só num deles perde a pessoa. Ambiguidade real (o nome casa com duas pessoas diferentes) continua recusada.

Nomes curtos demais para comparar com segurança são recusados antes do
casamento, não adivinhados.

## A regra de ouro

> **O candidato afirma X** (camada editorial) ≠ **o histórico parlamentar mostra
> X** (camada oficial).

O padrão é **"não encontrei evidência suficiente"**. Um campo editorial só
passa a mostrar um posicionamento quando alguém preenche `content/editorial/`
com valor, tipo de evidência e fonte. A ficha nunca deduz posição a partir de
votos ou métricas por conta própria.

## Como a ficha é exibida

- Página de detalhe no app (`CandidateDetailScreen`), com 6 abas:
  **Resumo** (TSE), **Mandato e histórico** (mandatos, proposições, comissões,
  despesas), **Posições anteriores** (mandatos eleitos/suplentes desde 2004,
  com cargo, município e partido), **Votações** (voto nominal por pauta + link
  para o registro oficial), **Posições** (camada editorial) e **Fontes** (todas
  as URLs usadas).
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
- **Dos 55 municípios, 33 não têm API acessível.** O histórico municipal só
  existe para os 22 com SAPL verificado. A ficha mostra "não encontrei registro
  na Câmara" nesses casos — que é diferente de "não exerceu mandato".
- **Nenhum vínculo municipal é `confirmed`.** O SAPL não expõe o número de
  candidato do TSE, então todo vínculo é `probable` (nome + município + período)
  ou `unresolved`. A ficha diz "provável" e guarda a evidência de cada um.
- **As datas do mandato são mais firmes que o nome.** O SAPL registra as datas;
  o que é apenas provável é que o cadastro seja da mesma pessoa. A ficha mostra
  "registrado pela Câmara entre X e Y" para separar as duas coisas.
- **`NM_UE` do TSE não é sempre município.** Em 2004-2024 a coluna traz o
  município do candidato; no arquivo de 2026 traz a unidade eleitoral do cargo,
  que para Deputado Federal é o próprio estado (`NM_UE` = "PARANÁ",
  `SG_UE` = "PR"). O TSE não publica município de domicílio em 2026, então o
  campo fica vazio em vez de afirmar que o candidato é de uma cidade "Paraná"
  que não existe. O sinal é `SG_UE === SG_UF`; a guarda de tela
  (`municipalityOrNull`) rejeita tanto a sigla quanto o nome do estado.
- **Matérias, presenças e votações na Câmara municipal** (Phase 4) ainda não
  entram. O SAPL tem esses endpoints, mas o volume é grande — Araucária tem mais
  de 21 mil matérias — e o formato precisa ser conferido antes de afirmar algo.
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
npm run sync:municipal-registry  # registro das 55 Câmaras -> municipal_chambers
npm run sync:municipal    # SAPL das 22 Câmaras legíveis -> municipal_*
npm run editorial:templates  # gera/atualiza content/editorial/<id>.json
npm run export:ficha      # gera CSV + JSON em data/ficha/
```

`sync:municipal` aceita `--only <município>` para depurar uma Câmara e
`--dry-run` para ver o que seria gravado sem gravar. Ele é tolerante a falhas:
Câmaras que derrubam conexão são puladas com aviso, e o que já foi lido das
outras é preservado (o `replace*` é por fonte, nunca global).