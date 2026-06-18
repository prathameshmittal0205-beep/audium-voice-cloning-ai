variable "env" {}

resource "google_service_account" "audium_backend" {
  account_id   = "${var.env}-audium-backend-sa"
  display_name = "Audium Backend Service Account"
}

resource "google_project_iam_member" "backend_storage" {
  project = var.env
  role    = "roles/storage.objectAdmin"
  member  = "serviceAccount:${google_service_account.audium_backend.email}"
}

resource "google_project_iam_member" "backend_vertex" {
  project = var.env
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.audium_backend.email}"
}

output "backend_sa_email" {
  value = google_service_account.audium_backend.email
}
