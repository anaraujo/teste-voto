# Cloud Run + IAP + allow-list / allUsers.
#
# Fase privada: IAP direto no Cloud Run (GA, sem LB, sem custo).
# Fase pública : public_access = true → run.invoker para allUsers, IAP off.
# Observação  : a primeira ativação do IAP em projetos sem organização
#               exige o passo manual do Console (okf/deploy/cloud-run.md).

locals {
  iap_invoker = "serviceAccount:service-${data.google_project.project.number}@gcp-sa-iap.iam.gserviceaccount.com"
  public_members = var.public_access ? ["allUsers"] : []
}

resource "google_cloud_run_v2_service" "app" {
  name     = var.service_name
  location = var.region
  project  = var.project_id

  # Evita bloqueio de destroy em projetos de teste.
  deletion_protection = false

  ingress = "INGRESS_TRAFFIC_ALL"
  iap_enabled = !var.public_access

  template {
    service_account          = google_service_account.run_sa.email
    execution_environment    = "EXECUTION_ENVIRONMENT_GEN2"
    timeout                  = "300s"

    scaling {
      min_instance_count = 0
      max_instance_count = 3
    }

    volumes {
      name = "tse-data"
      gcs {
        bucket    = google_storage_bucket.data.name
        read_only = true
      }
    }

    containers {
      image = var.image

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        cpu_idle = true
      }

      env {
        name  = "DATA_DIR"
        value = "/app/data"
      }

      env {
        name  = "SERVE_STATIC"
        value = "true"
      }

      env {
        name  = "PORT"
        value = "8080"
      }

      # Data version é atualizada por `npm run publish:data -- --reload`
      # (gcloud run services update --update-env-vars DATA_VERSION=...).
      env {
        name  = "DATA_VERSION"
        value = "unpublished"
      }

      volume_mounts {
        name       = "tse-data"
        mount_path = "/mnt/tse-data"
      }

      startup_probe {
        initial_delay_seconds = 5
        timeout_seconds       = 5
        period_seconds        = 10
        failure_threshold     = 10
        http_get {
          path = "/api/health"
          port = 8080
        }
      }
    }
  }

  depends_on = [
    google_project_service.apis,
    google_storage_bucket_iam_member.run_reader,
  ]
}

# IAP precisa invocar o serviço (sempre).
resource "google_cloud_run_v2_service_iam_member" "iap_invoker" {
  name     = google_cloud_run_v2_service.app.name
  location = google_cloud_run_v2_service.app.location
  project  = var.project_id
  role     = "roles/run.invoker"
  member   = local.iap_invoker
}

# Privado: allow-list de e-mails no IAP.
resource "google_iap_web_cloud_run_service_iam_binding" "private" {
  count = var.public_access ? 0 : 1

  project = var.project_id
  location = var.region
  service  = google_cloud_run_v2_service.app.name
  role     = "roles/iap.httpsResourceAccessor"
  members  = [for e in var.allowed_emails : "user:${e}"]

  depends_on = [google_project_service.apis]
}

# Público: qualquer pessoa pode invocar o serviço.
resource "google_cloud_run_v2_service_iam_member" "public_invoker" {
  count = var.public_access ? 1 : 0

  name     = google_cloud_run_v2_service.app.name
  location = google_cloud_run_v2_service.app.location
  project  = var.project_id
  role     = "roles/run.invoker"
  member   = "allUsers"
}
