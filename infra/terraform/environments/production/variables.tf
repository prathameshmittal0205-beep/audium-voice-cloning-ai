variable "project_id" {
  type        = string
  description = "GCP Project ID"
}

variable "region" {
  type        = string
  default     = "us-central1"
  description = "GCP Region"
}

variable "backend_image" {
  type        = string
  description = "Container image for Express backend"
}

variable "notification_email" {
  type        = string
  description = "Email address for monitoring alerts"
  default     = "alerts@audium.app"
}
