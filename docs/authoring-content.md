# Criando conteúdo para o quiz

No modelo atual o conteúdo é **data-driven**: as perguntas vivem em
`src/data/quiz-source.ts` (tipos em `src/data/quiz.ts`) e os **perfis dos
candidatos são derivados dos dados oficiais do TSE**, nunca escritos à mão.
Este guia explica o que um mantenedor toca e como manter o teste justo.

## O que você edita

### 1. Perguntas e opções

Cada pergunta declara `id`, `title`, `hint` (proveniência mostrada no
resultado) e `options`. Os ids seguem o padrão `<dimensão>:<opção>` e devem
permanecer estáveis após o lançamento.

```ts
{
  id: 'sector',
  title: 'Que experiência profissional você quer em quem vai te representar?',
  hint: 'Derivado da ocupação declarada ao TSE.',
  options: [
    { id: 'setor:saude', label: 'Saúde' },
    { id: 'setor:educacao', label: 'Educação' },
    // …
  ],
  resolve: (source) => `setor:${resolveSector(source.occupation)}`,
}
```

### 2. Resolvedores (a parte mais sensível)

O campo `resolve(source)` converte o candidato do TSE em uma opção. As regras
moram em funções puras nomeadas (`resolveSector`, `resolveExperience`,
`resolveAgeBand`, `resolveCandidacy`, `resolveLocal`) para serem testadas.

Ao mexer num resolvedor:

- **Cubra os acentos.** O regex `\b` do JavaScript é ASCII e falha sozinho em
  palavras acentuadas ("MÉDICO"). Prefira casar por **prefixo dentro de
  palavra** (ex.: `\bMÉDICO`) e confirme com os testes.
- **Evite falsos positivos.** "APOSENTADO (EXCETO SERVIDOR PÚBLICO)" não deve
  cair em gestão pública — o regex de política exige
  `SERVIDOR PÚBLICO (CIVIL|ESTADUAL|FEDERAL|MUNICIPAL)`.
- **Há sempre um bucket reserva** (`outros`/`sem-mandato`); candidato não
  resolvível lança `QuizResolutionError` e seria detectado na ingestão do quiz.

### 3. Candidatos: nenhum código

Nada é editado por candidato. `toQuizCandidate` monta o perfil a partir do
registro oficial e a descrição vem de `partido · ocupação`. Se você quiser
exibir outra informação no ranking/card, ajuste `describeCandidate` (e a
proveniência), não o banco.

## Como o ranking é formado

Pontos = nº de coincidências entre suas respostas e o perfil (0–5). Ordenação:

1. pontos (maior primeiro);
2. **raridade do perfil** (perfis mais raros primeiro);
3. nome de urna (`localeCompare` pt-BR).

Perfis idênticos **nunca** serão distinguíveis pelo quiz; o desempate por
raridade favorece o perfil único. Ao adicionar uma pergunta, o número de
perfis distintos tende a crescer — ótimo para diferenciar.

## Mantendo o teste justo

O contrato: em todas as combinações possíveis de respostas
(10×3×4×2×2 = **480** atualmente), nenhum candidato deve vencer de forma
desproporcional. A auditoria conta combinações (não pessoas) — ela verifica se
o teste é estruturalmente equilibrado.

Regras práticas ao ajustar perguntas:

- **Cobertura de 5–50% por opção.** Se uma opção cai abaixo de ~3%, ela quase
  nunca é atingida e divide candidatos por acaso; se passa de 50%, ela domina
  e tende o teste. `check:distribution` avisa nas duas direções.
- **Espalhe os perfis.** Perfis derivados dos dados de verdade não podem ser
  "espalhados" à mão — mas você pode escolher _quais dimensões_ entrarão e
  como seus buckets cortam os dados (ex.: faixas etárias ou agremiação) para
  equilibrar a grade.
- **Não tema o "sem-mandato".** Nesta eleição 90,4% dos candidatos nunca tiveram
  mandato; a pergunta segue honesta (apenas menos informativa) e não tende o
  resultado. Documente o desvio em `docs/quiz-design.md`.
- **Rode a auditoria sempre:**

```sh
npm run check:distribution
```

O mesmo resultado pode ser conferido no app em **"Verificar imparcialidade"**
(terminando qualquer quiz).

## Testes

Rode depois de qualquer mudança em perguntas/resolvedores:

```sh
npm test          # inclui quiz-source.test.ts e scoring.test.ts
npm run lint
```

## Listas de verificação

**Adicionando uma pergunta:**

- [ ] Título curto, uma única ideia, mutuamente exclusivo com as demais
- [ ] De 2 a 10 opções, com ids `<dimensão>:<opção>` estáveis
- [ ] `resolve` puro + `hint` de proveniência honesta
- [ ] Todo candidato dos 428 resolve (nenhum `QuizResolutionError`)
- [ ] `check:distribution` equilibrado e sem avisos de cobertura < 3% (exceto documentado)
- [ ] Id adicionado aos testes de `quiz-source` e ao `docs/quiz-design.md`

**Ajustando um resolvedor:**

- [ ] Regex por prefixo (cuidado com acentos/falsos positivos)
- [ ] Testes unitários para os novos exemplos de `DS_OCUPACAO`
- [ ] `check:distribution` continua sem vitórias desproporcionais

**Escolhendo opções fora do padrão:**

- O app usa HTML nativo; opções ganham `img` e `label` opcionais — mantenha o
  layout degradando com graça quando a foto não existir.
