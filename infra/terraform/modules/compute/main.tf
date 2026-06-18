variable "env" {}
variable "region" {}
variable "backend_image" {}
variable "data_bucket" {}
variable "model_bucket" {}

resource "google_cloud_run_service" "backend" {
  name     = "${var.env}-audium-backend"
  location = var.region

  template {
    spec {
      containers {
        image = var.backend_image
        env {
          name  = "AUDIUM_ENV"
          value = var.env
        }
        env {
          name  = "AUDIUM_BUCKET_DATA"
          value = var.data_bucket
        }
        env {
          name  = "AUDIUM_BUCKET_MODELS"
          value = var.model_bucket
        }
      }
    }
  }
}

resource "google_vertex_ai_endpoint" "inference" {
  name         = "${var.env}-xtts-inference"
  display_name = "${var.env}-xtts-inference"
  location     = var.region
}
