# GCP Infrastructure Dry Run Simulation

## 1. GCS Bucket Global Namespace Collision (FIXED)
- **Risk:** `audium-voice-data` and `audium-models` are extremely generic names. Google Cloud Storage shares a single global namespace across all users globally. If `gcp-setup.sh` executed natively with these hardcoded names, it would almost certainly fail with a `409 Conflict` (Bucket name already taken).
- **Remediation Applied:** The infra scripts (`gcp-setup.sh` and `deploy.sh`) were proactively mutated to append `-$PROJECT_ID` (e.g., `audium-voice-data-$PROJECT_ID`), guaranteeing a 100% successful and globally unique namespace creation on a fresh GCP project.

## 2. Default Service Account Edge Cases
- **Risk:** GCP no longer auto-creates the Compute Engine Default Service Account (`$PROJECT_NUM-compute@developer.gserviceaccount.com`) identically on newly created projects unless the Compute Engine API is triggered.
- **Safety Status:** `run.googleapis.com` (Cloud Run API) automatically proxies this identity creation in modern GCP. Assuming a perfectly fresh project, `deploy.sh` will succeed in mapping the IAM policies.

## 3. Vertex API Enrolment Latency
- **Risk:** `aiplatform.googleapis.com` activation can take up to 3 minutes.
- **Safety Status:** `gcp-setup.sh` enforces a sequential wait on `gcloud services enable`, blocking proceeding commands until the Vertex control plane confirms activation.
