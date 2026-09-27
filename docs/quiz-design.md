# Desenho do quiz (data-driven)

Este documento registra como o quiz foi desenhado e, principalmente, **as
decisões** tomadas para que ele seja justo, auditável e derivado 100% de dados
oficiais do TSE — nunca de opinião.

## Escopo (decisão)

Nesta rodada o quiz responde sobre uma única eleição: **2026 · Paraná ·
Deputado Federal**. Exatamente **428 candidatos** (todos os registros
`SG_UF=PR`, `DS_CARGO=DEPUTADO FEDERAL`, `ANO_ELEICAO=2026`, `is_active=1` do
banco local). Outros cargos do mesmo arquivo (governador, senador, deputado
estadual, etc.) ficam de fora.

Proveniência da regra: a ingestão já filtra a eleição configurada
(`ElectionConfig` em `src/shared/elections.ts`); o quiz apenas consome essa
base.

## As 5 perguntas

Cada pergunta tem um **resolvedor puro** (`src/data/quiz-source.ts`) que mapeia
o candidato (dados oficiais) para uma opção. Perfil do candidato = o resultado
dessas 5 resoluções. Nada é escrito à mão por candidato.

| id | Pergunta (título) | Opções | Fonte no TSE |
| -- | ----------------- | ------ | ------------ |
| `sector` | Que experiência profissional você quer em quem vai te representar? | 10 setores | `DS_OCUPACAO` |
| `experience` | Você prefere alguém com mandato político anterior? | 3 | `DS_OCUPACAO` |
| `age` | Você prefere um representante da sua geração? | 4 faixas | `DT_NASCIMENTO` |
| `candidacy` | Você dá preferência a federação partidária ou partido isolado? | 2 | tipo de agremiação |
| `local` | Você valoriza um candidato nascido no Paraná? | 2 | `SG_UF_NASCIMENTO` |

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

| Setor | % | n |
| ----- | -- | - |
| Negócios e economia | 21,5% | 92 |
| Outra área | 15,2% | 65 |
| Política e gestão pública | 14,7% | 63 |
| Saúde | 10,3% | 44 |
| Direito | 8,9% | 38 |
| Comunicação e cultura | 7,7% | 33 |
| Educação | 6,8% | 29 |
| Segurança pública | 6,3% | 27 |
| Serviços e trabalho | 5,4% | 23 |
| Agropecuária | 3,3% | 14 |

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

UF de nascimento igual a `PR` → `pr` (79%), senão `fora` (21%).

## Perfis e raridade

`buildProfile` resolve as 5 dimensões e lança `QuizResolutionError` se algum
candidato não for resolvível (nunca aconteceu com os 428). `profileKey` é a
junção estável das 5 opções ("`setor:saude|experiencia:ja-deputado|...`"),
usada no desempate.

Na base atual há **134 perfis distintos** entre 428 candidatos; o perfil mais
repetido aparece 18 vezes (4,2%). Nenhum candidato é indistinguível do set.

## Pontuação e desempate

- Pontuação = nº de perguntas em que a resposta da pessoa coincide com o perfil
  do candidato (0–5).
- Ordenação: pontos (desc) → **raridade do perfil** (asc: perfis mais raros
  primeiro) → nome de urna (`localeCompare` `pt-BR`).
- O desempate por raridade favorece candidatos com perfil único — reduzindo a
  vantagem estrutural de quem compartilha um perfil muito comum (o mais
  repetido aparece em 4,2% dos candidatos; sem o desempate ele venceria em
  igual proporção).

## Auditoria de imparcialidade

`scripts/check-distribution.ts` enumera as **480 combinações** de respostas e
conta, para cada uma, o vencedor. Usa o mesmo `candidates` e o mesmo
`rankResults` do app (fonte única da verdade).

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