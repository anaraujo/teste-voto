# Schema dos dados do TSE

Este documento descreve as colunas que o pipeline usa no arquivo de candidatos
do TSE (`consulta_cand_2026.zip` → `consulta_cand_2026_PR.csv`).

> **Gerado automaticamente?** Sim, quando possível. `npm run ingest -- --inspect`
> baixa o arquivo oficial, observa o cabeçalho real e *sobrescreve* este
> documento com o que foi observado: encoding, separador, lista de colunas,
> contagem de nulos na amostra e uma linha de exemplo.
>
> Nas seções abaixo está o dicionário previsto (nomes públicos e estáveis do
> TSE). Se o arquivo baixado divergir, o comando acima atualiza a documentação
> e o mapa de colunas em `src/data-sources/tse/schema.ts` deve ser ajustado
> para casar novamente.

## Dado e formato

| Propriedade | Valor esperado |
| ----------- | -------------- |
| Dataset     | Consulta de candidatos 2026 (todas as UF e cargos) |
| Arquivo     | `consulta_cand_2026_PR.csv` (dentro do ZIP) |
| Encoding    | ISO-8859-1 (latin1) |
| Separador   | `;` |
| Filtro      | `SG_UF = PR` e `DS_CARGO = DEPUTADO FEDERAL` |

## Colunas mapeadas pelo pipeline

Cada campo do modelo enxerga uma coluna (o pipeline aceita nomes alternativos
entre parênteses, para robustez entre versões):

| Campo do modelo                 | Coluna TSE                                        | Obrigatória |
| ------------------------------- | ------------------------------------------------- | ----------- |
| `tseSequence`                   | `SQ_CANDIDATO`                                    | sim         |
| `ballotNumber`                  | `NR_CANDIDATO`                                    | sim         |
| `fullName`                      | `NM_CANDIDATO`                                    | sim         |
| `ballotName`                    | `NM_URNA_CANDIDATO`                               | sim         |
| `partyAcronym`                  | `SG_PARTIDO`                                      | sim         |
| `party`                         | `NM_PARTIDO`                                      | sim         |
| `coalition`                     | `DS_COMPOSICAO_COLIGACAO` (vazia p/ partido isolado) | não       |
| `status`                        | `DS_SITUACAO_CANDIDATURA`                         | não         |
| `campaignStatus`                | `DS_SITUACAO_CANDIDATO_PLEITO`                    | não         |
| `candidacyType`                 | `TP_AGREMIACAO`                                   | não         |
| `occupation`                    | `DS_OCUPACAO`                                     | não         |
| `education`                     | `DS_GRAU_INSTRUCAO`                               | não         |
| `birthDate`                     | `DT_NASCIMENTO` (normalizada para `AAAA-MM-DD`)   | não         |
| `gender`                        | `DS_GENERO`                                       | não         |
| `race`                          | `DS_COR_RACA`                                     | não         |
| `nationality`                   | `DS_NACIONALIDADE`                                | não         |
| `city`                          | `NM_UE`                                           | não         |
| `email`                         | `NM_EMAIL`                                        | não         |

Campos previstos no modelo mas que **ainda não** têm origem neste dataset
(fica `null` até as próximas rodadas): `website`, `socialLinks`
(dataset de redes sociais), `photoUrl` (dataset de fotos) e `totalAssets`
(dataset de bens).

## Datasets irmãos

| Dataset                    | ZIP                          | Arquivo dentro do ZIP          | Uso atual |
| -------------------------- | ---------------------------- | ------------------------------ | --------- |
| Foto dos candidatos        | `foto_cand2026_PR_div.zip`   | `<SQ_CANDIDATO>.jpg`           | implementado (opcional) |
| Bens declarados            | `bem_candidato_2026.zip`     | `bem_candidato_2026_PR.csv`    | stub |
| Redes sociais              | `rede_social_candidato_2026.zip` | `rede_social_candidato_2026_PR.csv` | stub |

## Validações do pipeline

1. **Colunas obrigatórias** precisam existir no cabeçalho
   (`src/data-sources/tse/schema.ts` → `REQUIRED_HEADERS`). A ausência aborta a
   ingestão com a lista das faltantes.
2. **Registro** é considerado inválido (e agregado em `errors`, sem abortar)
   quando falta `SQ_CANDIDATO`, `NR_CANDIDATO` ou ambos os nomes.
3. Uma linha pertence à eleição quando `SG_UF` e `DS_CARGO` batem com a
   configuração **e** a `DS_ELEICAO` referencia o ano (proteção contra arquivos
   que misturam eleições).