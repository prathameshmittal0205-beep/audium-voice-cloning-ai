#!/bin/bash
set -e

PROJECT_ID=$1
REGION="us-central1"

if [ -z "$PROJECT_ID" ]; then
  echo "Usage: ./deploy.sh <PROJECT_ID>"
  exit 1
fi

echo "Deploying Audium to GCP..."

# 1. Build and push ML container to Artifact Registry
ML_IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/audium-repo/audium-xtts-trainer:latest"
echo "Building ML Training Container..."
cd ../ml
gcloud builds submit --tag $ML_IMAGE .

# 2. Build and push Backend API to Cloud Run
echo "Deploying Node.js Backend to Cloud Run..."
cd ../backend

# Note: In a real prod setup, secrets are pulled from Secret Manager securely.
# We map the secrets via gcloud run deploy flags.
gcloud run deploy audium-api \
  --source . \
  --region $REGION \
  --allow-unauthenticated \
  --set-env-vars="AUDIUM_VERTEX_PROJECT_ID=${PROJECT_ID},AUDIUM_VERTEX_LOCATION=${REGION},AUDIUM_BUCKET_DATA=audium-voice-data-${PROJECT_ID},AUDIUM_BUCKET_MODELS=audium-models-${PROJECT_ID},AUDIUM_BUCKET_GENERATED=audium-generated-${PROJECT_ID},AUDIUM_ARTIFACT_REGISTRY_IMAGE=${ML_IMAGE}" \
  --set-secrets="AUDIUM_MONGODB_URI=audium-mongodb-uri:latest,AUDIUM_JWT_SECRET=audium-jwt-secret:latest"

echo "Deployment complete! Backend is live on Cloud Run."
echo "Ensure your Vertex AI Endpoint is deployed and its ID is mapped to AUDIUM_VERTEX_ENDPOINT_ID if not already set."
