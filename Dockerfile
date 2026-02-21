# STEP 1: Build the React Frontend
FROM node:20 AS builder
WORKDIR /app

# Copy package files
COPY package*.json ./

# Clean install to avoid lockfile issues
RUN rm -f package-lock.json && npm install

# Copy source and build
COPY . .
# We use --emptyOutDir to ensure a clean build
RUN npx vite build

# STEP 2: Setup the Runtime Environment
FROM node:20
WORKDIR /app

# Install build tools in the runtime stage as well for better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy backend configuration
COPY backend/package*.json ./backend/
RUN cd backend && rm -f package-lock.json && npm install --omit=dev

# Copy the compiled frontend from the builder stage
COPY --from=builder /app/dist ./dist

# Copy the rest of the backend source code
COPY backend/ ./backend/

# Set production environment variables
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Execute the server entry point
CMD ["node", "backend/server.js"]
