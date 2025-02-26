FROM --platform=$TARGETPLATFORM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application
COPY . .

# Build the Angular application
RUN npm run build

# Expose port 3000
EXPOSE 3000

# Start the server
CMD ["node", "host/index.js"]
