# Purpose: Production Dockerfile for the Express.js backend API.
# Uses non-root user for security and includes a health check.

FROM node:20-alpine

# Install curl for health checks
RUN apk add --no-cache curl

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Create non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy package files and install production dependencies
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Copy source files
COPY . .

# Create logs directory
RUN mkdir -p logs && chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Health check — Docker will restart container if this fails
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

EXPOSE 5000

CMD ["node", "server.js"]
