#!/bin/bash
SERVICE_NAME="a-baba-exchange"
REGION="us-central1"
PROJECT_ID=$(gcloud config get-value project)

if [ -z "$PROJECT_ID" ]; then
    echo "❌ Error: No Google Cloud Project detected. Use 'gcloud config set project [ID]'"
    exit 1
fi

API_KEY="AIzaSyDsOLS0D5CRf5hpP-qIKdm4_xvE5fgIVI8"
JWT_SECRET="ababa-secure-cloud-9988-secret"

# Safety Check: Ensure Dockerfile exists
if [ ! -f "Dockerfile" ]; then
    echo "❌ Error: Dockerfile not found!"
    exit 1
fi

echo "⚙️ Configuring gcloud for $PROJECT_ID..."
gcloud config set run/region $REGION --quiet
gcloud config set project $PROJECT_ID --quiet

echo "🚀 Deploying Source to Cloud Run..."
# Using --quiet to prevent interactive prompts that can cause crashes in some environments
gcloud run deploy $SERVICE_NAME \
  --source . \
  --region $REGION \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --set-env-vars GOOGLE_API_KEY=$API_KEY,JWT_SECRET=$JWT_SECRET \
  --quiet
