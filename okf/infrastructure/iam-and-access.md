---
type: Reference
title: IAM e acesso (IAP, allow-list, allUsers)
description: Matriz de permissões do deploy — invoker do IAP sempre, binding IAP na fase privada, allUsers na pública, bucket só para a SA do runtime.
tags: [iam, iap, cloud-run, acesso, allow-list]
status: stable
generated:
  by: process:opencode-plan-deploy
  at: 2026-09-30T12:00:00Z
sources:
  - id: plan-deploy
    resource: PLAN-DEPLOY.md
    title: Plano de deploy §5 (IAM) e §7
    author: human:muri
  - id: run-tf
    resource: infra/run.tf
    title: infra/run.tf
  - id: iap-doc
    resource: /references/gcp-cloud-run-iap.md
    title: Cloud Run + IAP
---

# Matriz de acesso

| Cenário | Quem invoca o Cloud Run | Quem lê o bucket |
|---|---|---|
| Privado (`public_access=false`) | IAP (`roles/iap.httpsResourceAccessor` na allow-list) + SA do IAP (`run.invoker`) | SA do runtime (`storage.objectViewer`) |
| Público (`public_access=true`) | `allUsers` (`run.invoker`) | SA do runtime |
| Upload de dados | Usuário local (`gcloud storage`, credencial pessoal) | — |
| Terraform | Quem roda apply (owner/editor) | — |

# Recursos Terraform

| Recurso | Quando | Papel |
|---|---|---|
| `google_cloud_run_v2_service_iam_member.iap_invoker` | sempre | SA do IAP invoca o serviço |
| `google_iap_web_cloud_run_service_iam_binding.private` | `public_access=false` | Allow-list de e-mails |
| `google_cloud_run_v2_service_iam_member.public_invoker` | `public_access=true` | `allUsers` |
| `google_storage_bucket_iam_member.run_reader` | sempre | SA do runtime lê o bucket |
| `google_service_account.run_sa` | sempre | Identidade do container |

# Allow-list (fase privada)

```hcl
allowed_emails = [
  "voce@gmail.com",
  "outra.pessoa@exemplo.org",
]
```

* Membros no binding: `user:<email>`.
* Login: o IAP redireciona para conta Google; só e-mails da lista passam.
* Demais: 403 do IAP.
* Adicionar alguém = editar `allowed_emails` + `terraform -chdir=infra apply`.

# Virar público

`public_access = true` + `apply`:

1. `iap_enabled` vira `false` (IAP desligado).
2. `roles/run.invoker` é concedido a `allUsers`.
3. Binding IAP é destruído (`count = 0`).

Reversível: volte `public_access = false` e `apply`.

# Princípio do menor privilégio

* Bucket **privado** — nunca `allUsers` no GCS.
* SA do runtime só `objectViewer` no bucket específico.
* Upload de dados é operação **local** (humano/CI com credencial), não do container.
* SA do IAP é a única que precisa de `run.invoker` mesmo em modo público (redundante com `allUsers`, mas inofensivo e mantido pelo plano).

[^plan-deploy]: Plano de deploy §5 e §7
[^run-tf]: infra/run.tf
[^iap-doc]: Cloud Run + IAP
