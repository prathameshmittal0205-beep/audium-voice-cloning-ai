# Real-World GCP Failure Point Map

## 1. Vertex AI GPU Exhaustion / Quota [HIGH PROBABILITY]
- **Risk:** Google Cloud frequently runs out of standard `NVIDIA_TESLA_T4` capacity in `us-central1` during peak hours.
- **Impact:** The CustomJob API payload returns `200 OK` (enqueuing the job), but the job remains in `JOB_STATE_PENDING` for 1-4 hours before the Cloud backend drops it or it times out entirely.

## 2. Cloud Run CPU Throttling on Cold Starts [MEDIUM PROBABILITY]
- **Risk:** Upon receiving the first POST request in 15 minutes, Cloud Run must pull the Node.js container, boot the node process, and establish a new MongoDB TLS connection.
- **Impact:** The initial API request may exceed a 3-5 second threshold, causing native browser Axios timeouts if the frontend client isn't configured for extended polling.

## 3. GCS IAM Eventual Consistency [LOW PROBABILITY]
- **Risk:** New project buckets and IAM bindings created via `gcp-setup.sh` may experience up to a 60-second propagation delay.
- **Impact:** If `deploy.sh` immediately tests a write right after execution, `gcloud` might return an ephemeral `403 Permission Denied` despite correct roles.

## 4. Docker Image Pull Latency [LOW PROBABILITY]
- **Risk:** Vertex AI must pull the 8GB+ `pytorch-gpu` underlying image + the custom ML layers during boot.
- **Impact:** Boot times for the ML container can take 5-8 minutes before actual code execution begins.
