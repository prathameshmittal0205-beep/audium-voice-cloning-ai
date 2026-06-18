# Disaster Recovery Playbook

## 1. Cloud Run Rollback Strategy
If the backend crashes repeatedly (e.g., MongoDB URI rotation failure):
1. Identify the last known good revision:
   `gcloud run revisions list --service audium-api --region us-central1`
2. Shift 100% of traffic immediately to the stable revision:
   `gcloud run services update-traffic audium-api --to-revisions=audium-api-xxxxx=100 --region us-central1`

## 2. Vertex AI Job Cancellation Strategy
If an ML container hangs or causes runaway billing loops:
1. List active training jobs:
   `gcloud ai custom-jobs list --region us-central1`
2. Cancel the runaway job:
   `gcloud ai custom-jobs cancel <JOB_ID> --region us-central1`

## 3. GCS Artifact Rollback
If a corrupted `.pth` model is uploaded by the ML container and breaks inference:
1. Delete the specific voice artifact directory:
   `gsutil rm -r gs://audium-models-<PROJECT_ID>/<USER_ID>/<VOICE_ID>`
2. The Node.js Express backend will safely fallback to returning `AUDIUM_MODEL_NOT_READY` for that specific voice, completely shielding the rest of the application.

## 4. MongoDB Fallback
If the MongoDB primary cluster goes down:
The connection is established via `mongoose.connect()`. Ensure the connection string includes `?retryWrites=true&w=majority`. Cloud Run will organically restart failing instances and safely re-establish connection pools once the cluster auto-recovers.
