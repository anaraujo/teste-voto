# Referências externas do deploy

Fontes oficiais e de repositório usadas na implementação — plano, docs
Google de IAP/FUSE, datasets TSE e convenções OKF.

## Documentos de repositório

* [Plano original](/references/plan-deploy.md) - `PLAN-DEPLOY.md` (fonte deste bundle)
* Convenções de agentes - `AGENTS.md`
* Arquitetura do app - `docs/how-it-works.md`
* Desenho do quiz - `docs/quiz-design.md`
* Ficha comparável - `docs/ficha-comparavel.md`

## Google Cloud

* [Cloud Run + IAP](/references/gcp-cloud-run-iap.md) - Securing Cloud Run with Identity-Aware Proxy
* [Cloud Storage FUSE](/references/gcs-fuse-mount.md) - Mount buckets no Cloud Run v2
* Cloud Run preços/free tier - <https://cloud.google.com/run/pricing>
* Artifact Registry preços - <https://cloud.google.com/artifact-registry/pricing>

## TSE

* [Datasets de ingestão](/references/tse-datasets.md) - URLs oficiais em `src/shared/elections.ts`
* CDN candidatos 2026 - `https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2026.zip`

## Formato de documentação

* Open Knowledge Format v0.2 - <https://github.com/GoogleCloudPlatform/open-knowledge-format/blob/main/SPEC.md>
* Este bundle - [`/index.md`](/index.md) (`okf_version: "0.2"`)

## Convenções do repositório relevantes ao deploy

* Backend só padrão Node — sem dependências novas sem conversa.
* Proveniência: tudo carrega `source` de arquivo oficial.
* `check:distribution` deve continuar verde após mudanças de código.
* Nunca subir `data/download/` nem `data/camara/` ao bucket.
