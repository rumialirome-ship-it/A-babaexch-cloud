
#!/bin/bash
SERVICE_NAME="a-baba-exchange"
REGION="us-central1"
PROJECT_ID=$(gcloud config get-value project)
API_KEY="AIzaSyDsOLS0D5CRf5hpP-qIKdm4_xvE5fgIVI8"
JWT_SECRET="ababa-secure-cloud-9988-secret"

echo "🚀 Deploying to $PROJECT_ID..."
gcloud run deploy $SERVICE_NAME \
  --source . \
  --region $REGION \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --set-env-vars GOOGLE_API_KEY=$API_KEY,JWT_SECRET=$JWT_SECRET
