variable "project_id" { type = string }
variable "environment" { type = string }
variable "secrets" { type = list(string) }
variable "service_account_email" { type = string }

resource "google_secret_manager_secret" "secret" {
  for_each = toset(var.secrets)
  secret_id = "${var.environment}-${each.value}"
  project = var.project_id
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "secret_version" {
  for_each = toset(var.secrets)
  secret = google_secret_manager_secret.secret[each.value].id
  secret_data = "initial-value-change-me"
}

resource "google_secret_manager_secret_iam_member" "secret_access" {
  for_each = toset(var.secrets)
  project = var.project_id
  secret_id = google_secret_manager_secret.secret[each.value].id
  role = "roles/secretmanager.secretAccessor"
  member = "serviceAccount:${var.service_account_email}"
}

output "secret_ids" {
  value = { for k, v in google_secret_manager_secret.secret : k => v.id }
}
