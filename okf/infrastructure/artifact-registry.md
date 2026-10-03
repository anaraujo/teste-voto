---
type: Reference
title: Artifact Registry para imagens
description: Repo Docker teste-voto com cleanup policy mantendo as 3 imagens mais recentes para caber na franquia de 0,5 GB.
tags: [artifact-registry, docker, imagens, cleanup]
status: stable
generated:
  by: process:opencode-plan-deploy
  at: 2026-09-30T12:00:00Z
sources:
  - id: plan-deploy
    resource: PLAN-DEPLOY.md
    title: Plano de deploy §5 (registry.tf)
    author: human:muri
  - id: registry-tf
    resource: infra/registry.tf
    title: infra/registry.tf
---

# Recurso

`google_artifact_registry_repository.docker`:

* `repository_id = var.registry_repo_id` (default `teste-voto`)
* `format = "DOCKER"`
* mesma `region` do Cloud Run (evita cross-region pull)

# Cleanup policy

| Policy | Ação | Critério |
|---|---|---|
| `keep-recent` | KEEP | 3 imagens mais recentes |
| `delete-old` | DELETE | tags `dev-*`/`test-*` com > 30 dias |

Franquia always-free: **0,5 GB**. Cada imagem ~150 MB → 3 imagens cabem
com folga. Sem cleanup, tags antigas estouram a franquia e começam a
gerar custo.

# Caminho da imagem

```
<region>-docker.pkg.dev/<project_id>/<registry_repo_id>/app:<tag>
```

Exemplo (output Terraform `image_reference`):

```
southamerica-east1-docker.pkg.dev/meu-projeto/teste-voto/app:20260930120000
```

# Build e push

```sh
gcloud builds submit --tag <region>-docker.pkg.dev/<proj>/teste-voto/app:<tag> .
terraform -chdir=infra apply -var="image=<region>-docker.pkg.dev/<proj>/teste-voto/app:<tag>"
```

A tag deve ser única por deploy (timestamp) para o cleanup KEEP-3 fazer
sentido.

# Nota

`cloudbuild.googleapis.com` é ativada em [infra/main.tf](/source-files/index.md)
junto com as demais APIs.

[^plan-deploy]: Plano de deploy §5
[^registry-tf]: infra/registry.tf
