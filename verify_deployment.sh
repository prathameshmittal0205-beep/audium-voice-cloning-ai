#!/bin/bash
PROJECT_ID=$1
REGION="us-central1"

if [ -z "$PROJECT_ID" ]; then
  echo "Usage: ./verify_deployment.sh <PROJECT_ID>"
  exit 1
fi

echo "=== POST-DEPLOYMENT VERIFICATION ==="

# 1. Cloud Run Health Check
API_URL=$(gcloud run services describe audium-api --region $REGION --format="value(status.url)")
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/health")

if [ "$HTTP_STATUS" == "200" ]; then
  echo -e "\033[32m[GREEN]\033[0m Cloud Run & MongoDB Connection (200 OK)"
else
  echo -e "\033[31m[RED]\033[0m Cloud Run Health Check Failed ($HTTP_STATUS)"
fi

# 2. GCS Bucket Accessibility
BUCKET_DATA="audium-voice-data-${PROJECT_ID}"
if gsutil ls gs://$BUCKET_DATA > /dev/null 2>&1; then
  echo -e "\033[32m[GREEN]\033[0m GCS Bucket $BUCKET_DATA is accessible"
else
  echo -e "\033[31m[RED]\033[0m GCS Bucket $BUCKET_DATA inaccessible (Check IAM/Names)"
fi

# 3. Artifact Registry Image Check
ML_IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/audium-repo/audium-ml:latest"
if gcloud container images describe $ML_IMAGE > /dev/null 2>&1; then
  echo -e "\033[32m[GREEN]\033[0m ML Container exists in Artifact Registry"
else
  echo -e "\033[31m[RED]\033[0m ML Container missing in Artifact Registry"
fi

echo "Verification Complete."
