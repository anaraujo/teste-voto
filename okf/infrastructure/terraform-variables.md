---
type: Reference
title: Variáveis Terraform e estado
description: Tabela de variáveis do módulo infra/, terraform.tfvars.example, estado local e evolução futura com backend GCS.
tags: [terraform, infra, variaveis, estado]
status: stable
generated:
  by: process:opencode-plan-deploy
  at: 2026-09-30T12:00:00Z
sources:
  - id: plan-deploy
    resource: PLAN-DEPLOY.md
    title: Plano de deploy §5
    author: human:muri
  - id: vars-tf
    resource: infra/variables.tf
    title: infra/variables.tf
  - id: tfvars-example
    resource: infra/terraform.tfvars.example
    title: infra/terraform.tfvars.example
---

# Arquivos do módulo

```
infra/
  versions.tf               terraform >= 1.6, provider google ~> 6.x
  variables.tf              ver tabela abaixo
  main.tf                   data.google_project + ativação das APIs
  storage.tf                bucket + IAM da service account + budget
  registry.tf               Artifact Registry + cleanup policy
  run.tf                    Cloud Run + IAP + allow-list/allUsers
  outputs.tf                URL, bucket, comandos prontos
  terraform.tfvars.example
```

# Variáveis

| variável | default | obs |
|---|---|---|
| `project_id` | — | obrigatória |
| `region` | `southamerica-east1` | ver [custos](/infrastructure/costs.md) |
| `service_name` | `teste-voto` | |
| `bucket_name` | — | obrigatória (nome global) |
| `image` | — | tag publicada no Artifact Registry |
| `public_access` | `false` | `true` abre para qualquer pessoa |
| `allowed_emails` | `[]` | allow-list da fase privada |
| `billing_account_id` | `""` | vazio desativa o `google_billing_budget` |
| `budget_amount_usd` | `1` | alerta simbólico (não corta gasto) |
| `registry_repo_id` | `teste-voto` | repo Docker no Artifact Registry |

# APIs ativadas (`main.tf`)

`run`, `storage`, `artifactregistry`, `cloudbuild`, `iap` — todas via
`google_project_service` com `disable_on_destroy = false`.

# Estado

* **Local no início** (KISS). `.gitignore` cobre `infra/.terraform/`, `*.tfstate*`, `terraform.tfvars`.
* **Evolução futura**: backend GCS com versioning (`terraform {
  backend "gcs" { bucket = "…", prefix = "teste-voto/terraform" } }`) quando houver mais de uma pessoa fazendo apply.

# Comandos

```sh
cp infra/terraform.tfvars.example infra/terraform.tfvars
# edite project_id, bucket_name, image, allowed_emails

terraform -chdir=infra init
terraform -chdir=infra plan
terraform -chdir=infra apply
```

> **Nunca** rode `terraform apply` sem o dono do projeto pedir (convenção do AGENTS.md).

[^plan-deploy]: Plano de deploy §5
[^vars-tf]: infra/variables.tf
[^tfvars-example]: infra/terraform.tfvars.example
