# Deploy manual do teste-voto (detalhes em PLAN-DEPLOY.md).
#
#   make ingest     baixa/processa dados do TSE, Câmara e Senado (local)
#   make sync       publica tse.db + manifest + fotos no GCS e recarrega o Cloud Run
#   make redeploy   build+push da imagem (tag de timestamp) e aplica o novo image via terraform
#
# Primeira vez: terraform -chdir=infra init && terraform -chdir=infra apply
# (cria bucket, Artifact Registry e Cloud Run) antes de sync/redeploy.
# Valores vêm dos outputs do Terraform; sobrescreva com VAR=... se precisar.

IMAGE    ?= $(shell terraform -chdir=infra output -raw image_reference)
BUCKET   ?= $(shell terraform -chdir=infra output -raw bucket_name)
SERVICE  ?= $(shell terraform -chdir=infra output -raw service_name)
REGION   ?= $(shell terraform -chdir=infra output -raw region)
TAG      := $(shell date -u +%Y%m%d%H%M%S)

.PHONY: ingest sync redeploy

ingest:
	npm run ingest && npm run sync:incumbents && npm run sync:parliament && npm run sync:history

sync:
	GCS_BUCKET=gs://$(BUCKET) CLOUD_RUN_SERVICE=$(SERVICE) CLOUD_RUN_REGION=$(REGION) npm run publish:data -- --reload

redeploy:
	gcloud builds submit --tag $(IMAGE):$(TAG) .
	terraform -chdir=infra apply -var="image=$(IMAGE):$(TAG)"
