---
type: Playbook
title: Container e entrypoint do Cloud Run
description: Dockerfile multi-stage (build Vite + runtime stdlib), docker-entrypoint.sh copiando dados do FUSE para o disco local, e .dockerignore.
tags: [docker, container, cloud-run, entrypoint, spa]
status: stable
generated:
  by: process:opencode-plan-deploy
  at: 2026-09-30T12:00:00Z
sources:
  - id: plan-deploy
    resource: PLAN-DEPLOY.md
    title: Plano de deploy §4
    author: human:muri
  - id: dockerfile
    resource: Dockerfile
    title: Dockerfile multi-stage
  - id: entrypoint
    resource: docker-entrypoint.sh
    title: docker-entrypoint.sh
---

# Dockerfile (multi-stage)

## Stage `build`

* `node:22-alpine`
* `npm ci` + copia de `tsconfig*.json`, `vite.config.ts`, `index.html`, `src/`, `public/`
* `npm run build` → gera `dist/`

## Stage runtime

* `node:22-alpine` **sem `node_modules`** — o servidor é 100% stdlib (`node:http` + `node:sqlite` + type-stripping).
* Copia: `package.json`, `server/`, `src/`, `content/`, `dist/` (do stage build), `docker-entrypoint.sh`.
* ENV: `PORT=8080`, `SERVE_STATIC=true`, `DATA_DIR=/app/data`.
* `EXPOSE 8080` e `CMD ["./docker-entrypoint.sh"]`.

# Entrypoint

```sh
#!/bin/sh
set -eu
: "${DATA_DIR:=/app/data}"
mkdir -p "$DATA_DIR"
cp /mnt/tse-data/tse.db "$DATA_DIR/tse.db"
cp -r /mnt/tse-data/photos "$DATA_DIR/photos"
# manifest.json copiado se existir
exec node --experimental-sqlite --experimental-strip-types server/index.ts
```

Pontos:

* Falha cedo se `/mnt/tse-data/tse.db` não existir (bucket vazio).
* `photos/` é removido e recriado para evitar resíduos de deploys anteriores.
* `unzip` **não** é necessário no runtime (só a ingestão local usa).
* A execução usa os mesmos flags de dev (`--experimental-sqlite --experimental-strip-types`).

# SERVE_STATIC

Quando `SERVE_STATIC=true` (default no container):

* `/` → `dist/index.html`
* Arquivos estáticos de `dist/` (assets, CSS, JS) com MIME correto.
* Rotas desconhecidas sem arquivo correspondente → fallback SPA para `index.html`.
* `/api/*` e `/photos/*` têm precedência absoluta.

Em dev (`npm run dev`) a flag fica ausente: comportamento inalterado (Vite no proxy 2026 → API 2027).

# .dockerignore

Ignora `node_modules`, `data/`, `dist/`, `infra/`, `.git`, `okf/`, logs e `.env*`. Evita subir ~110 MB de zips brutos no contexto de build.

# Build e push (sem Docker local)

```sh
gcloud builds submit --tag <region>-docker.pkg.dev/<proj>/teste-voto/app:<tag> .
```

Cloud Build: 120 min/dia grátis; cada build ~3–5 min.

# Validação local

```sh
docker build -t teste-voto .
docker run -p 8080:8080 \
  -v /caminho/para/bucket:/mnt/tse-data:ro \
  -e DATA_DIR=/app/data \
  teste-voto
curl :8080/api/health
```

[^plan-deploy]: Plano de deploy §4
[^dockerfile]: Dockerfile
[^entrypoint]: docker-entrypoint.sh
