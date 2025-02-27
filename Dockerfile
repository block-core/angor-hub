# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application
COPY . .

# Build the Angular application
RUN npm run build

# Runtime stage
FROM node:22-alpine

WORKDIR /app

# Copy package.json for module configuration
COPY package.json ./

# Copy built application from builder
COPY --from=builder /app/host/dist ./host/dist
COPY --from=builder /app/host/index.js ./host/index.js

# Expose port 3000
EXPOSE 3000

# Start the server with ESM support
CMD ["node", "--experimental-json-modules", "host/index.js"]