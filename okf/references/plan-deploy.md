---
type: Reference
title: Plano de deploy (PLAN-DEPLOY.md)
description: Documento fonte no repositório que este bundle OKF implementa e documenta — arquitetura, etapas, custos e checklist.
tags: [plano, deploy, fonte, gcp]
status: stable
generated:
  by: process:opencode-plan-deploy
  at: 2026-09-30T12:00:00Z
sources:
  - id: plan-file
    resource: PLAN-DEPLOY.md
    title: Plano de deploy — teste-voto na Google Cloud (GCP)
    author: human:muri
---

# Caminho no repositório

`PLAN-DEPLOY.md` (raiz).

# Seções

| § | Conteúdo | Documento OKF |
|---|---|---|
| 1 | Arquitetura alvo | [/architecture.md](/architecture.md) |
| 2 | Pré-requisitos | [/deploy/cloud-run.md](/deploy/cloud-run.md) |
| 3 | Publicação de dados | [/deploy/data-publishing.md](/deploy/data-publishing.md) |
| 4 | Container e Cloud Run | [/deploy/container.md](/deploy/container.md) |
| 5 | Terraform em `infra/` | [/infrastructure/terraform-variables.md](/infrastructure/terraform-variables.md) |
| 6 | Custos ~US$0 | [/infrastructure/costs.md](/infrastructure/costs.md) |
| 7 | Fase privada → pública | [/operations/private-to-public.md](/operations/private-to-public.md) |
| 8 | Checklist de implementação | [/source-files/index.md](/source-files/index.md) |
| 9 | Operação no dia a dia | [/operations/day-to-day.md](/operations/day-to-day.md) |
| 10 | Validação go-live | [/operations/go-live-checklist.md](/operations/go-live-checklist.md) |
| 11 | Riscos e limitações | [/deploy/cloud-run.md](/deploy/cloud-run.md) |

# Checklist da §8 (status)

- [x] `server/index.ts` com `SERVE_STATIC` + fallback SPA
- [x] `scripts/publish-data.ts` + script `publish:data`
- [x] `Dockerfile`, `.dockerignore`, `docker-entrypoint.sh`
- [x] `infra/` + `terraform.tfvars.example`
- [x] `.env.example` com `GCS_BUCKET`
- [x] `.gitignore` com entradas do Terraform
- [x] `AGENTS.md` atualizado
- [x] Documentação em `okf/` (este bundle)
- [ ] Opcional futuro: Cloud Build trigger ou GitHub Action

# Relacionados

* [/source-files/index.md](/source-files/index.md) — inventário de arquivos
* [/operations/go-live-checklist.md](/operations/go-live-checklist.md) — validação

[^plan-file]: PLAN-DEPLOY.md
