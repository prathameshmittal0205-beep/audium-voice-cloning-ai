terraform {
  backend "gcs" {
    bucket  = "audium-tf-state-staging"
    prefix  = "terraform/state/staging"
  }
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

module "storage" {
  source = "../../modules/storage"
  env    = "staging"
  region = var.region
}

module "security" {
  source = "../../modules/security"
  env    = "staging"
}

module "compute" {
  source        = "../../modules/compute"
  env           = "staging"
  region        = var.region
  backend_image = var.backend_image
  data_bucket   = module.storage.data_bucket_name
  model_bucket  = module.storage.model_bucket_name
}

module "secrets" {
  source                = "../../modules/secrets"
  project_id            = var.project_id
  environment           = "staging"
  service_account_email = module.security.backend_sa_email
  secrets = [
    "AUDIUM_JWT_SECRET",
    "MONGODB_URI",
    "REDIS_URL",
    "VERTEX_ENDPOINT_ID",
    "GCS_BUCKET_MODELS",
    "GCS_BUCKET_VOICE_DATA",
    "GCS_BUCKET_GENERATED"
  ]
}

module "artifact_registry" {
  source                = "../../modules/artifact_registry"
  project_id            = var.project_id
  region                = var.region
  service_account_email = module.security.backend_sa_email
  repositories          = ["audium-backend-staging", "audium-training-staging", "audium-serving-staging"]
}

module "networking" {
  source                 = "../../modules/networking"
  project_id             = var.project_id
  region                 = var.region
  network_name           = "audium-vpc-staging"
  staging_subnet_cidr    = "10.1.1.0/24"
  production_subnet_cidr = "10.1.2.0/24"
}

module "monitoring" {
  source             = "../../modules/monitoring"
  project_id         = var.project_id
  environment        = "staging"
  notification_email = var.notification_email
}
