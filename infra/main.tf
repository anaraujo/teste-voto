# Ativação das APIs necessárias ao deploy.

locals {
  apis = [
    "run.googleapis.com",
    "storage.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "iap.googleapis.com",
  ]
}

data "google_project" "project" {
  project_id = var.project_id
}

resource "google_project_service" "apis" {
  for_each = toset(local.apis)

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}
