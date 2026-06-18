variable "project_id" { type = string }
variable "environment" { type = string }
variable "notification_email" { type = string }

resource "google_monitoring_notification_channel" "email" {
  display_name = "Audium Alert Channel"
  type = "email"
  project = var.project_id
  labels = {
    email_address = var.notification_email
  }
}

resource "google_monitoring_alert_policy" "cloud_run_cpu" {
  display_name = "${var.environment} Cloud Run CPU > 80%"
  project = var.project_id
  combiner = "OR"
  conditions {
    display_name = "CPU utilization"
    condition_threshold {
      filter = "resource.type = \"cloud_run_revision\" AND metric.type = \"run.googleapis.com/container/cpu/utilizations\""
      duration = "300s"
      comparison = "COMPARISON_GT"
      threshold_value = 0.8
    }
  }
  notification_channels = [google_monitoring_notification_channel.email.id]
}

resource "google_monitoring_alert_policy" "cloud_run_memory" {
  display_name = "${var.environment} Cloud Run Memory > 80%"
  project = var.project_id
  combiner = "OR"
  conditions {
    display_name = "Memory utilization"
    condition_threshold {
      filter = "resource.type = \"cloud_run_revision\" AND metric.type = \"run.googleapis.com/container/memory/utilizations\""
      duration = "300s"
      comparison = "COMPARISON_GT"
      threshold_value = 0.8
    }
  }
  notification_channels = [google_monitoring_notification_channel.email.id]
}

resource "google_monitoring_alert_policy" "cloud_run_5xx" {
  display_name = "${var.environment} Cloud Run 5xx Errors"
  project = var.project_id
  combiner = "OR"
  conditions {
    display_name = "5xx Error Rate"
    condition_threshold {
      filter = "resource.type = \"cloud_run_revision\" AND metric.type = \"run.googleapis.com/request_count\" AND metric.labels.response_code_class = \"5xx\""
      duration = "300s"
      comparison = "COMPARISON_GT"
      threshold_value = 10
    }
  }
  notification_channels = [google_monitoring_notification_channel.email.id]
}

resource "google_monitoring_alert_policy" "vertex_failures" {
  display_name = "${var.environment} Vertex AI Failures"
  project = var.project_id
  combiner = "OR"
  conditions {
    display_name = "Vertex AI Prediction Failures"
    condition_threshold {
      filter = "resource.type = \"aiplatform.googleapis.com/Endpoint\" AND metric.type = \"aiplatform.googleapis.com/prediction/online/predict_requests\" AND metric.labels.response_code = \"5xx\""
      duration = "300s"
      comparison = "COMPARISON_GT"
      threshold_value = 5
    }
  }
  notification_channels = [google_monitoring_notification_channel.email.id]
}

resource "google_logging_metric" "tts_failures" {
  name = "tts_generation_failures"
  filter = "resource.type=\"cloud_run_revision\" AND textPayload:\"TTS Generation Failed\""
  project = var.project_id
  metric_descriptor {
    metric_kind = "DELTA"
    value_type = "INT64"
  }
}

resource "google_logging_metric" "training_failures" {
  name = "training_job_failures"
  filter = "resource.type=\"cloud_run_revision\" AND textPayload:\"Training Job Failed\""
  project = var.project_id
  metric_descriptor {
    metric_kind = "DELTA"
    value_type = "INT64"
  }
}

resource "google_logging_metric" "auth_failures" {
  name = "auth_failures"
  filter = "resource.type=\"cloud_run_revision\" AND textPayload:\"Authentication failed\""
  project = var.project_id
  metric_descriptor {
    metric_kind = "DELTA"
    value_type = "INT64"
  }
}

resource "google_logging_metric" "rate_limit_violations" {
  name = "rate_limit_violations"
  filter = "resource.type=\"cloud_run_revision\" AND jsonPayload.message:\"Rate limit exceeded\""
  project = var.project_id
  metric_descriptor {
    metric_kind = "DELTA"
    value_type = "INT64"
  }
}
