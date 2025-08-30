# バックエンド（Node.js Express）Dockerfile
# Optimized multi-stage build for production

# Stage 1: Base
FROM node:18-alpine AS base
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    sqlite \
    tini \
    && rm -rf /var/cache/apk/*

# Stage 2: Dependencies
FROM base AS deps
# Copy package files
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Stage 3: Development dependencies
FROM base AS dev-deps
COPY package*.json ./
RUN npm ci

# Stage 4: Builder
FROM dev-deps AS builder
COPY . .
# Run tests and build (if needed)
RUN npm test

# Stage 5: Production runner
FROM base AS runner

ENV NODE_ENV=production

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/package*.json ./

# Create directories with proper permissions
RUN mkdir -p /app/data /app/logs /app/uploads && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

# Expose port
EXPOSE 5000

# Use tini for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start the application
CMD ["node", "src/server.js"]