---
type: Playbook
title: Operação no dia a dia
description: Comandos para atualizar dados do TSE, fazer deploy de código, liberar acesso, abrir ao público e dar rollback de dados.
tags: [operacao, runbook, deploy, dados]
status: stable
generated:
  by: process:opencode-plan-deploy
  at: 2026-09-30T12:00:00Z
sources:
  - id: plan-deploy
    resource: PLAN-DEPLOY.md
    title: Plano de deploy §9
    author: human:muri
  - id: data-pub
    resource: /deploy/data-publishing.md
    title: Publicação de dados no GCS
---

# Tabela de tarefas

| tarefa | comando |
|---|---|
| Atualizar dados do TSE | `npm run ingest && npm run sync:* && npm run publish:data -- --reload` |
| Deploy de código | `gcloud builds submit --tag … && terraform -chdir=infra apply -var="image=…"` |
| Liberar acesso a alguém | editar `allowed_emails` + `terraform -chdir=infra apply` |
| Abrir ao público | `public_access = true` + `terraform -chdir=infra apply` |
| Rollback de dados | restaurar versão anterior do `tse.db` no bucket + `--reload` |

# Detalhes

## Atualizar dados do TSE

```sh
npm run ingest
npm run sync:incumbents
npm run sync:parliament
npm run sync:history
GCS_BUCKET=gs://<bucket> npm run publish:data -- --reload
```

O `--reload` força nova revisão (`DATA_VERSION`) para as instâncias
quentes recopiarem o banco do FUSE. Sem ele, dados velhos podem ficar no ar.

## Deploy de código

Muda `server/`, `src/` (frontend), `content/editorial/` ou o Dockerfile:

```sh
TAG=$(date -u +%Y%m%d%H%M%S)
gcloud builds submit --tag <region>-docker.pkg.dev/<proj>/teste-voto/app:$TAG .
terraform -chdir=infra apply -var="image=<region>-docker.pkg.dev/<proj>/teste-voto/app:$TAG"
```

Mudança **só editorial** (JSON em `content/editorial/`) também exige
novo deploy — o conteúdo vai dentro da imagem.

## Liberar acesso a alguém

```hcl
# infra/terraform.tfvars
allowed_emails = [
  "voce@gmail.com",
  "nova.pessoa@exemplo.org",
]
```

```sh
terraform -chdir=infra apply
```

Remover = tirar o e-mail da lista + `apply`.

## Abrir ao público

```hcl
public_access = true
```

```sh
terraform -chdir=infra apply
```

Ver [privado → público](/operations/private-to-public.md).

## Rollback de dados

1. `gcloud storage versions list gs://<bucket>/tse.db`
2. Restaurar a versão desejada (Console ou `gcloud storage cp` da versão).
3. `GCS_BUCKET=gs://<bucket> npm run publish:data -- --reload` (ou só o reload se fotos/manifest não mudaram).

# Checklist de saúde pós-operação

```sh
curl -s https://<service-url>/api/health
# {"status":"ok","election":"2026:PR:DEPUTADO FEDERAL"}
```

Conferir também `/` (SPA) e uma foto em `/photos/…`.

# Não quebre

* `npm test`, `npm run lint` e `npm run check:distribution` devem seguir verdes após mudanças de código.
* Proveniência: manifesto e fontes não podem ser removidos no fluxo de publish.
* Nunca subir `data/download/` ao bucket.

[^plan-deploy]: Plano de deploy §9
[^data-pub]: Publicação de dados no GCS
