---
type: Playbook
title: Quiz com votações da Câmara
description: Como montar as perguntas fixas do quiz a partir do plenário da Câmara, com classificação local e curadoria humana.
tags: [operacao, quiz, camara, llm]
status: stable
generated:
  by: process:rich-quiz
  at: 2026-10-02T00:00:00Z
sources:
  - id: quiz-design
    resource: docs/quiz-design.md
    title: Desenho do quiz
    author: human:muri
  - id: pautas
    resource: content/quiz/pautas-quiz.json
    title: Pautas fixas do quiz
  - id: lineage
    resource: content/quiz/party-lineage.json
    title: Linhagem partidária
  - id: camara
    resource: https://dadosabertos.camara.leg.br/
    title: Dados Abertos da Câmara
---

# Sequência

| passo | comando | sai |
|---|---|---|
| Plenário 2019–2026 | `npm run sync:votacoes` | tabelas `plenary_*` em `tse.db`; CSV cru em `data/camara/` |
| Lista curta | `npm run rank:votacoes` | `data/quiz/shortlist.json` |
| Classificação | `npm run classify:votacoes` | `content/quiz/votacoes.draft.json` |
| Posições | `npm run build:quiz` | `quiz_positions` e `quiz_metrics` |
| Publicar | `npm run publish:data` | `tse.db` no GCS |

# LLM local

`classify:votacoes` exige `QUIZ_LLM_BASE_URL` apontando para um llama.cpp com
`POST /v1/chat/completions`. `QUIZ_LLM_API_KEY` e `QUIZ_LLM_MODEL` são
opcionais. O modelo só descreve a votação. Cache em `data/quiz/llm-cache/`.

A lista que o app usa é `content/quiz/pautas-quiz.json`, revisada por uma
pessoa. Trocar esse arquivo pede novo deploy, porque `content/` vai na imagem.
As posições derivadas vão no banco, com `publish:data`.
