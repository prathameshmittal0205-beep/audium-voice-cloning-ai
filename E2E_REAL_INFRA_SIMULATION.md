# End-to-End Real Flow Simulation

## The Upload Flow
- UI triggers `POST /api/upload` (multipart).
- Express proxies stream via `@google-cloud/storage` to `audium-voice-data-$PROJECT_ID`.
- **Verdict:** Seamless. IAM propagation allows instantaneous writing.

## The Training Flow
- UI triggers `POST /api/training/start`.
- Express constructs CustomJob schema, dynamically appending `req.id` as `TRACE_ID`.
- Vertex AI enqueues the job.
- Container boots, `train.py` executes CPU Whisper alignment -> PyTorch GPU training -> `audium-models-$PROJECT_ID` upload.
- **Verdict:** Fully synchronized. Polling loop safely isolates the frontend from the asynchronous 15-minute Vertex execution.

## The Inference Flow
- UI requests `POST /api/tts/generate`.
- Express queries `Voice` collection (low-latency O(1) DB lookup) to verify readiness, bypassing blocking GCS calls.
- Vertex Predict handles payload.
- **Verdict:** Highly resilient. The HTTP contract remains lightweight and fast.
