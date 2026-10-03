# Desenho do quiz (data-driven)

Este documento registra como o quiz foi desenhado e, principalmente, **as
decisões** tomadas para que ele seja justo, auditável e derivado 100% de dados
oficiais do TSE — nunca de opinião.

## Escopo (decisão)

O quiz responde sobre **2026 · Deputado Federal**, uma UF por vez. A pessoa
escolhe o estado no mapa (`/`) e, dali em diante, lista, perguntas,
resultado e imparcialidade ficam em `/estados/:uf/...`. O recorte é
`SG_UF` da UF escolhida, `DS_CARGO=DEPUTADO FEDERAL`, `ANO_ELEICAO=2026`,
`is_active=1`. Outros cargos do mesmo arquivo ficam de fora.

A pergunta de nascimento usa o nome da UF (`nascido no Paraná`, `em São Paulo`,
`na Bahia`). A opção `local:aqui` é quem nasceu na UF da eleição; `local:fora`
é quem nasceu em outra.

Proveniência da regra: a ingestão percorre as 27 UFs (`electionFor` em
`src/shared/elections.ts`); o quiz consome a lista da UF da rota.

## Perguntas atuais

O quiz mistura perguntas de perfil (TSE e duas métricas numéricas) com
perguntas de votação. As de votação são fixas: a lista vive em
`content/quiz/pautas-quiz.json` e só muda com revisão humana e novo deploy,
porque `content/` vai dentro da imagem.

Cada pergunta de votação oferece Concordo, Discordo e Tanto faz. "Tanto faz"
não entra na conta. O eleitor pode marcar a resposta como mais importante
(peso 2). Concordo casa com voto ou orientação Sim; Discordo casa com Não.

Quando o candidato tem voto nominal Sim ou Não, a pergunta usa esse voto.
Abstenção e obstrução não viram Sim nem Não e também não caem para o partido.
Sem voto nominal, usa a orientação oficial da bancada do partido ou da
federação naquela data. Sem os dois, a pergunta fica sem dado e não conta
como divergência.

A linhagem partidária (fusão, renomeação, incorporação) está em
`content/quiz/party-lineage.json`, cada item com fonte do TSE. Antecessores
de uma fusão só valem se todos tiverem o mesmo lado. Incorporação não
empresta o voto de quem foi incorporado.

### Como uma votação entra na lista

1. `npm run sync:votacoes` baixa os CSVs anuais da Câmara (2019–2026) para
   `data/camara/` (não vai ao bucket) e grava só o plenário.
2. `npm run rank:votacoes` monta `data/quiz/shortlist.json` (até 50). Entra
   votação nominal de plenário da 56ª ou 57ª legislatura, de mérito (texto,
   substitutivo, emenda, redação final, PEC/PL/PLP/MPV), disputada (Sim entre
   25% e 75% de Sim+Não), com orientações divergentes entre os partidos de
   2026 e cobertura de orientação para pelo menos 80% dos candidatos.
   Requerimento, urgência, adiamento e pedidos semelhantes ficam de fora.
3. `npm run classify:votacoes` chama um llama.cpp local
   (`QUIZ_LLM_BASE_URL`, API compatível com OpenAI). O modelo só descreve a
   votação (tema de uma lista fechada, pergunta, o que o Sim significa,
   contexto). Não vê candidato nem partido. O rascunho vai para
   `content/quiz/votacoes.draft.json`. Cache em `data/quiz/llm-cache/`.
4. Uma pessoa escolhe de 8 a 10 votações, no máximo duas do mesmo tema, e
   grava `content/quiz/pautas-quiz.json`. A lista que está no repositório saiu
   da lista curta, com o texto de cada pergunta preso à ementa oficial. O
   rascunho do modelo entra nessa revisão quando `QUIZ_LLM_BASE_URL` está
   definido.
5. `npm run build:quiz` grava `quiz_positions` e `quiz_metrics` no `tse.db`.
   `npm run publish:data` leva o banco ao GCS.

### Métricas

- **Trajetória** substitui a pergunta antiga de mandato pela ocupação.
  Conta mandatos eleitos ou suplentes no TSE desde 2004. O mandato atual só
  soma 1 se a pessoa está em exercício e esse mandato federal ainda não
  aparece no histórico. Faixas: renovação (0), alguma experiência (1–2),
  carreira longa (3 ou mais).
