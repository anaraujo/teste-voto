---
type: Playbook
title: Checklist de validação antes do go-live
description: Sequência de verificações — build local, terraform plan, allow-list, flip público, e testes de imparcialidade/proveniência.
tags: [checklist, go-live, validacao, testes]
status: stable
generated:
  by: process:opencode-plan-deploy
  at: 2026-09-30T12:00:00Z
sources:
  - id: plan-deploy
    resource: PLAN-DEPLOY.md
    title: Plano de deploy §10
    author: human:muri
---

# Sequência

## 1. Container local

```sh
docker build -t teste-voto .
# simular o bucket montado
mkdir -p /tmp/tse-data && cp data/tse.db /tmp/tse-data/ && cp -r data/photos /tmp/tse-data/photos
docker run -p 8080:8080 -v /tmp/tse-data:/mnt/tse-data:ro teste-voto
```

Conferir:

* `curl :8080/api/health` → `{"status":"ok",…}`
* `curl :8080/api/candidates` → lista com candidatos
* `curl :8080/` → SPA carrega
* `curl :8080/photos/<arquivo>` → imagem

## 2. Terraform

```sh
terraform -chdir=infra plan   # limpo, sem órfãos
terraform -chdir=infra apply  # completo do zero
```

Outputs esperados: `service_url`, `bucket_name`, `image_reference`.

## 3. Acesso da allow-list

* E-mail da lista → abre o quiz
* E-mail fora da lista → 403 do IAP

## 4. Flip público

`public_access = true` + `apply` → acesso anônimo pela URL.

## 5. Qualidade do código

```sh
npm test
npm run lint
npm run check:distribution
```

Nenhuma mudança pode afetar a imparcialidade (< ~5% de vitórias
desproporcionais) nem a proveniência dos dados.

# Pós go-live

* Ativar o budget alert se `billing_account_id` não estiver no tfvars.
* Agendar (manual) `publish:data -- --reload` sempre que o TSE publicar
  atualização relevante.
* Monitorar cold start: se incomodar, discutir `min_instance_count=1`
  (custa ~US$13/mês — ver [custos](/infrastructure/costs.md)).

[^plan-deploy]: Plano de deploy §10
