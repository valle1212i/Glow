FROM node:18 AS builder
WORKDIR /app

# Install dependencies with retry logic for npm registry issues
COPY package*.json ./
# Retry npm install up to 3 times if it fails due to registry errors
RUN npm install || npm install || npm install

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

