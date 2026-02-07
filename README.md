# 🎯 A-Baba Exchange — Setup & Deployment Guide

## 🔍 Where are my AI Studio files in the Shell?
The files you see in the AI Studio side panel correspond to specific locations in your Google Cloud Shell project. Use the map below to find them:

### 1. The Root Folder (`/`)
*Contains UI configuration and project settings.*
- **index.tsx / App.tsx**: Your main React interface code.
- **index.html**: The master HTML file.
- **Dockerfile**: (Renamed from Dockerfile.js) The build instructions for Cloud Run.
- **package.json**: Lists your frontend libraries (React, Vite).

### 2. The Backend Folder (`/backend`)
*Navigate using `cd backend`. This is the "Server" side.*
- **server.js**: The main API engine.
- **database.js**: Your SQLite logic.
- **database.sqlite**: Your live database file (will appear after first run).

### 3. The Components Folder (`/components`)
*Contains the UI panels.*
- **AdminPanel.tsx**, **DealerPanel.tsx**, **UserPanel.tsx**.

---

## 🛠 Step 0: File Replacement Guide
If you are moving files from AI Studio to your Shell, follow these terminal commands:

1. **Delete old structure**:
   ```bash
   rm -rf backend components hooks *.ts *.tsx *.json *.js *.css *.html .dockerignore Dockerfile deploy.sh
   ```
2. **Re-create folders**:
   ```bash
   mkdir -p backend components hooks
   ```
3. **Copy/Paste Tip**: Open the file in the Cloud Shell Editor (the pencil icon), create a new file with the exact same name, and paste the code from AI Studio.

4. **Install and Setup**:
   ```bash
   npm install && cd backend && npm install && cd ..
   ```

---

## 🚀 Deployment Fix (Build Failed)
If your build failed, it was likely because the file was named `Dockerfile.js` instead of `Dockerfile`. I have fixed this. To deploy now:

```bash
chmod +x deploy.sh
./deploy.sh
```

### 📋 Deployment Specs
- **Memory**: 2Gi
- **CPU**: 2 vCPUs
- **Region**: us-central1
- **API Key**: Automatically uses the key in `deploy.sh`.

© 2024 A-Baba Exchange Technical Ops.