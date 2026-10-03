# Saídas do deploy (URL, bucket e comandos prontos).

output "service_url" {
  description = "URL pública (ou privada via IAP) do Cloud Run."
  value       = google_cloud_run_v2_service.app.uri
}

output "service_name" {
  description = "Nome do serviço Cloud Run."
  value       = google_cloud_run_v2_service.app.name
}

output "region" {
  description = "Região do serviço."
  value       = var.region
}

output "bucket_name" {
  description = "Bucket GCS com tse.db, manifest.json e photos/."
  value       = google_storage_bucket.data.name
}

output "artifact_registry_repo" {
  description = "Repositório Docker no Artifact Registry."
  value       = google_artifact_registry_repository.docker.name
}

output "image_reference" {
  description = "Caminho base da imagem no Artifact Registry."
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${var.registry_repo_id}/app"
}

output "publish_command" {
  description = "Upload dos dados locais para o bucket."
  value       = "GCS_BUCKET=gs://${google_storage_bucket.data.name} npm run publish:data -- --reload"
}

output "build_command" {
  description = "Build e push da imagem via Cloud Build (sem Docker local)."
  value       = "gcloud builds submit --tag ${var.region}-docker.pkg.dev/${var.project_id}/${var.registry_repo_id}/app:$(date -u +%Y%m%d%H%M%S) ."
}

output "iap_mode" {
  description = "Modo de acesso atual (private IAP ou public allUsers)."
  value       = var.public_access ? "public" : "private"
}

output "allowed_emails" {
  description = "Allow-list IAP vigente (vazia em modo público)."
  value       = var.public_access ? [] : var.allowed_emails
}
