variable "project_id" { type = string }
variable "region" { type = string }
variable "repositories" { type = list(string) }
variable "service_account_email" { type = string }

resource "google_artifact_registry_repository" "repo" {
  for_each = toset(var.repositories)
  location = var.region
  repository_id = each.value
  format = "DOCKER"
  project = var.project_id
  
  docker_config {
    immutable_tags = true
  }
}

resource "google_artifact_registry_repository_iam_member" "repo_reader" {
  for_each = toset(var.repositories)
  project = var.project_id
  location = var.region
  repository = google_artifact_registry_repository.repo[each.value].name
  role = "roles/artifactregistry.reader"
  member = "serviceAccount:${var.service_account_email}"
}

output "repository_urls" {
  value = { for k, v in google_artifact_registry_repository.repo : k => "${v.location}-docker.pkg.dev/${v.project}/${v.repository_id}" }
}
