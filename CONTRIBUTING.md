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
- **Siga o design system.** As cores do app vêm dos tokens em
  `src/index.css` (Tailwind v4 `@theme`), não de hexes soltos no código. Cores
  novas vão primeiro para a página de tokens — veja
  `docs/design-tokens.md`. Existem dois botões com fronteiras explícitas:
  `SpecularButton` para CTA de destaque (WebGL) e `Button` para o resto.
- **Componha a partir do kit.** `src/components/ui/` tem os componentes
  básicos (button, card, badge, input, label, skeleton, progress, radio-group,
  sheet, tooltip, sonner). Antes de escrever um componente do zero, veja se o
  kit já resolve — e siga o formato dele ao adicionar.
- **Zero dependências desnecessárias.** Antes de adicionar uma biblioteca,
  pergunte: dá para fazer com o que já temos? Normalmente dá.

### Sobre o shadcn/ui

O kit segue o **formato** do shadcn/ui, com uma diferença que importa: os
componentes são **código deste repositório**, não um pacote. `npx shadcn@latest
add <nome>` copia o arquivo para `src/components/ui/` e a partir daí ele é seu —
editar o `button.tsx` é um commit normal aqui.

Isso é o que autoriza o kit dentro da regra de zero dependências: não há
dependência nova para justificar, só código que o time mantém.

Dois pontos de atenção:

- **Nunca rode `shadcn init`.** Ele reescreve o bloco `@theme` de
  `src/index.css`, que é a fonte única das cores. O `components.json` da raiz já
  está configurado — use apenas `add`.
- **Depois do `add`, revise as cores.** As classes precisam apontar para os
  tokens do projeto (`primary`, `secondary`, `tertiary`, `muted`, `border`,
  `ring`, `card`) e nunca para hex solto nem para a paleta neutra padrão do
  shadcn.

Detalhes em `docs/design-tokens.md`.

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
npm run format:check
npm run test      # parser CSV, normalização e repositório (node:test)
npm run build
npm run check:distribution
```

2. Rode `npm run format` antes de enviar para manter o padrão de aspas simples
   e sem ponto-e-vírgula (configurado no `.prettierrc.json`).

3. Confirme que sua mudança mantém a distribuição justa. Se você tocou em
   conteúdo ou em pontuação, a auditoria deve continuar mostrando cada
   candidato com vitórias aproximadamente iguais.
4. Se você mexeu no pipeline de dados, confirme que `npm run ingest` conclui e
   que `npm test` continua passando. O schema do TSE muda entre eleições —
   valide com `npm run ingest -- --inspect` quando o arquivo oficial mudar.
5. Mantenha a interface e a documentação em português (PT-BR). Código e nomes
   de identificadores permanecem em inglês.

## Enviando um pull request

- Faça um fork do repositório e crie uma branch nomeada pela mudança, por
  exemplo `adiciona-pergunta-sindico` ou `corrige-desempate`.
- Escreva um título claro e descreva o _porquê_, não só o _o quê_.
- Referencie qualquer issue relacionada.
- Use o [modelo de pull request](.github/pull_request_template.md).

## Padrões de commit

Use dois formatos, conforme a magnitude da mudança.

**Formato curto** — `tipo(escopo): resumo`. Para correções e ajustes pontuais.

```
fix(results): ajusta altura da foto no ranking
```

**Formato longo** — cabeçalho + corpo. Para mudanças que merecem registro:
explique o _o quê_ e o _porquê_, com ou sem itens. Uma boa mensagem longa é
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
