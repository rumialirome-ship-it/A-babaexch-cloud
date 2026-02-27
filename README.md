
# 🎯 A-Baba Exchange — Setup & Deployment Guide

## 🔍 Where are my AI Studio files in the Shell?
The files you see in the AI Studio side panel correspond to specific locations in your Google Cloud Shell project. Use the map below to find them:

### 1. The Root Folder (`/`)
*Contains UI configuration and project settings.*
- **index.tsx / App.tsx**: Your main React interface code.
- **index.html**: The master HTML file.
- **Dockerfile**: The build instructions for Cloud Run.
- **package.json**: Lists your frontend libraries (React, Vite).

### 2. The Backend Folder (`/backend`)
*Navigate using `cd backend`. This is the "Server" side.*
- **server.js**: The main API engine.
- **database.js**: Your SQLite logic.
- **database.sqlite**: Your live database file.

---

## 💰 Google Cloud Pricing (Estimated)

Google Cloud offers a generous **Free Tier**. For a small to medium betting app, your monthly cost is likely to be **$0 to $10**, depending on traffic.

| Service | Free Tier | Cost After Free Tier |
| :--- | :--- | :--- |
| **Cloud Run** | 2M requests/mo | ~$0.01 per 10k requests |
| **Cloud Build** | 120 mins/day | $0.003 per minute |
| **Artifact Registry** | 0.5 GB storage | $0.10 per GB/mo |
| **Networking** | 1 GB egress/mo | $0.12 per GB |

> [!CAUTION]
> **SQLite Persistence Warning**: By default, Cloud Run containers are "stateless." This means if your app restarts or scales down, **your SQLite database will be wiped**. 
> **Solution**: For a real production app, you should migrate to **Google Cloud SQL (Postgres/MySQL)** or use a **Persistent Disk** mount.

---

## 🚀 Step-by-Step Deployment Guide

Follow these exact steps to get your app live on Google Cloud:

### 1. Prepare Your Environment
1.  Open [Google Cloud Console](https://console.cloud.google.com/).
2.  Create a **New Project** (e.g., `ababa-exchange`).
3.  Enable **Billing** for your project.
4.  Open the **Cloud Shell** (the `>_` icon in the top right).

### 2. Upload Your Code
1.  In Cloud Shell, create a directory: `mkdir ababa && cd ababa`
2.  Upload your files from AI Studio to this folder.
3.  Ensure you have the `Dockerfile` and `deploy.sh` in the root.

### 3. Initialize GCloud
Run this in the Cloud Shell terminal:
```bash
gcloud init
```
*Select your project and default region (e.g., `us-central1` or `asia-east1`).*

### 4. Run the Deployment Script
```bash
# Make the script executable
chmod +x deploy.sh

# Run the deployment
./deploy.sh
```
*This script will build your Docker image, push it to the registry, and deploy it to Cloud Run.*

### 5. Set Environment Variables
In the Cloud Run console, go to **Edit & Deploy New Revision** > **Variables & Secrets**:
- Add `GEMINI_API_KEY` (if using AI features).
- Add any other keys defined in your `.env.example`.

---

## 🌐 Connecting to Your Domain: citylott.com

### ⚠️ IMPORTANT: Fixing www.citylott.com
To make both `citylott.com` and `www.citylott.com` work, you must map **BOTH** in the Google Cloud Console.

1.  **Google Cloud Console**:
    *   Go to **Cloud Run** > Select your service.
    *   Click **Manage Custom Domains**.
    *   Add a mapping for `citylott.com`.
    *   Add **another** mapping for `www.citylott.com`.

2.  **DNS Provider (GoDaddy/Namecheap)**:
    *   **For citylott.com**: Add the **A** and **AAAA** records provided by Google.
    *   **For www.citylott.com**: Add a **CNAME** record:
        *   **Host**: `www`
        *   **Value**: `ghs.googlehosted.com.` (include the dot at the end).

### 1. Verification Checklist
- **DNS Typo?**: Ensure you mapped the correct spelling (`citylott.com`). Check your domain registrar dashboard.
- **Propagation**: DNS changes can take **24-48 hours** to work on all mobile networks.
- **SSL Status**: If a device shows "This connection is not private," Google is still generating your SSL certificate. Wait 1 hour.

### 2. Why is it not running on some devices?
- **Private Mode**: Some older iPhones block "LocalStorage" in Private/Incognito mode.
- **Old iOS**: Ensure the device is running at least iOS 12.0+.
- **Carrier Blocking**: Some mobile networks might block Google Cloud IPs. Try switching from Mobile Data to Wi-Fi to test.

---

## 🛠 File Replacement Guide (Cloud Shell)
If you are moving files from AI Studio to your Shell, use these commands:

1. **Delete old structure**:
   ```bash
   rm -rf backend components hooks *.ts *.tsx *.json *.js *.css *.html .dockerignore Dockerfile deploy.sh
   ```
2. **Re-create folders**:
   ```bash
   mkdir -p backend components hooks
   ```
3. **Install and Setup**:
   ```bash
   npm install && cd backend && npm install && cd ..
   ```

© 2024 A-Baba Exchange Technical Ops.
