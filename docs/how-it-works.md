# Como o teste-voto funciona

Um passeio pela arquitetura, pelo modelo de dados e pelo modelo de pontuação —
escrito para que uma pessoa recém-chegada consiga guardar o projeto inteiro na
cabeça em uma única leitura.

## Princípios

O projeto valoriza a leveza acima de tudo:

- Elementos HTML nativos com seu estilo padrão. Sem framework de CSS, sem
  biblioteca de componentes. Uma passada de estilização virá depois.
- Nenhuma dependência desnecessária. Toda dependência precisa conquistar seu
  lugar em uma conversa primeiro.
- Módulos pequenos e focados, cada um com uma única responsabilidade.
- A lógica é pura e os dados são declarativos, para que o aplicativo possa ser
  auditado, estendido e testado sem cerimônia.

## Estrutura do projeto

```
src/
├── data/quiz.ts             Conteúdo declarativo: perguntas + candidatos
├── lib/scoring.ts           Pontuação pura: ranking de candidatos
├── lib/distribution.ts      Auditoria pura de imparcialidade sobre as combinações
├── components/              Um componente por tela
│   ├── StartScreen.tsx      Boas-vindas
│   ├── CandidatesScreen.tsx Lista de candidatos e suas informações
│   ├── QuestionStep.tsx     Uma pergunta e suas opções
│   ├── ResultScreen.tsx     Ranking completo dos candidatos
│   └── FairnessScreen.tsx   Auditoria de imparcialidade
└── App.tsx                  A máquina de estados das telas
scripts/check-distribution.ts  Auditoria de imparcialidade via CLI (type-stripping do Node 22)
```

## Modelo de dados

Tudo que a pessoa vê é conteúdo declarativo em `src/data/quiz.ts`.

```
Pergunta
├── id       ex.: "q1"
├── title    ex.: "Pergunta 1"
└── options  Option[]

Opção
├── id       ex.: "a" | "b" | "c"
├── label    texto curto da resposta
└── photo?   foto de apoio (opcional)

Candidato
├── id           ex.: "c1"
├── name         ex.: "Candidato 1"
├── description  exibida na tela de resultado
├── photo?       foto do resultado (opcional)
└── profile      Record<QuestionId, OptionId>  ← as respostas que este candidato daria
```

O `profile` é o coração do modelo: é um gabarito completo de respostas, um id
de opção por pergunta. O aplicativo nunca precisa saber *por que* um candidato
combina com uma resposta — apenas que combina.

## O fluxo

`App.tsx` é uma máquina de estados pequena, com cinco telas.

```
início ──▶ candidatos ──┐
   │                    │
   ▼                    ▼
pergunta(0) ──▶ … ──▶ resultado ──▶ imparcialidade
   ▲                             │
   └──────────── reinício ◀──────┘
```

- A tela inicial pode levar direto à lista de **candidatos** (foto, nome e
  descrição) ou ao quiz.
- As respostas acumulam em um `Record<QuestionId, OptionId>`.
- Escolher uma opção registra a resposta e avança para a próxima pergunta — ou
  para a tela de resultado, após a última.
- A tela de resultado oferece duas saídas: reiniciar ou auditar a
  imparcialidade.

## O modelo de pontuação

Cada candidato tem um perfil. Após a última pergunta, todos os candidatos são
pontuados contando quantas respostas da pessoa coincidem com o perfil do
candidato.

```
pontuação(candidato) = número de perguntas em que
                       respostas[pergunta.id] === candidato.perfil[pergunta.id]
```

`rankResults` pondera todos os candidatos e ordena do maior para o menor número
de compatibilidades. Os empates são resolvidos de forma determinística: entre
candidatos com a mesma pontuação, vale a ordem de declaração no array
(`sort` estável). Assim, um mesmo conjunto de respostas sempre produz o mesmo
ranking, sem ambiguidade.

A tela de resultado exibe o ranking completo, com o primeiro colocado marcado
como **"Melhor compatibilidade"** (elemento `<mark>` nativo nessa posição).
Cada candidato pode ser expandido com o elemento nativo `<details>` para
revelar o detalhamento pergunta a pergunta: o que a pessoa respondeu, o que o
perfil do candidato previa e se houve correspondência (`questionMatches` em
`src/lib/scoring.ts`).

### Falha graciosa

O `computeResult` retorna `RankedEntry | null`. O único cenário em que é `null`
é quando a lista de candidatos está vazia. Nesse caso a tela de resultado mostra
uma mensagem de erro amigável e um botão **"Tentar novamente"** que recarrega a
página — sem exception para a pessoa ver.

### Por que um teste imparcial, e não um teste manipulado

Com 5 perguntas × 3 opções existem 3⁵ = 243 combinações possíveis de respostas.
`src/lib/distribution.ts` enumera cada uma delas e roda a mesma pontuação,
contabilizando quantas vezes cada candidato vence. Um quiz perfeito dividiria
as 243 combinações igualmente: 243 ÷ 15 ≈ 16 vitórias por candidato
(≈ 6,7% cada).

Essa auditoria é exposta em dois lugares:

1. **A tela "Verificar imparcialidade"** no app
   (`FairnessScreen.tsx`), acessível a partir de qualquer resultado — para que
   os eleitores possam verificar, dentro do próprio teste, que ele foi justo.
2. **`npm run check:distribution`**, um wrapper de CLI que imprime os mesmos
   números no terminal, para iteração rápida enquanto se escreve o conteúdo.

Como ambos consomem a mesma função pura
`computeDistribution(questions, candidates)`, o app e a CLI nunca podem
discordar.

## As decisões de projeto definitivas

| Decisão                | Por quê                                                              |
| ---------------------- | -------------------------------------------------------------------- |
| Compatibilidade de perfil | Simples de entender e explicar ("você concordou em 4 de 5 perguntas"). |
| Desempate determinístico | Todo conjunto de respostas precisa produzir um resultado inequívoco. |
| Resultado como ranking | Transparência: a pessoa vê o grau de alinhamento de todos os candidatos. |
| Módulos de lógica pura | A pontuação e a auditoria são livres de framework, testáveis e reutilizáveis pela CLI. |
| Conteúdo declarativo   | Perguntas/candidatos são dados, não código — o mantenedor edita um único arquivo. |
| Porta 2026             | O padrão do projeto; definida uma vez em `vite.config.ts`.           |
| Sem estilização        | Uma passada futura estilizará os mesmos componentes nativos.         |

## Convenções

- Componentes recebem props e renderizam; fora `App.tsx`, nenhuma tela guarda
  estado local.
- Use extensões explícitas `.ts` / `.tsx` nos imports relativos, para que os
  mesmos módulos rodem no Vite e no type-stripping do Node (CLI).
- Conteúdo da interface e documentação em português (PT-BR); código e
  comentários em inglês.