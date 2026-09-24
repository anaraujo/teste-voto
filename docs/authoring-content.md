# Criando conteúdo para o quiz

Tudo que a pessoa vê vive em um único arquivo: `src/data/quiz.ts`. Este guia
explica como substituir os textos provisórios por perguntas e candidatos reais,
mantendo o teste justo.

## As três coisas que você escreve

1. **Perguntas** — um título e uma lista de opções. Mantenha-as curtas: um
   aceno ao formato clássico de quiz. Cada opção tem um rótulo curto e,
   opcionalmente, uma foto de apoio.

```ts
{
  id: 'q1',                    // mantenha os ids estáveis após o lançamento
  title: 'Qual é a sua prioridade?',
  options: [
    { id: 'a', label: 'Segurança', photo: photo('pergunta-1-seguranca') },
    { id: 'b', label: 'Áreas comuns', photo: photo('pergunta-1-areas') },
    { id: 'c', label: 'Custo', photo: photo('pergunta-1-custo') },
  ],
}
```

2. **Candidatos** — nome, descrição, foto opcional e o perfil.

3. **Perfis** — para cada candidato, a opção que ele escolheria em cada
   pergunta. É o conteúdo mais importante, porque determina tanto a qualidade
   do resultado quanto a imparcialidade do teste.

```ts
{
  id: 'c1',
  name: 'Maria da Silva',
  description: 'Focada em segurança e transparência.',
  photo: photo('candidato-maria'),
  profile: { q1: 'a', q2: 'c', q3: 'b', q4: 'a', q5: 'c' },
}
```

## Como o ranking é formado

Cada candidato é pontuado pelo número de respostas que coincide com o seu
perfil. O resultado lista todos os candidatos, do maior para o menor número de
correspondências, e o primeiro colocado ganha o destaque "Melhor compatibilidade".

Em caso de empate na pontuação, a ordem de declaração no array `candidates` é
mantida (ordenação estável). Isso é determinístico, mas lembre-se: perfis
idênticos nunca serão distinguíveis pelo teste — o empate favoreceria o
primeiro declarado em silêncio.

## Mantendo o teste justo

O contrato de imparcialidade: em todas as combinações possíveis de respostas,
nenhum candidato deve vencer de forma desproporcional. A auditoria conta
combinações, não pessoas reais — ela verifica que o próprio teste é
estruturalmente equilibrado.

Regras práticas ao construir perfis:

- **Dê a cada candidato um perfil distinto.** Dois perfis idênticos não podem
  ser distinguidos; o desempate favoreceria silenciosamente o primeiro.
- **Espalhe os perfis.** Pense em cada perfil como um ponto numa grade em que
  cada coordenada é uma de suas letras de opção. Quanto mais uniformemente os
  15 perfis cobrirem a grade, mais perto as vitórias ficam de
  243 ÷ 15 ≈ 16 cada.
- **Cuidado com favoritos em colisão.** Se todo candidato prefere a mesma opção
  na mesma pergunta, aquela pergunta tendencia o teste. Varie quem prefere o quê.
- **Itere com a auditoria.** Após qualquer edição, execute:

```sh
npm run check:distribution
```

  Busque fazer cada candidato chegar perto da proporção ideal. O mesmo
  resultado pode ser conferido visualmente no app: termine qualquer quiz e
  escolha **"Verificar imparcialidade"**.

### Um exemplo

Você mudou uma pergunta e agora `c1` vence 28 combinações. Isso significa que a
edição deixou o perfil de `c1` mais fácil de alcançar que os demais. Tente
afastar o perfil de `c1` do canto mais lotado da grade, ou aproximar um
candidato sub-representado dele, e rode a auditoria de novo.

## Listas de verificação

**Adicionando uma pergunta:**

- [ ] Leia como uma única ideia curta
- [ ] De 2 a 4 opções, todas mutuamente exclusivas
- [ ] Cada opção tem um rótulo e uma foto
- [ ] Seu id é novo e estável
- [ ] O perfil de todo candidato agora inclui essa pergunta
- [ ] `npm run check:distribution` continua equilibrado

**Adicionando um candidato:**

- [ ] Perfil distinto de todos os outros candidatos
- [ ] Nome, descrição e foto
- [ ] O perfil responde a todas as perguntas
- [ ] Distribuição continua equilibrada após nova auditoria

**Escolhendo fotos:**

- O app usa placeholders `picsum.photos/seed/<seed>`. Troque-os por imagens
  reais hospedadas em `public/` ou em um CDN depois; mantenha o campo `photo?`
  opcional para que o layout degrade com graça.