---
type: Playbook
title: Fase privada → fase pública
description: Como o IAP com allow-list vira acesso público por public_access=true, e como reverter.
tags: [iap, publico, privado, terraform, acesso]
status: stable
generated:
  by: process:opencode-plan-deploy
  at: 2026-09-30T12:00:00Z
sources:
  - id: plan-deploy
    resource: PLAN-DEPLOY.md
    title: Plano de deploy §7
    author: human:muri
  - id: iam
    resource: /infrastructure/iam-and-access.md
    title: IAM e acesso
---

# Fase privada (default)

* `public_access = false`
* `iap_enabled = true` no Cloud Run
* Allow-list em `allowed_emails` no Terraform
* Usuário abre a URL → redireciona para login Google → só e-mails da lista passam
* Fora da lista: 403 do IAP

Passo manual único (projetos sem organização): habilitar IAP uma vez no
Console para configurar o consentimento OAuth
([cloud-run.md](/deploy/cloud-run.md)).

# Virar pública

1. Edite `infra/terraform.tfvars`:

   ```hcl
   public_access = true
   ```

2. Aplique:

   ```sh
   terraform -chdir=infra apply
   ```

Efeitos:

* IAP desligado (`iap_enabled = false`)
* `roles/run.invoker` concedido a `allUsers`
* Binding IAP destruído
* Qualquer pessoa com a URL acessa o quiz

# Reverter para privado

1. `public_access = false` + `allowed_emails = ["…"]`
2. `terraform -chdir=infra apply`
3. Reative IAP no Console se o OAuth consent screen tiver sido removido
   (o Terraform reassume `iap_enabled`, mas o consent screen é do Console)

# Acesso individual sem Terraform

Console → Cloud Run → serviço → Security → IAP → adicionar membro
(`user:<email>`). Útil para um teste rápido; o estado Terraform pode
divergir — prefira o tfvars para o estado canônico.

# Riscos da fase pública

* O quiz passa a ser anônimo e indexável — ok para o caso de uso.
* Tráfego continua com guardrails (`max_instance_count=3`, budget, bucket privado).
* Reversível a qualquer momento pelos passos acima.

[^plan-deploy]: Plano de deploy §7
[^iam]: IAM e acesso
