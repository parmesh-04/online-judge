# Purpose: Production Dockerfile for the compiler service.
# Includes docker-cli so this container can launch sibling containers
# via the host's Docker socket for sandboxed code execution.

FROM node:20-alpine

# Install curl for health checks AND docker-cli for code execution
RUN apk add --no-cache curl docker-cli

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

# Set ownership
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:8000/ || exit 1

EXPOSE 8000

CMD ["node", "server.js"]
