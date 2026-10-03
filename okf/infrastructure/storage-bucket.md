---
type: Reference
title: Bucket GCS de dados do runtime
description: Bucket privado com versioning e lifecycle (últimas ~5 versões), uniform bucket-level access, e service account dedicada ao Cloud Run.
tags: [gcs, storage, bucket, versionamento, iam]
status: stable
generated:
  by: process:opencode-plan-deploy
  at: 2026-09-30T12:00:00Z
sources:
  - id: plan-deploy
    resource: PLAN-DEPLOY.md
    title: Plano de deploy §5 (storage.tf)
    author: human:muri
  - id: storage-tf
    resource: infra/storage.tf
    title: infra/storage.tf
---

# Recurso

`google_storage_bucket.data` em [infra/storage.tf](/source-files/index.md):

| Atributo | Valor | Motivo |
|---|---|---|
| `uniform_bucket_level_access` | `true` | Sem ACLs por objeto; só IAM de bucket |
| `public_access_prevention` | `enforced` | Bucket **nunca** público |
| `versioning.enabled` | `true` | Rollback de `tse.db` |
| `lifecycle_rule` | delete se `num_newer_versions = 5` | Evita acúmulo de versões (~60 MB) |
| `location` | mesma `region` do Cloud Run | Latência; egress barato |
| `force_destroy` | `false` | Evita perda acidental de dados |

# Service account

`google_service_account.run_sa` (`<service_name>-run`) dedicada ao runtime.
Recebe `roles/storage.objectViewer` **só neste bucket**
(`google_storage_bucket_iam_member.run_reader`) — princípio do menor
privilégio. A service account **não** precisa de acesso de escrita: o
upload é feito pela máquina local via `gcloud storage` (credencial do
usuário), não pelo container.

# O que vai no bucket

| Caminho | Quem lê | Quem escreve |
|---|---|---|
| `tse.db` | Cloud Run (entrypoint) | `npm run publish:data` |
| `manifest.json` | observabilidade/debug | `npm run publish:data` |
| `photos/**` | Cloud Run (`/photos/*`) | `npm run publish:data -- --ingest` (rsync) |

**Nunca** enviar `data/download/` (~110 MB de zips) nem `data/camara/`
(intermediário de ingestão).

# Rollback de dados

1. Console/GCS: restaurar versão anterior de `tse.db`.
2. `GCS_BUCKET=gs://<bucket> npm run publish:data -- --reload` — ou apenas
   forçar o reload se o `tse.db` restaurado já for o desejado e as fotos
   não mudaram.

# Custo

Standard regional ~11 MB (≈60 MB com versões) — centavos de centavo/mês
fora do always-free; dentro de `us-east1`/`us-west1`/`us-central1` a
franquia de 5 GB cobre. Ver [custos](/infrastructure/costs.md).

[^plan-deploy]: Plano de deploy §5
[^storage-tf]: infra/storage.tf
