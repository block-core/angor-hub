# syntax=docker/dockerfile:1

#  Build Angular app
FROM node:22-alpine AS builder

WORKDIR /app

# Install deps with npm cache mount 
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline

# Copy source and build (output → host/dist/)
COPY . .
RUN npm run build

#  Production runtime
FROM node:22-alpine AS runtime

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app/host

# Install only the host server's production dependencies
COPY host/package.json host/package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --prefer-offline

# Copy Express server and entrypoint
COPY host/index.js host/entrypoint.sh ./
RUN chmod +x entrypoint.sh

# Copy built Angular SPA from builder
COPY --from=builder /app/host/dist ./dist

# Drop root: run as unprivileged user
RUN addgroup -S angor && adduser -S angor -G angor \
    && chown angor:angor dist/browser/config.js
USER angor

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:3000/ || exit 1

ENTRYPOINT ["./entrypoint.sh"]
