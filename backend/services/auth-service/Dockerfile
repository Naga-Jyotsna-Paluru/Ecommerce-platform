# ============================================================
# Multi-stage Dockerfile for Node.js microservices
# ============================================================
#
# MULTI-STAGE BUILD explained:
# Stage 1 (builder): Install ALL dependencies including devDependencies
# Stage 2 (production): Copy only production artifacts — smaller, more secure image
#
# Result: Production image ~200MB instead of ~600MB
# No dev tools, test frameworks, or source maps in production

# Stage 1: Install dependencies
FROM node:20-alpine AS builder

# Set working directory inside the container
WORKDIR /app

# Copy package files first — Docker caches this layer
# If package.json doesn't change, npm install won't re-run on rebuild
COPY package*.json ./

# Install all deps (including dev) for the build stage
RUN npm ci --frozen-lockfile

# Stage 2: Production image
FROM node:20-alpine AS production

# Install security updates
RUN apk update && apk upgrade && rm -rf /var/cache/apk/*

# Create a non-root user — running as root in a container is a security risk
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

WORKDIR /app

# Copy only production node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application source
COPY --chown=nodejs:nodejs src/ ./src/
COPY --chown=nodejs:nodejs package.json ./

# Switch to non-root user
USER nodejs

# Expose port (documentation — doesn't actually publish)
EXPOSE 3001

# Health check — Docker uses this to know if the container is healthy
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start the application
CMD ["node", "src/server.js"]
