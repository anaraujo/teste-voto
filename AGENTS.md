# AGENTS.md

Guia mínimo para agentes (IA) no teste-voto. Arquitetura completa em
`docs/how-it-works.md`; desenho do quiz em `docs/quiz-design.md`; ficha em
`docs/ficha-comparavel.md`.

## Stack e comandos

Node 22+ (type-stripping nativo + `node:sqlite`), binário `unzip` do sistema.
Backend só com o padrão do Node — sem dependências novas sem conversa.

```sh
npm run dev                     # app (2026) + API (2027)
npm run ingest                  # dados do TSE -> data/tse.db (SQLite)
npm run sync:incumbents | sync:parliament | sync:history
npm test                        # node:test
npm run lint                    # oxlint
npm run build                   # tsc -b && vite build
npm run check:distribution      # auditoria de imparcialidade (480 combinações)
```

## Convenções

- Documentação e interface em PT-BR; código e comentários em inglês.
- Imports relativos com extensão explícita (`.ts`/`.tsx`).
- O quiz é **data-driven**: conteúdo em `src/data/quiz-source.ts` (resolvedores
  puros sobre dados oficiais do TSE). Nunca escreva perfis à mão.
- `src/data-sources/` é só do servidor (fica fora de `tsconfig.app.json`).
- No `.gitignore`, `data/` deve ser ancorado na raiz (`/data/`) — nunca solto,
  ou ignora também `src/data/`.

## Não quebre

- `check:distribution` deve seguir sem vitórias desproporcionais (< ~5%).
- Proveniência: tudo carrega `source` (URL, dataset, arquivo, data) de um
  arquivo oficial (TSE/Câmara/Senado).
- Regra de ouro da ficha: o padrão é "não encontrei evidência suficiente";
  nunca deduzir posição de votos ou métricas por conta própria.