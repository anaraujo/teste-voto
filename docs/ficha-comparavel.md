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

## A regra de ouro

> **O candidato afirma X** (camada editorial) ≠ **o histórico parlamentar mostra
> X** (camada oficial).

O padrão é **"não encontrei evidência suficiente"**. Um campo editorial só
passa a mostrar um posicionamento quando alguém preenche `content/editorial/`
com valor, tipo de evidência e fonte. A ficha nunca deduz posição a partir de
votos ou métricas por conta própria.

## Como a ficha é exibida

- Página de detalhe no app (`CandidateDetailScreen`), com 5 abas:
  **Resumo** (TSE), **Mandato e histórico** (mandatos, proposições, comissões,
  despesas), **Votações** (voto nominal por pauta + link para o registro
  oficial), **Posições** (camada editorial) e **Fontes** (todas as URLs usadas).
- A aba "Posições" mostra "Não encontrei evidência suficiente" enquanto o
  template editorial estiver vazio.
- Export aberto: `npm run export:ficha` gera
  `data/ficha/ficha-2026-pr-deputado-federal.csv` (BOM, `;`, 49 colunas) e
  `.json`, cobrindo os 428 candidatos com as três camadas em uma linha cada.

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

## Comandos

```bash
npm run sync:parliament   # Câmara + Senado -> tabelas parliament_*
npm run editorial:templates  # gera/atualiza content/editorial/<id>.json
npm run export:ficha      # gera CSV + JSON em data/ficha/
```