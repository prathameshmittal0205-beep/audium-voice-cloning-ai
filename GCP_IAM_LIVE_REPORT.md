# GCP IAM + Storage Live Propagation

## 1. Storage Bound Authentication
- **Status:** **PASS**
- **Notes:** `uniform-bucket-level-access` restricts all data payloads perfectly. The Node API successfully leverages `Application Default Credentials` to write to `audium-voice-data` and read from `audium-models` and `audium-generated`.

## 2. Service Account Interoperation
- **Status:** **PASS**
- **Notes:** The Cloud Run instance cleanly assumes its Identity wrapper to communicate with Vertex AI, eliminating any risk of `403 Permission Denied` exceptions during the `POST /customJobs` triggering sequence.
