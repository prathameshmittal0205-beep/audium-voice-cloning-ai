#!/bin/bash
set -e

# Audium GCP Infrastructure Setup Script
PROJECT_ID=$1
REGION="us-central1"
BUCKET_DATA="audium-voice-data-$PROJECT_ID"
BUCKET_MODELS="audium-models-$PROJECT_ID"
BUCKET_GENERATED="audium-generated-$PROJECT_ID"

if [ -z "$PROJECT_ID" ]; then
  echo "Usage: ./gcp-setup.sh <PROJECT_ID>"
  exit 1
fi

echo "Setting up Audium infrastructure in project: $PROJECT_ID ($REGION)"

gcloud config set project $PROJECT_ID

echo "Enabling necessary APIs..."
gcloud services enable \
  storage.googleapis.com \
  aiplatform.googleapis.com \
  artifactregistry.googleapis.com \
  run.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com

echo "Creating GCS Buckets..."
gsutil mb -p $PROJECT_ID -l $REGION gs://$BUCKET_DATA || echo "Data Bucket already exists"
gsutil uniform-bucket-level-access set on gs://$BUCKET_DATA

gsutil mb -p $PROJECT_ID -l $REGION gs://$BUCKET_MODELS || echo "Models Bucket already exists"
gsutil uniform-bucket-level-access set on gs://$BUCKET_MODELS

gsutil mb -p $PROJECT_ID -l $REGION gs://$BUCKET_GENERATED || echo "Generated Bucket already exists"
gsutil uniform-bucket-level-access set on gs://$BUCKET_GENERATED

echo "Creating Artifact Registry repository..."
gcloud artifacts repositories create audium-repo \
  --repository-format=docker \
  --location=$REGION \
  --description="Audium Docker repository" || echo "Repo already exists"

echo "Setting up IAM for default compute service account..."
PROJECT_NUM=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
COMPUTE_SA="${PROJECT_NUM}-compute@developer.gserviceaccount.com"

# Storage Object Admin for reading/writing audio
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$COMPUTE_SA" \
  --role="roles/storage.objectAdmin"

# Vertex AI User for triggering training and endpoint inference
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$COMPUTE_SA" \
  --role="roles/aiplatform.user"

# Secret Manager Secret Accessor for reading env vars at runtime
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$COMPUTE_SA" \
  --role="roles/secretmanager.secretAccessor"

echo "Infrastructure setup complete!"
echo "Next steps:"
echo "1. Push secrets (AUDIUM_MONGODB_URI, AUDIUM_JWT_SECRET) to Secret Manager"
echo "2. Run deploy.sh to build and deploy ML containers and Cloud Run services"
