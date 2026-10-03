---
type: Reference
title: scripts/publish-data.ts
description: Script de publicação de dados no GCS — flags --ingest/--reload, checkpoint WAL, manifest de proveniência e upload via gcloud storage.
tags: [script, publish, gcs, tse, proveniencia]
status: stable
generated:
  by: process:opencode-plan-deploy
  at: 2026-09-30T12:00:00Z
sources:
  - id: script-src
    resource: scripts/publish-data.ts
    title: scripts/publish-data.ts
  - id: plan-deploy
    resource: PLAN-DEPLOY.md
    title: Plano de deploy §3
    author: human:muri
---

# Caminho

`scripts/publish-data.ts` — executado por `npm run publish:data`.

# Interface

## Flags

| Flag | Efeito |
|---|---|
| `--ingest` | Roda `ingest`, `sync:incumbents`, `sync:parliament`, `sync:history` antes |
| `--reload` | Após upload, `gcloud run services update` com `DATA_VERSION=<publishedAt>` |
| `--help` | Mostra uso |

## Variáveis de ambiente

| Variável | Obrigatória | Default | Uso |
|---|---|---|---|
| `GCS_BUCKET` | sim | — | Bucket alvo (`gs://…` ou nome puro) |
| `CLOUD_RUN_SERVICE` | não | `teste-voto` | Serviço no `--reload` |
| `CLOUD_RUN_REGION` | não | `southamerica-east1` | Região no `--reload` |
| `DATA_DIR` | não | `data` | Raiz local dos dados |

# Pipeline interno

1. Parse de flags; falha em flag desconhecida.
2. `--ingest` → pipeline completo via `spawnSync`.
3. Exige `data/tse.db`; avisa se `data/photos/` ausente.
4. `PRAGMA wal_checkpoint(TRUNCATE)` em `data/tse.db`.
5. sha256 + bytes do banco; walk recursivo de `data/photos/`.
6. `listCandidates` para `candidatesCount` da eleição corrente.
7. Escreve `data/manifest.json`:

```json
{
  "publishedAt": "2026-09-30T12:00:00.000Z",
  "election": "2026:PR:DEPUTADO FEDERAL",
  "electionYear": 2026,
  "state": "PR",
  "office": "DEPUTADO FEDERAL",
  "tseDbSha256": "…",
  "tseDbBytes": 1600000,
  "photosCount": 428,
  "photosBytes": 8700000,
  "candidatesCount": 428,
  "source": {
    "electionUrl": "https://cdn.tse.jus.br/…/consulta_cand_2026.zip",
    "datasets": [ { "dataset": "consultas_candidatos", "url": "…" }, … ]
  }
}
```

8. Upload:
   * `gcloud storage cp data/tse.db gs://<bucket>/tse.db`
   * `gcloud storage cp data/manifest.json gs://<bucket>/manifest.json`
   * `gcloud storage rsync data/photos gs://<bucket>/photos --recursive`
9. `--reload` → `gcloud run services update <svc> --region <r> --update-env-vars DATA_VERSION=<ts>`

# Proveniência

O manifest carrega URL oficial do TSE e lista de datasets — mesma regra do
projeto: nada de posição/métrica sem fonte. O `election` usa
`electionKey(CURRENT_ELECTION)` de `src/shared/elections.ts`.

# Dependências

Apenas módulos do Node: `node:child_process`, `node:crypto`, `node:fs`,
`node:fs/promises`, `node:path`, `node:sqlite` + imports internos do
repositório. Zero dependências npm novas (convenção AGENTS.md).

# Segurança operacional

* Nunca envia `data/download/` nem `data/camara/`.
* Falha cedo se `GCS_BUCKET` vazia ou `gcloud` retornar erro.
* `--reload` é opcional: publicar sem instâncias quentes não exige.

[^script-src]: scripts/publish-data.ts
[^plan-deploy]: Plano de deploy §3
