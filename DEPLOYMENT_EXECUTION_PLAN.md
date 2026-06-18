# Strict Deployment Execution Plan

## 1. Execution Order

**Step 1: GCP Environment Provisioning**
- **Action:** Execute `./infra/gcp-setup.sh <PROJECT_ID>`
- **Validation:** Verify the 3 GCS buckets and `audium-repo` Artifact registry exist via Cloud Console. Wait 60 seconds for IAM propagation.

**Step 2: ML Container Build & Push**
- **Action:** Execute `gcloud builds submit --tag <ML_IMAGE_URL> ./ml`
- **Validation:** Verify `audium-ml` image appears in Artifact Registry.
- **Rollback:** If Cloud Build crashes due to pip/apt failures, immediately halt execution. Do not deploy backend.

**Step 3: Secrets Binding**
- **Action:** Create `audium-mongodb-uri` and `audium-jwt-secret` explicitly inside Secret Manager and grant the default compute service account `Secret Accessor` rights.

**Step 4: Backend Cloud Run Deployment**
- **Action:** Execute the backend `gcloud run deploy` segment of `./infra/deploy.sh`
- **Validation:** Curl the generated Cloud Run URL `/api/health`. Expect 200 OK.
- **Rollback:** If deployment fails, use `gcloud run revisions list` and revert to the previous traffic tag.

**Step 5: Frontend Hosting Release**
- **Action:** Inject the Cloud Run URL into `.env.production` as `VITE_AUDIUM_API_BASE_URL`. Run `npm run build`. Host `dist/` on Firebase Hosting or Vercel.

**Step 6: End-to-End Smoke Test**
- **Action:** Navigate to live URL. Register account. Upload a 10s audio clip. Click Train. Verify Vertex Job initializes in GCP Console.

## 2. Restart Conditions
- If the Vertex GPU pool is exhausted, delete the enqueued Vertex job and re-trigger training from the React UI 10 minutes later.
