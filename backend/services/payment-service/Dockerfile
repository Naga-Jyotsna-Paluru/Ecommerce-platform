# ============================================================
# Payment Service Dockerfile
# Same multi-stage pattern as all other services
# Port: 3005
# ============================================================

# Stage 1: Install all dependencies (including dev)
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

# Stage 2: Lean production image
FROM node:20-alpine AS production

RUN apk update && apk upgrade && rm -rf /var/cache/apk/*

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs src/ ./src/
COPY --chown=nodejs:nodejs package.json ./

USER nodejs

EXPOSE 3005

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3005/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "src/server.js"]
