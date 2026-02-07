# STEP 1: Build the React Frontend
FROM node:20-slim AS builder
WORKDIR /app

# Install build dependencies for the root (Vite)
COPY package*.json ./
RUN npm install

# Copy source and build the static dist folder
COPY . .
RUN npm run build

# STEP 2: Setup the Runtime Environment
FROM node:20-slim
WORKDIR /app

# Install system dependencies required to compile better-sqlite3 native bindings
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy backend configuration and install production dependencies
# This is isolated to optimize Docker layer caching
COPY backend/package*.json ./backend/
RUN cd backend && npm install --omit=dev

# Copy the compiled frontend from the builder stage to the location expected by server.js
COPY --from=builder /app/dist ./dist

# Copy the rest of the backend source code
COPY backend/ ./backend/

# Set production environment variables
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Execute the server entry point
CMD ["node", "backend/server.js"]