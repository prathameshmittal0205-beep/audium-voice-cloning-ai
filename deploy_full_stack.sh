#!/bin/bash
set -e

PROJECT_ID=$1
REGION="us-central1"

if [ -z "$PROJECT_ID" ]; then
  echo "Usage: ./deploy_full_stack.sh <PROJECT_ID>"
  exit 1
fi

echo "=== AUDIUM FULL STACK GCP DEPLOYMENT ==="
gcloud config set project $PROJECT_ID

echo "[1/6] Enabling APIs..."
gcloud services enable \
  storage.googleapis.com \
  aiplatform.googleapis.com \
  artifactregistry.googleapis.com \
  run.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com

echo "[2/6] Creating Strict GCS Buckets..."
BUCKET_DATA="audium-voice-data-${PROJECT_ID}"
BUCKET_MODELS="audium-models-${PROJECT_ID}"
BUCKET_GENERATED="audium-generated-${PROJECT_ID}"

for BUCKET in $BUCKET_DATA $BUCKET_MODELS $BUCKET_GENERATED; do
  gsutil mb -p $PROJECT_ID -l $REGION gs://$BUCKET || echo "Bucket $BUCKET already exists"
  gsutil uniform-bucket-level-access set on gs://$BUCKET
done

echo "[3/6] Configuring Artifact Registry..."
gcloud artifacts repositories create audium-repo \
  --repository-format=docker \
  --location=$REGION \
  --description="Audium Repository" || echo "Repository already exists"

echo "[4/6] Assigning IAM Roles to Default Compute Service Account..."
PROJECT_NUM=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
COMPUTE_SA="${PROJECT_NUM}-compute@developer.gserviceaccount.com"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$COMPUTE_SA" \
  --role="roles/storage.objectAdmin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$COMPUTE_SA" \
  --role="roles/aiplatform.user"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$COMPUTE_SA" \
  --role="roles/secretmanager.secretAccessor"

echo "[5/6] Building and Pushing ML Container to Artifact Registry..."
ML_IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/audium-repo/audium-ml:latest"
gcloud builds submit --tag $ML_IMAGE ./ml

echo "[6/6] Deploying Express Backend to Cloud Run..."
gcloud run deploy audium-api \
  --source ./backend \
  --region $REGION \
  --allow-unauthenticated \
  --memory 1024Mi \
  --set-env-vars="AUDIUM_VERTEX_PROJECT_ID=${PROJECT_ID},AUDIUM_VERTEX_LOCATION=${REGION},AUDIUM_BUCKET_DATA=${BUCKET_DATA},AUDIUM_BUCKET_MODELS=${BUCKET_MODELS},AUDIUM_BUCKET_GENERATED=${BUCKET_GENERATED},AUDIUM_ARTIFACT_REGISTRY_IMAGE=${ML_IMAGE}" \
  --set-secrets="AUDIUM_MONGODB_URI=audium-mongodb-uri:latest,AUDIUM_JWT_SECRET=audium-jwt-secret:latest"

echo "=== DEPLOYMENT COMPLETE ==="
API_URL=$(gcloud run services describe audium-api --region $REGION --format="value(status.url)")
echo "Audium API is live at: $API_URL"
echo "Inject this URL into frontend/.env.production as VITE_AUDIUM_API_BASE_URL=$API_URL/api"
