variable "env" {}
variable "region" {}

resource "google_storage_bucket" "data" {
  name     = "${var.env}-audium-voice-data"
  location = var.region
  uniform_bucket_level_access = true
  force_destroy = true
}

resource "google_storage_bucket" "models" {
  name     = "${var.env}-audium-models"
  location = var.region
  uniform_bucket_level_access = true
  force_destroy = true
}

output "data_bucket_name" {
  value = google_storage_bucket.data.name
}

output "model_bucket_name" {
  value = google_storage_bucket.models.name
}
