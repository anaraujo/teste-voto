---
type: Playbook
title: Cloud Run e IAP
description: Serviço único com volume GCS gen2, IAP direto na fase privada, allow-list de e-mails e abertura pública por public_access=true.
tags: [cloud-run, iap, gcs, iam, deploy]
status: stable
generated:
  by: process:opencode-plan-deploy
  at: 2026-09-30T12:00:00Z
sources:
  - id: plan-deploy
    resource: PLAN-DEPLOY.md
    title: Plano de deploy §5 e §7
    author: human:muri
  - id: run-tf
    resource: infra/run.tf
    title: infra/run.tf
  - id: iap-doc
    resource: /references/gcp-cloud-run-iap.md
    title: Cloud Run + IAP (docs Google)
---

# Configuração do serviço (`google_cloud_run_v2_service`)

| Campo | Valor | Por quê |
|---|---|---|
| `ingress` | `INGRESS_TRAFFIC_ALL` | IAP protege todas as origens, inclusive `run.app` default |
| `iap_enabled` | `!var.public_access` | Fase privada liga IAP; pública desliga |
| `execution_environment` | `EXECUTION_ENVIRONMENT_GEN2` | Exigido para volume GCS |
| scaling | `min_instance_count=0`, `max_instance_count=3` | Custo ~zero; guardrail de escala |
| recursos | 1 vCPU / 512 Mi, `cpu_idle=true` | Franquia Cloud Run |
| `container_concurrency` | default (80) | Quiz é I/O leve |
| volume | `gcs { bucket = …, read_only = true }` → `/mnt/tse-data` | Dados fora da imagem |
| env | `DATA_DIR=/app/data`, `SERVE_STATIC=true`, `PORT=8080`, `DATA_VERSION` | Bootstrap do entrypoint + reload |
| startup probe | `GET /api/health` em `:8080` | Evita rotear tráfego antes do Node subir |

# Passo manual do IAP (uma vez)

Projetos **sem organização Google** exigem configurar a tela de
consentimento OAuth pelo Console antes da primeira ativação do IAP — não
é automatizável via Terraform.

Caminho: Console → Cloud Run → serviço → Security → habilitar IAP uma vez
(pode desabilitar depois; o Terraform reassume). Detalhes em
[Cloud Run + IAP](/references/gcp-cloud-run-iap.md).

# IAM

## Sempre

`roles/run.invoker` para a service account do IAP:

```
serviceAccount:service-<PROJECT_NUMBER>@gcp-sa-iap.iam.gserviceaccount.com
```

Recursos: `google_cloud_run_v2_service_iam_member.iap_invoker` em
[infra/run.tf](/source-files/index.md).

## Privado (`public_access = false`)

`google_iap_web_cloud_run_service_iam_binding`:

* `role = roles/iap.httpsResourceAccessor`
* `members = [for e in var.allowed_emails : "user:${e}"]`

Adicionar/remover acesso = editar `allowed_emails` + `terraform apply`
(ou Console → Cloud Run → Security).

## Público (`public_access = true`)

`roles/run.invoker` para `allUsers`. Reversível a qualquer momento.

# Build + deploy de código

```sh
gcloud builds submit --tag <region>-docker.pkg.dev/<proj>/teste-voto/app:<tag> .
terraform -chdir=infra apply -var="image=<tag>"
```

# Dados no bucket

O serviço **não** embute dados. Após `npm run publish:data`, use `--reload`
para as instâncias quentes relerem:

```sh
GCS_BUCKET=gs://<bucket> npm run publish:data -- --reload
```

# Riscos

* **Cold start**: FUSE + cópia de ~10 MB adiciona ~2–4 s após escala a zero. Aceitável; `min_instance_count=1` sai do ~zero (~US$13/mês — não recomendado).
* **Dados velhos em instâncias quentes**: resolvido pelo `--reload`.
* **IAP sem organização**: exige o passo manual único acima.

[^plan-deploy]: Plano de deploy §5 e §7
[^run-tf]: infra/run.tf
[^iap-doc]: Cloud Run + IAP
