---
type: Reference
title: package.json — script publish:data
description: Registro do script npm que executa scripts/publish-data.ts com os flags de ingest e reload.
tags: [package.json, npm, script, publish]
status: stable
generated:
  by: process:opencode-plan-deploy
  at: 2026-09-30T12:00:00Z
sources:
  - id: pkg
    resource: package.json
    title: package.json
  - id: script-src
    resource: scripts/publish-data.ts
    title: scripts/publish-data.ts
---

# Script adicionado

```json
"publish:data": "node --experimental-sqlite --experimental-strip-types scripts/publish-data.ts"
```

Mesma forma dos demais scripts do backend (`ingest`, `sync:*`,
`export:ficha`): Node 22 com type-stripping e sqlite experimental.

# Uso

```sh
npm run publish:data
npm run publish:data -- --ingest
npm run publish:data -- --reload
npm run publish:data -- --ingest --reload
```

Os flags após `--` são repassados ao script (`process.argv.slice(2)`).

# Variáveis exigidas

* `GCS_BUCKET` — obrigatória (ver [.env.example](/source-files/index.md))
* Opcionais: `CLOUD_RUN_SERVICE`, `CLOUD_RUN_REGION` (só com `--reload`)

# Relacionados

* [publish-data.ts](/source-files/publish-data-script.md) — implementação
* [data-publishing.md](/deploy/data-publishing.md) — playbook

[^pkg]: package.json
[^script-src]: scripts/publish-data.ts
