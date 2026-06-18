variable "project_id" { type = string }
variable "region" { type = string }
variable "network_name" { type = string }
variable "staging_subnet_cidr" { type = string }
variable "production_subnet_cidr" { type = string }

resource "google_compute_network" "vpc_network" {
  name = var.network_name
  project = var.project_id
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "staging_subnet" {
  name = "staging-subnet"
  ip_cidr_range = var.staging_subnet_cidr
  region = var.region
  network = google_compute_network.vpc_network.id
  project = var.project_id
  private_ip_google_access = true
}

resource "google_compute_subnetwork" "production_subnet" {
  name = "production-subnet"
  ip_cidr_range = var.production_subnet_cidr
  region = var.region
  network = google_compute_network.vpc_network.id
  project = var.project_id
  private_ip_google_access = true
}

resource "google_vpc_access_connector" "connector" {
  name = "audium-vpc-con"
  region = var.region
  project = var.project_id
  subnet {
    name = google_compute_subnetwork.production_subnet.name
  }
}

# Private Service Access
resource "google_compute_global_address" "private_ip_alloc" {
  name          = "private-ip-alloc"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.vpc_network.id
  project       = var.project_id
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.vpc_network.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.name]
}

output "network_id" {
  value = google_compute_network.vpc_network.id
}
output "staging_subnet_id" {
  value = google_compute_subnetwork.staging_subnet.id
}
output "production_subnet_id" {
  value = google_compute_subnetwork.production_subnet.id
}
output "connector_id" {
  value = google_vpc_access_connector.connector.id
}
