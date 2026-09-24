# teste-voto

Um quiz imparcial para ajudar os moradores do condomínio a descobrir qual
candidato combina melhor com seus ideais, valores e prioridades.

[![Licença: MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-blue)](LICENSE)
[![React](https://img.shields.io/badge/react-19-blue?logo=react&logoColor=61DAFB)](https://react.dev)
[![Vite](https://img.shields.io/badge/vite-8-646CFF?logo=vite&logoColor=646CFF)](https://vite.dev)
[![TypeScript](https://img.shields.io/badge/typescript-6-3178C6?logo=typescript&logoColor=3178C6)](https://www.typescriptlang.org)

---

## O que é isto?

Um aplicativo web no espírito de um quiz clássico: poucas perguntas curtas,
respostas curtas e um resultado no final. Ele responde a uma pergunta para o
prédio inteiro: **"Em quem eu voto?"**

Cada candidato é descrito por um *perfil* — as respostas que ele daria a cada
pergunta. Você responde o quiz e recebe um **ranking de todos os candidatos**,
da melhor correspondência para a pior.

## Como funciona

```
┌────────┐   ┌──────────────────────────┐   ┌──────────────────────────────┐
│  Início │──▶│ 5 perguntas × 3 opções  │──▶│ Resultado: ranking dos       │
└────────┘   └──────────────────────────┘   │ candidatos (1º destacado)    │
                                            └────────────────┬─────────────┘
                                                             │
                                ┌────────────────────────────┤
                                ▼                            ▼
                    ┌─────────────────────────┐   ┌──────────────────────┐
                    │ "Verificar imparcialidade│   │ "Recomeçar"          │
                    └─────────────────────────┘   └──────────────────────┘
```

O quiz é **imparcial por construção**. Com 5 perguntas e 3 opções existem
3⁵ = 243 combinações possíveis de respostas, e a pontuação é desenhada para
que, em média, cada um dos 15 candidatos vença uma parte delas. Qualquer
pessoa pode auditar isso a partir do resultado, pela tela
**"Verificar imparcialidade"**, que mostra a distribuição de vitórias entre
todas as 243 combinações.

Para um mergulho mais profundo, veja [docs/how-it-works.md](docs/how-it-works.md).

## Começando

**Pré-requisitos:** [Node.js](https://nodejs.org) 22 ou mais novo (usa o
type-stripping nativo do TypeScript no verificador de imparcialidade, sem
ferramentas extras).

```sh
npm install   # instala as dependências
npm start     # inicia o servidor de desenvolvimento → http://localhost:2026
```

### Scripts

| Comando                     | O que faz                                           |
| --------------------------- | --------------------------------------------------- |
| `npm run dev` / `npm start` | Inicia o servidor de desenvolvimento na porta 2026  |
| `npm run build`             | Checa os tipos e gera o build de produção em `dist/`|
| `npm run preview`           | Visualiza o build de produção na porta 2026         |
| `npm run lint`              | Executa o lint com Oxlint                           |
| `npm run check:distribution`| Audita a imparcialidade em todas as 243 combinações |

## Estrutura do projeto

```
src/
├── data/quiz.ts             Tipos + conteúdo do quiz (perguntas, candidatos)
├── lib/scoring.ts           Pontuação por correspondência de perfil (ranking)
├── lib/distribution.ts      Auditoria de imparcialidade sobre todas as combinações
├── components/
│   ├── StartScreen.tsx      Tela de boas-vindas
│   ├── QuestionStep.tsx     Uma pergunta, suas opções e o progresso
│   ├── ResultScreen.tsx     Ranking de todos os candidatos, 1º destacado
│   └── FairnessScreen.tsx   Auditoria de distribuição imparcial
└── App.tsx                  Máquina de estados das telas
scripts/check-distribution.ts  Auditoria de imparcialidade via CLI
docs/                        Guias de arquitetura e de criação de conteúdo
```

## Criando conteúdo

O conteúdo do quiz vive inteiramente em
[`src/data/quiz.ts`](src/data/quiz.ts): perguntas, opções de resposta, perfis
dos candidatos e fotos de apoio. Um guia passo a passo está em
[docs/authoring-content.md](docs/authoring-content.md).

## Contribuindo

Contribuições são bem-vindas. Leia primeiro o
[CONTRIBUTING.md](CONTRIBUTING.md) e o
[Código de Conduta](CODE_OF_CONDUCT.md). Este projeto valoriza a leveza:
componentes nativos, estilos padrão e nenhuma dependência nova sem uma
conversa antes.

## Licença

[MIT](LICENSE) © 2026 Ana Laura de Araujo