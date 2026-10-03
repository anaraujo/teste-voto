---
type: Architecture
title: Arquitetura alvo do deploy GCP
description: Um único Cloud Run serve app, API e fotos; dados do TSE no GCS montado via FUSE e copiados para o disco no startup; IAP direto na fase privada.
tags: [gcp, cloud-run, gcs, arquitetura, deploy]
status: stable
generated:
  by: process:opencode-plan-deploy
  at: 2026-09-30T12:00:00Z
sources:
  - id: plan-deploy
    resource: PLAN-DEPLOY.md
    title: Plano de deploy — teste-voto na Google Cloud
    author: human:muri
  - id: agente-convencao
    resource: AGENTS.md
    title: Guia mínimo para agentes
---

# Decisões-chave

| Decisão | Motivo |
|---|---|
| **Um único serviço Cloud Run** | Zero CORS, zero LB (~US$18/mês), escala a zero. Serve `dist/` (SPA), `/api/*` e `/photos/*`. |
| **Dados no GCS, fora da imagem** | Mudança editorial = novo deploy; mudança de dados = `npm run publish:data`. Bucket privado. |
| **Cópia FUSE → disco no entrypoint** | SQLite exige lock/mmap que o FUSE não garante. ~1,6 MB de banco + ~8,7 MB de fotos (< 2 s no cold start). |
| **IAP direto no Cloud Run** | GA, sem custo, sem load balancer. Público = `public_access = true`. |
| **`content/editorial/` na imagem** | Conteúdo versionado no repositório, não dado do TSE. |
| **Sem dependências npm novas** | Upload via `gcloud storage` + `node:child_process` (padrão do Node). |

# Fluxo de dados

```
máquina local                         GCP
─────────────                         ───
npm run ingest / sync:*        PUT    GCS bucket (privado)
npm run publish:data ──────────────►  ├ tse.db
  (gcloud storage)                    ├ manifest.json
                                      └ photos/**
                                           │
                                           │ volume mount FUSE gen2
                                           ▼
                                     Cloud Run (1 serviço)
                                      entrypoint copia → $DATA_DIR
                                      node server/index.ts :8080
                                        ├ /api/*   (SQLite)
                                        ├ /photos/*
                                        └ /*       (dist/ SPA)
                                           ▲
                                     IAP (fase privada)
                                     allow-list de e-mails
```

# Por que não usar Cloud Storage FUSE direto no SQLite

O runtime **não** abre o banco no FUSE. O entrypoint
`docker-entrypoint.sh` copia `tse.db` (+ `photos/` + `manifest.json`) de
`/mnt/tse-data` para `$DATA_DIR` antes de subir o Node. Razões:

1. SQLite depende de semântica de lock e mmap que o FUSE gen2 do Cloud Run não garante de forma confiável.
2. O volume do bucket é **read-only** — cópia explícita torna o estado do container imutável e previsível.
3. O custo de cópia (~10 MB) é irrelevante frente ao cold start do FUSE.

# Separação de responsabilidades

| Artefato | Onde vive | Como atualiza |
|---|---|---|
| `tse.db`, `photos/`, `manifest.json` | Bucket GCS | `npm run publish:data` (+ `--reload`) |
| `content/editorial/` | Imagem Docker | Build + deploy de imagem |
| `dist/` (SPA) | Imagem Docker | Build + deploy de imagem |
| IAM / IAP / scaling | Terraform (`infra/`) | `terraform apply` |

# Fontes

[^plan-deploy]: Plano de deploy — teste-voto na Google Cloud
[^agente-convencao]: Guia mínimo para agentes (AGENTS.md)
