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
npm run sync:municipal-registry   # registro das 55 Câmaras (dado verificado)
npm run sync:municipal           # SAPL -> municipal_mandates + municipal_identities
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
- **Registry municipal é dado verificado à mão** (`municipal/registry.seed.ts`):
  nunca adivinhe URL de Câmara. O que não respondeu fica `apiBaseUrl: null` com
  nota explicando por quê, e `capabilities` toda falsa.
- **Nunca leia as Câmaras em paralelo.** `http.run()` respeita o limite de
  concorrência; `Promise.all` sobrelegs (uma câmara tem até 292) esgota o pool
  de conexões do Node e derruba a sincronização inteira com `fetch failed`.
- No `.gitignore`, `data/` deve ser ancorado na raiz (`/data/`) — nunca solto,
  ou ignora também `src/data/`.

## Não quebre

- `check:distribution` deve seguir sem vitórias desproporcionais (< ~5%).
- Proveniência: tudo carrega `source` (URL, dataset, arquivo, data) de um
  arquivo oficial (TSE/Câmara/Senado).
- Regra de ouro da ficha: o padrão é "não encontrei evidência suficiente";
  nunca deduzir posição de votos ou métricas por conta própria.
- **Vínculo municipal quase nunca é `confirmed`:** o SAPL não publica o
  `sq_candidato` do TSE. Sem ele, o melhor caso é `probable` (nome idêntico +
  município + período) e a ficha precisa dizer "provável". Nunca promova a
  `confirmed` sem esse identificador batendo nos dois lados.
- `tse_candidatos` prova **candidatura**; `municipal_mandates` prova **exercício
  do mandato**. São fatos diferentes, em tabelas diferentes, de propósito.