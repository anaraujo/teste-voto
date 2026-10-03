---
type: Reference
title: Cloud Run com Identity-Aware Proxy
description: Referência oficial do Google sobre IAP no Cloud Run — passo manual de consentimento OAuth e como o IAP protege serviços sem load balancer.
tags: [iap, cloud-run, oauth, seguranca, gcp]
status: stable
generated:
  by: process:opencode-plan-deploy
  at: 2026-09-30T12:00:00Z
sources:
  - id: iap-doc
    resource: https://cloud.google.com/run/docs/securing/identity-aware-proxy-cloud-run
    title: Securing Cloud Run with Identity-Aware Proxy
    author: Google Cloud
  - id: plan-deploy
    resource: PLAN-DEPLOY.md
    title: Plano de deploy §2 e §5
    author: human:muri
---

# URL oficial

<https://cloud.google.com/run/docs/securing/identity-aware-proxy-cloud-run>

# Por que IAP direto no Cloud Run

* GA, **sem custo**, sem Cloud Load Balancing (~US$18/mês).
* Protege o domínio `run.app` default do serviço.
* `iap_enabled = true` no `google_cloud_run_v2_service` (provider google ~> 6).
* Invocação controlada por `roles/iap.httpsResourceAccessor` (binding) e
  `roles/run.invoker` para a SA do IAP.

# Passo manual (projetos sem organização)

A **primeira** ativação do IAP exige configurar a tela de consentimento
OAuth pelo Console — não é automatizável via Terraform.

1. Console → Cloud Run → serviço → **Security**.
2. Habilitar IAP (mesmo que vá desabilitar depois).
3. Configurar OAuth consent screen (External, e-mails da allow-list).
4. O Terraform reassume `iap_enabled` a partir daí.

# Nesta implementação

| Arquivo | Papel |
|---|---|
| `infra/run.tf` | `iap_enabled`, binding IAP, invoker da SA do IAP |
| `okf/infrastructure/iam-and-access.md` | Matriz de acesso |
| `okf/deploy/cloud-run.md` | Playbook do serviço |
| `okf/operations/private-to-public.md` | Flip público/privado |

# Permissões de teste

* E-mail da allow-list → login Google → quiz abre.
* E-mail fora → HTTP 403.

[^iap-doc]: Securing Cloud Run with Identity-Aware Proxy
[^plan-deploy]: Plano de deploy §2 e §5
