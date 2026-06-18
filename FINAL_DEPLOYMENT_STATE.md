# Pre-Deployment Final State Snapshot

## 1. Backend Runtime Configuration
- **Compute Layer:** Google Cloud Run
- **Runtime:** `node:20-slim` (Explicit Dockerfile)
- **Networking:** Explicitly bound to `0.0.0.0:8080`.
- **Secrets Management:** Sourced natively via `gcloud run deploy --set-secrets` (mapping MongoDB URI and JWT Keys).
- **Core Security:** JWT middleware on all operational endpoints.
- **Observability:** `pino-http` outputting structured JSON logs, tracing natively passed to the ML payload via `req.id`.

## 2. Frontend Build Configuration
- **Framework:** React + Vite
- **Build Output:** Optimized vanilla JS bundle via `npm run build`.
- **Network Coupling:** API explicitly routed via `VITE_AUDIUM_API_BASE_URL` bypassing all React dev constraints. Local state degrades gracefully on HTTP 400s (`AUDIUM_MODEL_NOT_READY`).

## 3. ML Container Build State
- **Base Environment:** `us-docker.pkg.dev/vertex-ai/training/pytorch-gpu.2-1:latest`
- **Dependency Map:** `openai-whisper`, `TTS==0.22.0`, `google-cloud-storage==2.14.0`, secured by deterministic `requirements.txt`.
- **VRAM Control:** FFMPEG + CPU-bound Whisper preprocessing ensures 16GB T4 CUDA isolation strictly for the XTTS adaptation.

## 4. Infrastructure Script Flow
- **`gcp-setup.sh`:** Idempotent generation of 3 strict-ACL GCS buckets and 1 Artifact Registry repository.
- **`deploy.sh`:** Submits the ML container via Cloud Build and subsequently pushes the Node.js API to Cloud Run.