- **Alinhamento com o governo**: na 57ª legislatura, fração de lados iguais
  à orientação "Governo", só em votações em que o Governo orientou Sim ou
  Não. Usa o voto do candidato quando há pelo menos 5 comparações; senão, a
  orientação do partido, com o mesmo mínimo. Governista é 70% ou mais,
  oposição é 30% ou menos, o meio é independente. Abaixo de 5 comparações a
  pergunta fica sem dado.

Nenhuma das duas atribui esquerda, direita ou "anti-sistema".

## As perguntas de perfil do TSE

Cada pergunta tem um **resolvedor puro** (`src/data/quiz-source.ts`) que mapeia
o candidato (dados oficiais) para uma opção. Perfil do candidato = o resultado
dessas 5 resoluções. Nada é escrito à mão por candidato.

| id           | Pergunta (título)                                                  | Opções     | Fonte no TSE       |
| ------------ | ------------------------------------------------------------------ | ---------- | ------------------ |
| `sector`     | Que experiência profissional você quer em quem vai te representar? | 10 setores | `DS_OCUPACAO`      |
| `experience` | Você prefere alguém com mandato político anterior?                 | 3          | `DS_OCUPACAO`      |
| `age`        | Você prefere um representante da sua geração?                      | 4 faixas   | `DT_NASCIMENTO`    |
| `candidacy`  | Você dá preferência a federação partidária ou partido isolado?     | 2          | tipo de agremiação |
| `local`      | Você valoriza um candidato nascido na UF escolhida?                | 2          | `SG_UF_NASCIMENTO` |

Total: 10 × 3 × 4 × 2 × 2 = **480 combinações possíveis de respostas**.

### `sector` — setor (10 opções)

`resolveSector` casa a ocupação declarada (`DS_OCUPACAO`, 77 valores distintos
na base) com **regex por prefixo**. Decisão técnica importante: o `\b` do JS
não reconhece acentos (é ASCII), então `\bMÉDICO\b` falhava em "MÉDICO" com
acento no meio da palavra; a solução foi casar por **prefixo dentro de
palavra** (ex.: `\bMÉDICO`) sem âncora final. Nesta rodada valeu a pena pela
simplicidade; os casos raros que sobrassem caem em `outros`.

Acertos conhecidos para evitar itens "pega-pega":

- `APOSENTADO (EXCETO SERVIDOR PÚBLICO)` não deve virar gestão pública: o regex
  de política exige `SERVIDOR PÚBLICO (CIVIL|ESTADUAL|FEDERAL|MUNICIPAL)`.
- Profissões com sufixos variados (ENFERMEIRO/ENFERMAGEM, FISIOTERAPEUTA/
  FISIOTERAPIA) usam o radical (`ENFERMEIR`, `FISIOTERAP`).

Distribuição observada nos 428 (alvo 5–50% por opção; aviso <3%):

| Setor                     | %     | n   |
| ------------------------- | ----- | --- |
| Negócios e economia       | 21,5% | 92  |
| Outra área                | 15,2% | 65  |
| Política e gestão pública | 14,7% | 63  |
| Saúde                     | 10,3% | 44  |
| Direito                   | 8,9%  | 38  |
| Comunicação e cultura     | 7,7%  | 33  |
| Educação                  | 6,8%  | 29  |
| Segurança pública         | 6,3%  | 27  |
| Serviços e trabalho       | 5,4%  | 23  |
| Agropecuária              | 3,3%  | 14  |

Agropecuária fica abaixo de 5% (3,3%) — desvio aceito e documentado (o perfil
de candidatos PR desta amostra tem poucos agropecuaristas; a opção continua
visível para quem tem esse interesse, e não tende o resultado).

### `experience` — mandato anterior (3 opções)

Derivado da ocupação declarada:

- `ja-deputado` — ocupação contém "DEPUTADO" (os deputados federais em
  exercício têm essa ocupação; o rótulo "Já foi deputado(a)" abrange esses);
- `outro-mandato` — ocupação tem outro cargo eletivo
  (`VEREADOR|SENADOR|GOVERNADOR|PREFEITO`);
