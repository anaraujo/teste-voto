# Mapa de arquivos do deploy

Inventário dos artefatos criados ou alterados na implementação de
`PLAN-DEPLOY.md` — scripts, servidor, Docker, Terraform e configuração.

## Novos

| Arquivo | Papel |
|---|---|
| `scripts/publish-data.ts` | Publica `tse.db` + `manifest.json` + `photos/` no GCS |
| `Dockerfile` | Multi-stage: build Vite + runtime stdlib |
| `docker-entrypoint.sh` | Copia `/mnt/tse-data` → `$DATA_DIR` e sobe o Node |
| `.dockerignore` | Mantém dados brutos e estado fora do build |
| `infra/versions.tf` | Terraform >= 1.6, provider google ~> 6.x |
| `infra/variables.tf` | Variáveis do módulo |
| `infra/main.tf` | `data.google_project` + ativação das APIs |
| `infra/storage.tf` | Bucket privado + SA do runtime + budget |
| `infra/registry.tf` | Artifact Registry + cleanup KEEP 3 |
| `infra/run.tf` | Cloud Run + IAP + allow-list/allUsers |
| `infra/outputs.tf` | URL, bucket, comandos prontos |
| `infra/terraform.tfvars.example` | Exemplo de configuração |
| `okf/` | Bundle OKF v0.2 (este diretório) |

## Alterados

| Arquivo | Mudança |
|---|---|
| `server/index.ts` | `SERVE_STATIC` + SPA fallback em `dist/`; API/fotos inalterados |
| `package.json` | Script `publish:data` |
| `.env.example` | `GCS_BUCKET`, `CLOUD_RUN_*`, `SERVE_STATIC`, `DATA_DIR` |
| `.gitignore` | `infra/.terraform/`, `*.tfstate*`, `terraform.tfvars` |
| `AGENTS.md` | Scripts novos, `infra/`, `okf/`, fluxo de deploy |
| `PLAN-DEPLOY.md` | Checklist da §8 marcado (okf/ documentado) |

## Detalhes por arquivo

* [publish-data.ts](/source-files/publish-data-script.md)
* [server/index.ts](/source-files/server-index.md)
* [Dockerfile e entrypoint](/source-files/docker-assets.md)
* [package.json](/source-files/package-json-script.md)

## Convenções preservadas

* Backend só com padrão do Node (`node:sqlite`, `node:http`, `node:child_process`).
* Imports relativos com extensão `.ts`.
* `data/` ancorado no `.gitignore` (`/data/`).
* Terraform sem `apply` automático — só arquivos.
