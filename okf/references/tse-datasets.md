---
type: Reference
title: Datasets TSE usados no deploy
description: URLs oficiais do TSE configuradas em src/shared/elections.ts que alimentam o pipeline de ingestão publicado no GCS.
tags: [tse, datasets, eleicoes, ingest, proveniencia]
status: stable
generated:
  by: process:opencode-plan-deploy
  at: 2026-09-30T12:00:00Z
sources:
  - id: elections-src
    resource: src/shared/elections.ts
    title: src/shared/elections.ts (CURRENT_ELECTION)
  - id: plan-deploy
    resource: PLAN-DEPLOY.md
    title: Plano de deploy §3
    author: human:muri
---

# Eleição corrente

`CURRENT_ELECTION` em `src/shared/elections.ts`:

| Campo | Valor |
|---|---|
| Ano | 2026 |
| UF | PR |
| Cargo | DEPUTADO FEDERAL |
| Chave | `2026:PR:DEPUTADO FEDERAL` |

# Datasets oficiais (CDN TSE)

| Dataset | URL |
|---|---|
| Candidatos | `https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2026.zip` |
| Bens | `https://cdn.tse.jus.br/estatistica/sead/odsele/bem_candidato/bem_candidato_2026.zip` |
| Redes sociais | `https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/rede_social_candidato_2026.zip` |
| Complementar | `https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand_complementar/consulta_cand_complementar_2026.zip` |
| Fotos | `https://cdn.tse.jus.br/estatistica/sead/eleicoes/eleicoes2026/fotos/foto_cand2026_PR_div.zip` |

# Papel no deploy

1. `npm run ingest` / `sync:*` baixam e normalizam → `data/tse.db` + `data/photos/`.
2. `npm run publish:data` publica **só** o que o runtime lê no bucket GCS.
3. O `manifest.json` grava estas URLs em `source` (proveniência).
4. Candidatos da Câmara/Senado (incumbentes, parlamentar, histórico) entram
   via `sync:incumbents`, `sync:parliament` e `sync:history` no mesmo banco.

# Regra de ouro

Posição de votos e métricas **nunca** são deduzidas: o padrão é
"não encontrei evidência suficiente". Fontes oficiais TSE/Câmara/Senado
com `source` completo.

# Relacionados

* [/deploy/data-publishing.md](/deploy/data-publishing.md)
* [/references/index.md](/references/index.md)

[^elections-src]: src/shared/elections.ts
[^plan-deploy]: Plano de deploy §3
