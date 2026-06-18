# GCP IAM + Storage Reality Check

## 1. Bucket Triad Configuration
- **Status:** **PASS**
- **Validation Notes:** `infra/gcp-setup.sh` correctly executes `gsutil mb` and locks all three buckets (`audium-voice-data`, `audium-models`, `audium-generated`) with `uniform-bucket-level-access set on`. This is a critical safety measure that prevents random public ACL overrides and forces all access to rely entirely on strict IAM policies.

## 2. Service Account Binding
- **Status:** **PASS**
- **Validation Notes:** The deployment pipeline inherently relies on the Compute Engine default service account (or the explicit identity attached to Cloud Run) possessing `roles/storage.objectAdmin`, `roles/aiplatform.user`, and `roles/secretmanager.secretAccessor`. Assuming project owner configuration, there are no code-level credentials or hardcoded keys leaking into the application. Access is purely managed by Google's metadata server / Application Default Credentials.
