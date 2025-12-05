FROM node:18 AS builder
WORKDIR /app

# Install dependencies with retry logic and delays for npm registry issues
COPY package*.json ./
# Retry npm install with delays to handle transient registry errors
# Add delays between retries to give npm registry time to recover
RUN npm install || (sleep 10 && npm install) || (sleep 15 && npm install) || (sleep 20 && npm install)

# Copy source
COPY . .

# Build step
RUN npm run build

# Production image
FROM node:18 AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Copy the built application
COPY --from=builder /app ./

# Expose Cloud Run port
EXPOSE 8080

# Start the app using the package.json start script
CMD ["npm", "start"]

