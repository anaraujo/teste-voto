# AGENTS.md

Guia mínimo para agentes (IA) no teste-voto. Arquitetura completa em
`docs/how-it-works.md`; desenho do quiz em `docs/quiz-design.md`; ficha em
`docs/ficha-comparavel.md`. Deploy GCP em `PLAN-DEPLOY.md` e bundle de
conhecimento em `okf/` (Open Knowledge Format v0.2).

## Stack e comandos

Node 22+ (type-stripping nativo + `node:sqlite`), binário `unzip` do sistema.
Backend só com o padrão do Node — sem dependências novas sem conversa.

```sh
npm run dev                     # app (2026) + API (2027)
npm run ingest                  # dados do TSE -> data/tse.db (SQLite)
npm run sync:incumbents         # deputados federais em exercício (Câmara)
npm run sync:parliament         # histórico parlamentar (Câmara/Senado)
npm run sync:history            # histórico de posições (TSE)
npm run sync:incumbents | sync:parliament | sync:history
npm run publish:data            # tse.db + manifest + photos -> GCS (--ingest | --reload)
npm test                        # node:test
npm run lint                    # oxlint
npm run build                   # tsc -b && vite build + build:ssr + build:pages
npm run check:distribution      # auditoria de imparcialidade (480 combinações)
```

## Convenções

- Documentação e interface em PT-BR; código em inglês e comentários em PT-BR.
- Imports relativos com extensão explícita (`.ts`/`.tsx`).
- O quiz é **data-driven**: conteúdo em `src/data/quiz-source.ts` (resolvedores
  puros sobre dados oficiais do TSE). Nunca escreva perfis à mão.
- `src/data-sources/` é só do servidor (fica fora de `tsconfig.app.json`).
- No `.gitignore`, `data/` deve ser ancorado na raiz (`/data/`) — nunca solto,
  ou ignora também `src/data/`.
- Terraform em `infra/`: estado local, `terraform.tfvars` gitignored; nunca
  rode `terraform apply` sem o dono do projeto pedir.
- Documentação de deploy e operação: bundle OKF em `okf/` (frontmatter com
  `type`, `sources` de arquivos oficiais, links absolutos com `/…`).

## Deploy (resumo)

- Dados no GCS (`publish:data`), fora da imagem; `content/editorial/` vai
  dentro da imagem (mudança editorial = novo deploy).
- Um único Cloud Run serve app (`SERVE_STATIC=true`), API e fotos.
- Bucket montado em `/mnt/tse-data`; o entrypoint copia para `DATA_DIR` antes
  de subir o Node (SQLite não é seguro no FUSE).
- Fase privada: IAP + `allowed_emails`; pública: `public_access = true`.

## Não quebre

- `check:distribution` deve seguir sem vitórias desproporcionais (< ~5%).
- Proveniência: tudo carrega `source` (URL, dataset, arquivo, data) de um
  arquivo oficial (TSE/Câmara/Senado).
- Regra de ouro da ficha: o padrão é "não encontrei evidência suficiente";
  nunca deduzir posição de votos ou métricas por conta própria.
- Nunca subir `data/download/` nem `data/camara/` ao bucket; só o que o
  runtime lê (`tse.db`, `manifest.json`, `photos/`).
