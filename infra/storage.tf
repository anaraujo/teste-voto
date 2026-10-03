# Bucket de dados do runtime + service account do Cloud Run.
#
# O bucket é PRIVADO: só a service account do serviço lê via volume mount.
# Nunca exponha o bucket com allUsers.

resource "google_storage_bucket" "data" {
  name                        = var.bucket_name
  location                    = var.region
  project                     = var.project_id
  force_destroy               = false
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  versioning {
    enabled = true
  }

  # Mantém as últimas ~5 versões de objetos (rollback de tse.db sem custo alto).
  lifecycle_rule {
    condition {
      num_newer_versions = 5
    }
    action {
      type = "Delete"
    }
  }

  labels = {
    app     = "teste-voto"
    purpose = "tse-runtime-data"
  }

  depends_on = [google_project_service.apis]
}

# Service account dedicada ao Cloud Run (princípio do menor privilégio).
resource "google_service_account" "run_sa" {
  account_id   = "${var.service_name}-run"
  display_name = "teste-voto Cloud Run runtime"
  project      = var.project_id
}

# Leitura do bucket pelo runtime (volume mount FUSE gen2).
resource "google_storage_bucket_iam_member" "run_reader" {
  bucket = google_storage_bucket.data.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.run_sa.email}"

  depends_on = [google_project_service.apis]
}

# Orçamento simbólico (alerta; não corta gasto).
resource "google_billing_budget" "alert" {
  count = var.billing_account_id == "" ? 0 : 1

  billing_account = var.billing_account_id
  display_name    = "${var.service_name} budget"
  project         = var.project_id

  budget_filter {
    projects = ["projects/${var.project_id}"]
  }

  amount {
    specified_amount {
      currency_code = "USD"
      units         = tostring(var.budget_amount_usd)
    }
  }

  threshold_rules {
    threshold_percent = 0.5
  }

  threshold_rules {
    threshold_percent = 0.9
  }

  threshold_rules {
    threshold_percent = 1.0
  }

  depends_on = [google_project_service.apis]
}
