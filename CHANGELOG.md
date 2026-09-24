# Changelog

Todas as mudanças notáveis deste projeto são documentadas neste arquivo.

O formato segue o [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) e o
projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Não lançado]

### Adicionado

- Página com a lista de todos os candidatos e suas informações (foto, nome e
  descrição), acessível pela tela inicial.
- Ao clicar em um candidato no resultado, detalhamento pergunta a pergunta: a
  resposta da pessoa, a resposta prevista pelo perfil do candidato e a
  indicação de Concorda (elemento nativo `<details>`).
- Pipeline de ingestão dos dados oficiais do TSE (`npm run ingest`): download,
  extração, parse do CSV (latin1, aspas, separador), validação de schema e de
  registro, normalização e atualização incremental no SQLite local, com
  proveniência por candidato e histórico em `sync_log`.
  - Modo `--inspect` documenta o schema real do arquivo baixado em
    `docs/tse-schema.md`; `--force` rebaixa os arquivos.
  - Fotos oficiais como dataset opcional (`src/data-sources/tse/images.ts`).
  - Stubs tipados para bens, redes sociais e histórico (`assets`, `social`,
    `history`), a serem preenchidos nas próximas rodadas.
- Camada de configuração de eleições (`src/shared/elections.ts`,
  `ElectionConfig`) com a eleição atual 2026 / PR / Deputado Federal e estrutura
  pronta para futuras eleições e outras UF/cargos.
- API HTTP própria (`server/index.ts`, porta 2027): `GET /api/health`,
  `GET /api/candidates`, `GET /api/candidates/:id` e fotos estáticas em
  `/photos/*`, com proxy do Vite para `/api` e `/photos`.
- A lista de candidatos agora consome a API local e exibe os candidatos reais
  com foto, partido, coligação, situação, município e nota de fonte ("dados
  abertos do TSE"), com estados de carregamento, erro e vazio.
- `npm run dev` inicia app + API juntos; novos scripts `api`, `test`, `ingest`;
  testes com `node:test` para o parser CSV, a normalização e o repositório.
- Backend usando apenas o padrão do Node (zero dependências novas): `node:sqlite`,
  `node:http`, `node:test`.
- Documentação do schema do TSE (`docs/tse-schema.md`) e exemplo de variáveis
  de ambiente (`.env.example`).

## [0.1.0] - 2026-09-23

### Adicionado

- Fluxo do quiz: tela inicial, perguntas sequenciais com foto por opção de
  resposta, tela de resultado e reinício.
- Resultado como ranking completo dos candidatos, da melhor para a pior
  compatibilidade, com destaque nativo para o primeiro colocado
  ("Melhor compatibilidade").
- Modelo de pontuação por compatibilidade de perfil, com desempate
  determinístico e falha graciosa caso o resultado não possa ser calculado.
- Auditoria de imparcialidade: tela "Verificar imparcialidade" no app e um
  script de CLI que enumeram todas as 3⁵ = 243 combinações de respostas e
  reportam as vitórias por candidato.
- Conteúdo provisório em português (15 candidatos, 5 perguntas, 3 opções cada)
  com fotos determinísticas de apoio.
- Kit open source: licença MIT, guia de contribuição com padrões de commit,
  código de conduta, changelog e modelos de issue/pull request — tudo em
  português.
- Servidor de desenvolvimento e preview na porta 2026; atalho `npm start`
  para `npm run dev`.

[Não lançado]: https://github.com/anaraujo/teste-voto