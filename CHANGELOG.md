# Changelog

Todas as mudanças notáveis deste projeto são documentadas neste arquivo.

O formato segue o [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) e o
projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Não lançado]

### Adicionado

- Ao clicar em um candidato no resultado, detalhamento pergunta a pergunta: a
  resposta da pessoa, a resposta prevista pelo perfil do candidato e a
  indicação de Concorda (elemento nativo `<details>`).

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