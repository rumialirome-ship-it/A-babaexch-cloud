# STEP 1: Build the React Frontend
FROM node:20-bookworm AS builder
WORKDIR /app

# Copy package files
COPY package*.json ./

# Remove lockfile to avoid platform-specific issues
RUN rm -f package-lock.json

# Install build dependencies
RUN npm install

# Copy source and build the static dist folder
COPY . .
RUN npm run build

# STEP 2: Setup the Runtime Environment
FROM node:20-bookworm-slim
WORKDIR /app

# Install runtime dependencies for better-sqlite3
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy backend configuration and install production dependencies
COPY backend/package*.json ./backend/

# Remove lockfile
RUN rm -f backend/package-lock.json

# Install production dependencies
RUN cd backend && npm install --omit=dev

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
