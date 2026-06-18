# Audium Real Deployment Runbook

## 1. Environment Preparation
Ensure you are authenticated with GCP and have billing enabled.
```bash
gcloud auth login
gcloud auth application-default login
gcloud config set project <YOUR_PROJECT_ID>
```

## 2. Secrets Provisioning
Before deploying, you MUST manually push your MongoDB and JWT secrets to Secret Manager.
```bash
echo -n "mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/audium" | gcloud secrets create audium-mongodb-uri --data-file=-
echo -n "your-secure-jwt-secret-key" | gcloud secrets create audium-jwt-secret --data-file=-
```

## 3. Full Stack Execution
Execute the automated deployment script from the root directory.
```bash
chmod +x deploy_full_stack.sh
./deploy_full_stack.sh <YOUR_PROJECT_ID>
```

## 4. Frontend Deployment Strategy
Once Cloud Run deploys, it will output a Service URL (e.g., `https://audium-api-xyz.a.run.app`).
1. Navigate to your `frontend/` directory.
2. Create or update `.env.production` with:
   `VITE_AUDIUM_API_BASE_URL=https://audium-api-xyz.a.run.app/api`
3. Build the frontend:
   `npm run build`
4. Deploy the `/dist` output to Firebase Hosting or Vercel.

## 5. Post-Deployment Verification
Execute the verification script to validate runtime boundaries.
```bash
chmod +x verify_deployment.sh
./verify_deployment.sh <YOUR_PROJECT_ID>
```
