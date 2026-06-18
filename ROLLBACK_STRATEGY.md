# Audium Monorepo Rollback Strategy

## 1. Cloud Run Backend Failure
- **Trigger:** Express API returns continuous 500 errors, or Cloud Run fails to boot due to an invalid MongoDB connection string in Secret Manager.
- **Action:**
  1. Immediately shift 100% of traffic to the last known stable revision:
     `gcloud run services update-traffic audium-api --to-tags=stable=100`
  2. Inspect the `pino-http` structured logs in Cloud Logging for the specific process crash.

## 2. Vertex AI Job Crash
- **Trigger:** ML Container crashes (`sys.exit(1)`) due to malformed metadata, or OOM.
- **Action:**
  1. The API backend automatically catches the `JOB_STATE_FAILED` webhook polling.
  2. The Voice MongoDB status remains `isReady: false`.
  3. No architectural rollback is necessary. Provide the user a generic UI error to re-upload. Inspect Vertex Python logs (`traceId` is synced).

## 3. Storage Architecture Collision
- **Trigger:** The ML container accidentally corrupts or fails to upload the `.pth` to `audium-models`.
- **Action:**
  1. The Node.js `Voice` readiness cache acts as the hard shield. TTS generation is blocked safely with `AUDIUM_MODEL_NOT_READY`.
  2. Delete the specific `{USER_ID}/{VOICE_ID}` GCS folder and re-run training.

## 4. Retrying Deployments
- Ensure all builds target `audium-api:latest` for rolling deploys. GCP natively handles traffic shifting, meaning active users are never disconnected mid-request if the newly compiled container fails its health checks.
