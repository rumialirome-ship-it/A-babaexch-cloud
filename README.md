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

## 🚀 Deployment to Google Cloud Run
Run the included deployment script to push your code to the cloud:
```bash
chmod +x deploy.sh
./deploy.sh
```

---

## 🌐 Connecting to Your Domain: citylott.com
To ensure your app runs perfectly on all devices (especially mobile), follow these domain steps:

### 1. Verification Checklist
- **DNS Typo?**: Ensure you mapped the correct spelling (`citylott.com` vs `cittylott.com`). Check your domain registrar dashboard.
- **Propagation**: DNS changes can take **24-48 hours** to work on all mobile networks. Some devices use cached DNS.
- **SSL Status**: If a device shows "This connection is not private," Google is still generating your SSL certificate. Wait 1 hour.

### 2. Why is it not running on some devices?
- **Private Mode**: Some older iPhones block "LocalStorage" in Private/Incognito mode. We have added a fix, but for best results, use a normal browser tab.
- **Old iOS**: Ensure the device is running at least iOS 12.0+.
- **Carrier Blocking**: Some mobile networks (especially in restricted regions) might block Google Cloud IPs. Try switching from Mobile Data to Wi-Fi to test.

### 3. DNS Records for citylott.com
Ensure your Registrar (GoDaddy/Namecheap) has these records from the Cloud Run "Custom Domains" tab:
1. **A Records**: Point `@` to the 4 Google IPs provided.
2. **AAAA Records**: Point `@` to the 4 IPv6 addresses provided (Critical for mobile devices).
3. **CNAME**: Point `www` to `citylott.com`.

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