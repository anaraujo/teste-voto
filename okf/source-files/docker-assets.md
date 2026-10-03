---
type: Reference
title: Dockerfile e docker-entrypoint.sh
description: Build multi-stage (Vite + runtime stdlib) e bootstrap que copia dados do bucket montado antes de subir o Node.
tags: [docker, entrypoint, container, cloud-run]
status: stable
generated:
  by: process:opencode-plan-deploy
  at: 2026-09-30T12:00:00Z
sources:
  - id: dockerfile
    resource: Dockerfile
    title: Dockerfile
  - id: entrypoint
    resource: docker-entrypoint.sh
    title: docker-entrypoint.sh
  - id: dockerignore
    resource: .dockerignore
    title: .dockerignore
---

# Dockerfile

```
node:22-alpine (build)          node:22-alpine (runtime)
─────────────────────           ──────────────────────
npm ci                          package.json
copiar tsconfig/vite/src/public server/  src/  content/
npm run build → dist/           dist/ (do build)
                                docker-entrypoint.sh (chmod +x)
                                ENV PORT=8080 SERVE_STATIC=true DATA_DIR=/app/data
                                EXPOSE 8080
                                CMD ./docker-entrypoint.sh
```

Runtime **sem `node_modules`**: servidor 100% stdlib.

# docker-entrypoint.sh

```sh
#!/bin/sh
set -eu
: "${DATA_DIR:=/app/data}"
mkdir -p "$DATA_DIR"
# falha se o bucket estiver vazio
cp /mnt/tse-data/tse.db "$DATA_DIR/tse.db"
rm -rf "$DATA_DIR/photos"
cp -r /mnt/tse-data/photos "$DATA_DIR/photos"
cp /mnt/tse-data/manifest.json "$DATA_DIR/manifest.json"  # se existir
exec node --experimental-sqlite --experimental-strip-types server/index.ts
```

Por que copiar em vez de ler do FUSE:

1. SQLite precisa de lock/mmap que o FUSE não garante.
2. Volume é read-only — cópia torna o estado do container previsível.
3. ~10 MB em < 2 s; cold start total ~2–4 s aceitável.

# .dockerignore

`node_modules`, `data/`, `dist/`, `infra/`, `.git`, `.github`, `okf/`,
logs, `.env*` (exceto example), tfstate/tfvars. Impede subir zips brutos
(~110 MB) no contexto de build.

# Build

```sh
docker build -t teste-voto .
# ou via Cloud Build (franquia 120 min/dia)
gcloud builds submit --tag <region>-docker.pkg.dev/<proj>/teste-voto/app:<tag> .
```

# Validação

Monte um diretório em `/mnt/tse-data` com `tse.db` e `photos/` e rode o
container; confira `/api/health`, `/api/candidates`, `/` e `/photos/…`.
Ver [go-live checklist](/operations/go-live-checklist.md).

# Relacionados

* [container.md](/deploy/container.md) — playbook completo
* [server-index.md](/source-files/server-index.md) — comportamento do servidor

[^dockerfile]: Dockerfile
[^entrypoint]: docker-entrypoint.sh
[^dockerignore]: .dockerignore
