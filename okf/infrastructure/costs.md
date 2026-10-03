---
type: Reference
title: Modelo de custos (~US$0)
description: Franquias always-free por serviço, por que o default é southamerica-east1 e quais guardrails evitam surpresa na fatura.
tags: [custos, free-tier, cloud-run, gcs, cloud-build]
status: stable
generated:
  by: process:opencode-plan-deploy
  at: 2026-09-30T12:00:00Z
sources:
  - id: plan-deploy
    resource: PLAN-DEPLOY.md
    title: Plano de deploy §6
    author: human:muri
---

# Franquias e uso esperado

| Serviço | Franquia gratuita (mensal) | Uso esperado |
|---|---|---|
| Cloud Run | 2 mi requisições, 180 mil vCPU-s, 360 mil GiB-s | escala a zero; tráfego de quiz |
| GCS Standard regional | 5 GB always-free (us-east1/us-west1/us-central1) | ~11 MB (~60 MB com versões) |
| Artifact Registry | 0,5 GB | ~150 MB × 3 imagens com cleanup |
| Cloud Build | 120 min/dia | ~5 min/deploy |
| IAP | sem custo | — |
| Egress | 1 GB (América do Norte) | fotos 8,7 MB totais + API |

# Região

O always-free de **storage** só vale em `us-east1`, `us-west1` e
`us-central1`. Como o público é brasileiro, o default é
`southamerica-east1` (latência ~10× menor): os 11 MB custam centavos de
**centavo** por mês e a franquia do Cloud Run vale em qualquer região.

Quem quiser free tier estrito: `region = "us-east1"` em `terraform.tfvars`.

# Guardrails

| Guardrail | Onde |
|---|---|
| `max_instance_count = 3` | `infra/run.tf` |
| Budget com alerta em US$1 (0,5 / 0,9 / 1,0) | `infra/storage.tf` (`google_billing_budget`) |
| Bucket privado + `public_access_prevention=enforced` | `infra/storage.tf` |
| Cleanup de imagens (KEEP 3) | `infra/registry.tf` |
| Egress mínimo (fotos locais via `/photos/*`) | arquitetura |

> O orçamento **não corta** gasto — só avisa cedo. Para cortar, ative
> budget action no Console (fora do escopo do plano).

# Cenário que sai do ~zero

`min_instance_count = 1` mantém instância quente → ~US$13/mês. **Não
recomendado** para este caso de uso; o cold start de 2–4 s é aceitável
para um quiz.

# Billing

O billing **deve** estar ativado mesmo no free tier. `billing_account_id`
no tfvars liga o alerta; vazio omite o recurso de budget.

[^plan-deploy]: Plano de deploy §6
