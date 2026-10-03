---
type: Reference
title: Cloud Storage FUSE no Cloud Run
description: Volume mount de bucket GCS (FUSE gen2) no google_cloud_run_v2_service — suporte, restrições e por que copiamos os dados para o disco local.
tags: [gcs, fuse, cloud-run, volumes, sqlite]
status: stable
generated:
  by: process:opencode-plan-deploy
  at: 2026-09-30T12:00:00Z
sources:
  - id: gcs-fuse-doc
    resource: https://cloud.google.com/run/docs/configuring/gcs-fuse
    title: Mount Cloud Storage buckets with Cloud Storage FUSE
    author: Google Cloud
  - id: plan-deploy
    resource: PLAN-DEPLOY.md
    title: Plano de deploy §1 e §5
    author: human:muri
---

# URL oficial

<https://cloud.google.com/run/docs/configuring/gcs-fuse>

# Como usamos

No `google_cloud_run_v2_service` (`infra/run.tf`):

```hcl
execution_environment = "EXECUTION_ENVIRONMENT_GEN2"

template {
  volumes {
    name = "tse-data"
    gcs {
      bucket    = google_storage_bucket.data.name
      read_only = true
    }
  }
  containers {
    volume_mounts {
      name       = "tse-data"
      mount_path = "/mnt/tse-data"
    }
  }
}
```

# Por que não ler SQLite direto do FUSE

| Problema | Efeito |
|---|---|
| Semântica de lock/mmap | Corrupção ou erros de leitura em WAL |
| Latência por operação | SQLite faz muitas operações pequenas |
| Volume read-only | Não dá para escrever WAL/SHM no FUSE |

**Solução adotada**: entrypoint copia `tse.db` (+ `photos/`) de
`/mnt/tse-data` para `$DATA_DIR` no disco efêmero do container antes de
subir o Node. Ver [docker-assets.md](/source-files/docker-assets.md).

# Tamanhos

* `tse.db` ≈ 1,6 MB
* `photos/` ≈ 8,7 MB
* Cópia < 2 s no cold start; overhead total ~2–4 s (aceitável; ver
  [custos](/infrastructure/costs.md) para `min_instance_count=1`).

# Atualização de dados

O volume é montado no **startup**. Instâncias quentes não remontam — por
isso o `--reload` do `publish:data` força nova revisão
(`DATA_VERSION`) e novo cold start com cópia fresca.

# Relacionados

* [storage-bucket.md](/infrastructure/storage-bucket.md) — bucket privado
* [cloud-run.md](/deploy/cloud-run.md) — serviço e IAP
* [data-publishing.md](/deploy/data-publishing.md) — publicação

[^gcs-fuse-doc]: Mount Cloud Storage buckets with Cloud Storage FUSE
[^plan-deploy]: Plano de deploy §1 e §5
