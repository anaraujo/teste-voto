---
type: Reference
title: server/index.ts — API + SPA
description: Servidor node:http que serve /api/*, /photos/* e, com SERVE_STATIC=true, a SPA em dist/ com fallback para index.html.
tags: [server, api, spa, static, serve-static]
status: stable
generated:
  by: process:opencode-plan-deploy
  at: 2026-09-30T12:00:00Z
sources:
  - id: server-src
    resource: server/index.ts
    title: server/index.ts
  - id: plan-deploy
    resource: PLAN-DEPLOY.md
    title: Plano de deploy §4
    author: human:muri
---

# Caminho

`server/index.ts` — único processo no container.

# Endpoints

| Rota | Comportamento |
|---|---|
| `GET /api/health` | `{ status, election }` |
| `GET /api/candidates` | Lista da eleição configurada |
| `GET /api/candidates/:id` | Detalhe + parlamentar + editorial |
| `GET /photos/*` | Fotos de `DATA_DIR/photos` (path-safe) |
| `GET /*` | Só se `SERVE_STATIC=true` → `dist/` + SPA fallback |

# Variáveis

| Variável | Default | Papel |
|---|---|---|
| `PORT` | `2027` (dev) / `8080` (container) | Porta HTTP |
| `DATA_DIR` | `data` | Raiz do SQLite e fotos |
| `SERVE_STATIC` | ausente (dev) | `true` serve `dist/` |

`DIST_DIR` é resolvido relativo ao arquivo do servidor
(`../dist`), robusto no container (`/app/dist`) e em dev local.

# SERVE_STATIC (produção)

Implementado em `serveStatic()`:

1. `/` → `dist/index.html` (ou 404 se não houver build).
2. Caminho relativo validado contra path traversal (`isUnsafeRelative`).
3. Se o arquivo existe em `dist/`, serve com MIME de `STATIC_TYPES`.
4. Senão, fallback SPA para `index.html`.
5. `/api/*` e `/photos/*` têm precedência — nunca caem no fallback.

# Dev inalterado

Sem `SERVE_STATIC`, rotas fora de `/api/` e `/photos/` retornam 404 da
API; o Vite (porta 2026) continua servindo o app com proxy.

# Segurança

* Validação de `..` em `/photos/` e em estáticos.
* `cache-control` para fotos (`max-age=86400`) e estáticos (`3600`).
* CORS `*` mantido nas respostas JSON (mesmo comportamento atual; em
  produção o Cloud Run é same-origin, então é redundante e inofensivo).

[^server-src]: server/index.ts
[^plan-deploy]: Plano de deploy §4
