#!/bin/bash
SERVICE_NAME="a-baba-exchange"
REGION="us-central1"
PROJECT_ID=$(gcloud config get-value project)
API_KEY="AIzaSyDsOLS0D5CRf5hpP-qIKdm4_xvE5fgIVI8"
JWT_SECRET="ababa-secure-cloud-9988-secret"

# Safety Check: Ensure Dockerfile is named correctly
if [ -f "Dockerfile.js" ]; then
    echo "⚠️ Renaming Dockerfile.js to Dockerfile..."
    mv Dockerfile.js Dockerfile
fi

if [ ! -f "Dockerfile" ]; then
    echo "❌ Error: Dockerfile not found! Please ensure it is in the root directory."
    exit 1
fi

echo "🚀 Deploying to $PROJECT_ID..."
gcloud run deploy $SERVICE_NAME \
  --source . \
  --region $REGION \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --set-env-vars GOOGLE_API_KEY=$API_KEY,JWT_SECRET=$JWT_SECRET