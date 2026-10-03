# Artifact Registry: repo Docker para as imagens do serviço.
# Cleanup policy mantém só as 3 imagens mais recentes (franquia 0,5 GB).

resource "google_artifact_registry_repository" "docker" {
  location      = var.region
  repository_id = var.registry_repo_id
  description   = "Imagens Docker do teste-voto (Cloud Run)"
  format        = "DOCKER"
  project       = var.project_id

  cleanup_policies {
    id     = "keep-recent"
    action = "KEEP"

    most_recent_versions {
      count = 3
    }
  }

  cleanup_policies {
    id     = "delete-old"
    action = "DELETE"

    older_than_days = 30

    condition {
      tag_state             = "TAGGED"
      tag_name_prefixes     = ["dev-", "test-"]
      version_name_prefixes = []
    }
  }

  labels = {
    app = "teste-voto"
  }

  depends_on = [google_project_service.apis]
}
