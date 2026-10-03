# Variáveis do módulo de deploy (teste-voto na GCP).

variable "project_id" {
  description = "ID do projeto GCP com billing ativado."
  type        = string
}

variable "region" {
  description = "Região do Cloud Run. Default: São Paulo (latência BR). Para free tier estrito de storage, use us-east1."
  type        = string
  default     = "southamerica-east1"
}

variable "service_name" {
  description = "Nome do serviço Cloud Run."
  type        = string
  default     = "teste-voto"
}

variable "bucket_name" {
  description = "Nome global do bucket GCS com tse.db, manifest.json e photos/."
  type        = string
}

variable "image" {
  description = "Imagem publicada no Artifact Registry (region-docker.pkg.dev/<proj>/teste-voto/app:<tag>)."
  type        = string
}

variable "public_access" {
  description = "true = qualquer pessoa pode invocar o serviço (IAP desligado). false = allow-list via IAP."
  type        = bool
  default     = false
}

variable "allowed_emails" {
  description = "Allow-list de e-mails Google na fase privada (IAP)."
  type        = list(string)
  default     = []
}

variable "billing_account_id" {
  description = "ID da conta de billing (ex.: 012345-ABCDEF-123456). Vazio desativa o orçamento."
  type        = string
  default     = ""
}

variable "budget_amount_usd" {
  description = "Limite simbólico do orçamento (alerta; não corta gasto)."
  type        = number
  default     = 1
}

variable "registry_repo_id" {
  description = "ID do repositório Docker no Artifact Registry."
  type        = string
  default     = "teste-voto"
}
