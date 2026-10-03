---
type: Playbook
title: Publicação de dados no GCS
description: Fluxo de npm run publish:data — checkpoint WAL, manifest de proveniência, upload via gcloud storage e reload opcional do Cloud Run.
tags: [gcs, dados, publish, tse, proveniencia]
status: stable
generated:
  by: process:opencode-plan-deploy
  at: 2026-09-30T12:00:00Z
sources:
  - id: plan-deploy
    resource: PLAN-DEPLOY.md
    title: Plano de deploy §3
    author: human:muri
  - id: script-src
    resource: scripts/publish-data.ts
    title: scripts/publish-data.ts
---

# Objetivo

Publicar o que o runtime lê (`tse.db`, `manifest.json`, `photos/`) no
bucket GCS, **sem** subir `data/download/` (zips brutos, ~110 MB) nem
`data/camara/` (intermediário de ingestão).

# Pré-requisitos

* Pipeline local completo: `npm run ingest && npm run sync:incumbents && npm run sync:parliament && npm run sync:history`
* `gcloud` autenticado (`gcloud auth login` e `gcloud auth application-default login`)
* Variável `GCS_BUCKET` (ex.: `gs://meu-projeto-teste-voto-dados`) em `.env` ou no ambiente
* Opcional: `CLOUD_RUN_SERVICE` e `CLOUD_RUN_REGION` (defaults: `teste-voto`, `southamerica-east1`)

# Fluxo do script

1. **Ingestão opcional** — flag `--ingest` roda ingest + os três syncs.
2. **Checkpoint WAL** — abre `data/tse.db` e executa `PRAGMA wal_checkpoint(TRUNCATE)`. O repositório usa WAL ([repository.ts](/source-files/server-index.md)); o upload deve levar um único arquivo consistente.
3. **Manifest** — gera `data/manifest.json` com:
   * `publishedAt` (ISO 8601)
   * `election` (`2026:PR:DEPUTADO FEDERAL`)
   * `tseDbSha256`, `tseDbBytes`
   * `photosCount`, `photosBytes`
   * `candidatesCount`
   * `source` com URL do dataset oficial e lista de datasets (proveniência)
4. **Upload** via `gcloud storage`:
   * `cp data/tse.db gs://<bucket>/tse.db`
   * `cp data/manifest.json gs://<bucket>/manifest.json`
   * `rsync data/photos gs://<bucket>/photos --recursive`
5. **Reload opcional** — flag `--reload` força nova revisão sem trocar a imagem:
   ```
   gcloud run services update <svc> --region <r> --update-env-vars DATA_VERSION=<timestamp>
   ```

# Comandos

```sh
# Só publica o que já está local
GCS_BUCKET=gs://meu-projeto-teste-voto-dados npm run publish:data

# Pipeline completo + publicação
npm run publish:data -- --ingest

# Publica e recarrega as instâncias quentes
npm run publish:data -- --reload
```

# Erros comuns

| Sintoma | Causa | Correção |
|---|---|---|
| `data/tse.db não encontrado` | Ingestão não rodou | `npm run ingest` ou `--ingest` |
| `GCS_BUCKET vazia` | Env ausente | Exporte `GCS_BUCKET` ou use `.env` |
| `gcloud: command not found` | CLI ausente | Instale o Google Cloud SDK |
| Dados velhos no ar | Instâncias quentes | `publish:data -- --reload` |

# Convenções do projeto

* Backend sem dependências novas: o script usa só `node:child_process`, `node:crypto`, `node:fs`, `node:sqlite` (padrão do Node).
* Manifest mantém a regra de proveniência: tudo carrega `source` de arquivo oficial (TSE).

[^plan-deploy]: Plano de deploy §3
[^script-src]: scripts/publish-data.ts
