# 🎯 A-Baba Exchange — Setup & Deployment Guide

## 🛠 Step 0: Replacement Guide (Read First)
To replace your existing project files with this version in your Google Cloud Shell:

1. **Clean the directory**:
   ```bash
   rm -rf backend components hooks *.ts *.tsx *.json *.js *.css *.html .dockerignore Dockerfile deploy.sh
   ```
2. **Re-create the structure**:
   ```bash
   mkdir -p backend components hooks
   ```
3. **Paste the contents**: Open each file in the AI Studio editor, copy the content, and save it into the corresponding file path in your environment.
4. **Install Dependencies**:
   ```bash
   npm install && cd backend && npm install && cd ..
   ```
5. **Initialize Database**:
   ```bash
   cd backend && npm run db:setup && cd ..
   ```

---

## 📂 Project File Map (Finding your files in Shell)
In your Google Cloud Shell project folder, the files are organized as follows:

### 🌐 Root Directory (Frontend & Build)
These files control the User Interface and the project build settings.
- `index.tsx` & `App.tsx`: The main React entry points.
- `index.html`: The base HTML template.
- `constants.tsx`: Logos, colors, and global icons.
- `types.ts`: Data structures for Users, Bets, and Games.
- `package.json`: Frontend library dependencies.
- `vite.config.ts` & `tailwind.config.js`: Build and styling configurations.
- `Dockerfile`: Instructions for Google Cloud to build your container.

### 🖥️ /backend Directory (Server & Database)
Navigate here using `cd backend`. These files control the "brain" of the app.
- `server.js`: The Express API server (the main backend file).
- `database.js`: Logic for SQLite database queries.
- `authMiddleware.js`: Security logic for logins.
- `setup-database.js`: Script to initialize your DB from `db.json`.
- `database.sqlite`: **(Generated)** This is your actual live database file.

### 🧩 /components & /hooks
- `components/`: Individual UI panels (AdminPanel.tsx, DealerPanel.tsx, etc.).
- `hooks/`: Functional logic for Auth and Countdowns.

### 🔍 Useful Shell Commands
- **List all files**: `ls -R`
- **Go to Backend**: `cd backend`
- **Go back to Root**: `cd ..`
- **Check if DB exists**: `ls backend/*.sqlite`

---

## 🚀 Google Cloud Deployment

### 1. Enable Cloud APIs
```bash
gcloud services enable run.googleapis.com \
                       containerregistry.googleapis.com \
                       cloudbuild.googleapis.com
```

### 2. Deploy to Cloud Run
Run the included `deploy.sh` script:
```bash
chmod +x deploy.sh
./deploy.sh
```

### 📋 Deployment Specs
- **Memory**: 2Gi (Required for Vite build and SQLite compilation)
- **CPU**: 2 vCPUs
- **Region**: us-central1
- **Runtime**: Node.js 20

---

## 🔒 Security Best Practices
- **JWT_SECRET**: Change the secret in `deploy.sh` to a long random string.
- **SQLite Persistence**: Cloud Run storage is temporary. For permanent data, migrate the `database.js` logic to use Google Cloud SQL (MySQL/PostgreSQL).
- **API Key**: Ensure the `GOOGLE_API_KEY` in `deploy.sh` is your active Gemini API key.

© 2024 A-Baba Exchange Technical Ops.