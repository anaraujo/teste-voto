# Contribuindo para o teste-voto

Obrigado por considerar contribuir. Este projeto é pequeno de propósito: cada
linha de código deve justificar sua existência. Este guia explica como
trabalhar com o código e como mantê-lo assim.

## Orientações para um bom começo

- **Leia a documentação primeiro.** [docs/how-it-works.md](docs/how-it-works.md)
  explica a arquitetura e o modelo de pontuação.
- **Converse antes de construir.** Se uma mudança adiciona uma dependência,
  altera o algoritmo de pontuação ou muda o fluxo do usuário, abra uma issue
  primeiro. O mantenedor quer opinar.
- **Contribuições pequenas e focadas.** Um pull request que faz bem uma coisa é
  mais fácil de revisar, mesclar e aprender com ele.
- **Estilos padrão, sempre.** O projeto usa deliberadamente elementos HTML
  nativos com o estilo padrão. A passada de estilização está planejada; não
  adicione CSS específico durante o trabalho de funcionalidades.
- **Zero dependências desnecessárias.** Antes de adicionar uma biblioteca,
  pergunte: dá para fazer com o que já temos? Normalmente dá.

## Configuração

```sh
npm install
npm run ingest   # carrega os dados oficiais do TSE no SQLite (opcional nesta etapa)
npm run dev      # http://localhost:2026 (app) + API na 2027
```

## O que verificar antes de enviar

1. Rode as verificações:

```sh
npm run lint
npm run test      # parser CSV, normalização e repositório (node:test)
npm run build
npm run check:distribution
```

2. Confirme que sua mudança mantém a distribuição justa. Se você tocou em
   conteúdo ou em pontuação, a auditoria deve continuar mostrando cada
   candidato com vitórias aproximadamente iguais.
3. Se você mexeu no pipeline de dados, confirme que `npm run ingest` conclui e
   que `npm test` continua passando. O schema do TSE muda entre eleições —
   valide com `npm run ingest -- --inspect` quando o arquivo oficial mudar.
4. Mantenha a interface e a documentação em português (PT-BR). Código e nomes
   de identificadores permanecem em inglês.

## Enviando um pull request

- Faça um fork do repositório e crie uma branch nomeada pela mudança, por
  exemplo `adiciona-pergunta-sindico` ou `corrige-desempate`.
- Escreva um título claro e descreva o *porquê*, não só o *o quê*.
- Referencie qualquer issue relacionada.
- Use o [modelo de pull request](.github/pull_request_template.md).

## Padrões de commit

Use dois formatos, conforme a magnitude da mudança.

**Formato curto** — `tipo(escopo): resumo`. Para correções e ajustes pontuais.

```
fix(results): ajusta altura da foto no ranking
```

**Formato longo** — cabeçalho + corpo. Para mudanças que merecem registro:
explique o *o quê* e o *porquê*, com ou sem itens. Uma boa mensagem longa é
parte da documentação do projeto.

```
feat(results): adiciona ranking completo de candidatos

O resultado agora lista todos os candidatos, da melhor para a pior
compatibilidade, com destaque para o primeiro colocado.

- Pontua cada candidato pelo número de respostas iguais ao perfil
- Ordena de forma decrescente com desempate determinístico
- Marca o primeiro colocado com "Melhor compatibilidade"
```

Tipos convencionais (mantidos em inglês): `feat`, `fix`, `docs`, `refactor`,
`chore`, `test`, `perf`, entre outros.

## Reportando problemas

Use os modelos de issue para [bugs](.github/ISSUE_TEMPLATE/bug_report.md) e
[pedidos de funcionalidade](.github/ISSUE_TEMPLATE/feature_request.md). Um bom
relatório explica como reproduzir o problema e inclui a saída relevante.

## Código de conduta

Toda pessoa que participa deste projeto deve seguir o
[Código de Conduta](CODE_OF_CONDUCT.md). Seja gentil, presuma boa-fé e
contribua para um espaço acolhedor.