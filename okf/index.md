---
okf_version: "0.2"
---

# teste-voto — Deploy GCP (OKF)

Bundle Open Knowledge Format **v0.2** documentando a implementação de
`PLAN-DEPLOY.md`: publicação do teste-voto na Google Cloud com custo
~zero, dados desacoplados do deploy, IAP com allow-list na fase privada e
abertura pública por variável.

## Visão geral

* [Arquitetura alvo](/architecture.md) - Um Cloud Run + bucket GCS + Artifact Registry; dados fora da imagem; IAP direto.
* [Fluxo de publicação de dados](/deploy/data-publishing.md) - `npm run publish:data`: WAL checkpoint, manifest com proveniência, upload via `gcloud storage`.
* [Container e entrypoint](/deploy/container.md) - Dockerfile multi-stage, cópia FUSE→disco local, `SERVE_STATIC=true`.
* [Cloud Run e IAP](/deploy/cloud-run.md) - Serviço único, volume GCS gen2, allow-list, virada pública.

## Infraestrutura Terraform

* [Variáveis e estado](/infrastructure/terraform-variables.md) - Tabela de vars, tfvars.example, estado local.
* [Bucket de dados](/infrastructure/storage-bucket.md) - Privado, versioning + lifecycle, service account do runtime.
* [Artifact Registry](/infrastructure/artifact-registry.md) - Repo Docker + cleanup (3 imagens).
* [IAM e acesso](/infrastructure/iam-and-access.md) - Invoker do IAP, binding IAP, allUsers.
* [Custo ~US$0](/infrastructure/costs.md) - Franquias, região, guardrails.

## Operação

* [Dia a dia](/operations/day-to-day.md) - Atualizar dados, deploy de código, liberar acesso, rollback.
* [Quiz com votações](/operations/quiz-votacoes.md) - Plenário da Câmara, lista curta, llama.cpp local e pautas fixas.
* [Privado → público](/operations/private-to-public.md) - Flip de `public_access` e reversão.
* [Checklist go-live](/operations/go-live-checklist.md) - Validação antes de publicar.

## Arquivos-fonte

* [Índice de arquivos](/source-files/index.md) - Mapa dos artefatos criados/alterados.
* [publish-data.ts](/source-files/publish-data-script.md) - Script de publicação no GCS.
* [server/index.ts](/source-files/server-index.md) - API + SPA estática.
* [Dockerfile e entrypoint](/source-files/docker-assets.md) - Build de imagem e bootstrap.
* [package.json](/source-files/package-json-script.md) - Script `publish:data`.

## Referências

* [Índice de referências](/references/index.md) - Fontes externas e oficiais.
* [Plano original](/references/plan-deploy.md) - `PLAN-DEPLOY.md` no repositório.
* [Cloud Run + IAP](/references/gcp-cloud-run-iap.md) - Docs Google sobre IAP no Cloud Run.
* [Cloud Storage FUSE](/references/gcs-fuse-mount.md) - Volume mount no Cloud Run v2.
* [Datasets TSE](/references/tse-datasets.md) - URLs oficiais de ingestão.
