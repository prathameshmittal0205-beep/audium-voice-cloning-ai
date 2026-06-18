# Failure Recovery & Resilience

## 1. Vertex AI Recovery
- **Status:** **PASS**
- **Notes:** `restartJobOnCustomJobNodeRestart: false` ensures that if a Node crashes due to extreme OOM conditions, the pipeline will fail cleanly rather than looping infinitely and burning GCP billing credits. 

## 2. Missing Model Resilience
- **Status:** **PASS**
- **Notes:** GCS latency or missing model blobs are gracefully intercepted by the fast `Voice` DB cache in the backend. If inference is requested prematurely, it safely rejects with `AUDIUM_MODEL_NOT_READY` and the React UI correctly notifies the user rather than hanging indefinitely.
