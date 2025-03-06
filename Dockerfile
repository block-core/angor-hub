# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies)
RUN npm ci

# Copy the rest of the application
COPY . .

# Build the Angular application
RUN npm run build

# Runtime stage
FROM node:22-alpine

WORKDIR /app

# Copy both package.json and package-lock.json
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built application and server files
COPY --from=builder /app/host/dist ./host/dist
COPY --from=builder /app/host/index.js ./host/index.js

# Expose port 3000
EXPOSE 3000

# Start the server
CMD ["node", "--experimental-json-modules", "host/index.js"]