- `sem-mandato` — demais (área técnica/empresarial).

Distribuição observada: **sem-mandato 90,4%**, outro-mandato + já-deputado
9,6%. É um desequilíbrio inerente ao dado (nesta eleição a maioria dos
candidatos nunca teve mandato), não ao desenho do teste. A pergunta não é
tendente para o resultado — apenas "menos informativa" numa direção.

Limitção documentada: o TSE não publica hoje um campo confiável de reeleição
(`ST_REELEICAO` veio `#NE` para 100% das linhas PR desta eleição), por isso a
pergunta se apoia na ocupação.

### `age` — faixa etária (4 opções)

Idade calculada na data da eleição (04/10/2026) a partir de `DT_NASCIMENTO`:
`ate-39`, `40-49`, `50-59`, `60-mais`. Nesta base a distribuição é quase
uniforme (21,5%–27,3%) — a pergunta contribui bem para diferenciar candidatos.

### `candidacy` — agremiação (2 opções)

`FEDERAÇÃO` → `federacao`; qualquer outro valor (`PARTIDO ISOLADO`, etc.) →
`isolado`. Distribuição: federação 31,8% / partido isolado 68,2%.

### `local` — vínculo territorial (2 opções)

UF de nascimento igual à UF da eleição → `aqui`, senão `fora`. No Paraná a
base de 2026 ficava em cerca de 79% nascidos no estado.

## Perfis e raridade

`buildProfile` resolve as 5 dimensões e lança `QuizResolutionError` se algum
candidato não for resolvível (nunca aconteceu com os 428). `profileKey` é a
junção estável das 5 opções ("`setor:saude|experiencia:ja-deputado|...`"),
usada no desempate.

Na base atual há **134 perfis distintos** entre 428 candidatos; o perfil mais
repetido aparece 18 vezes (4,2%). Nenhum candidato é indistinguível do set.

## Pontuação e desempate

- A nota é a fração ponderada de concordância nas perguntas respondidas e
  conhecidas para aquele candidato. "Tanto faz" e pergunta sem dado ficam de
  fora. Peso 2 quando a pessoa marca a resposta como mais importante.
- Quem tem dado em menos da metade das perguntas respondidas fica atrás de
  quem cobre pelo menos 50%, mesmo com nota mais alta.
- Ordenação: cobertura mínima → nota (desc) → mais concordâncias vindas do
  voto do próprio candidato → **raridade do perfil** (asc) → nome de urna
  (`localeCompare` `pt-BR`).

## Auditoria de imparcialidade

`scripts/check-distribution.ts` sorteia **50 mil** combinações com semente
fixa (`20261004`) e conta o vencedor de cada amostra. A tela de
imparcialidade usa a mesma função com uma amostra menor, para a página
abrir. O contrato continua sendo nenhum candidato acima de ~5% das amostras.
O relatório também compara a fatia de vitórias de cada partido com a fatia
de candidatos, porque a orientação partidária repete o perfil entre quem é
da mesma legenda.

Métricas da base atual (428 candidatos):

- Vitórias por combinação do vencedor: **máximo ≈ 4,6%** das 480, mínimo 0
  (perfis raros nunca vencem sozinhos).
- Cobertura por opção: alvo 5–50% com aviso <3% e >50%. Único ponto abaixo de
  5% é `agro` (3,3%), registrado acima.

O ideal teórico de um quiz com 428 candidatos seria ~0,23% por candidato;
como os perfis derivam de dados reais (e não são escolhidos à vontade), o
contrato é **nenhum candidato vencer de forma desproporcional** (nenhum

> ~5%), não uma divisão perfeita.

## O que fica de fora (decisão)

Quem tiver curiosidade pode auditar tudo no app: a qualquer resultado, a tela
**"Verificar imparcialidade"** mostra a mesma distribuição, e cada linha do
ranking revela a proveniência de cada dimensão (ex.: "Derivado da ocupação
declarada ao TSE"). O desempate por raridade é declarado na tela de resultado.

Decisões transversais (ignorar o resultado do pleito nesta rodada, formatos
monetários, datasets e o casamento com a Câmara) estão registradas em
[`how-it-works.md`](how-it-works.md).
