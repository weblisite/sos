# Multi-stage build for optimized production image
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY shared/package.json ./shared/

# Install dependencies
RUN npm ci --legacy-peer-deps --no-audit --no-fund

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Verify backend/dist/index.js exists
RUN if [ ! -f backend/dist/index.js ]; then \
      echo "ERROR: backend/dist/index.js not found!"; \
      echo "Contents of backend/:"; \
      ls -la backend/ || true; \
      echo "Contents of backend/dist/:"; \
      ls -la backend/dist/ || true; \
      echo "Checking if backend/dist exists:"; \
      test -d backend/dist && echo "backend/dist exists" || echo "backend/dist does NOT exist"; \
      exit 1; \
    else \
      echo "✓ backend/dist/index.js found"; \
      ls -lh backend/dist/index.js; \
    fi

# Production stage
FROM node:20-alpine

# Install runtime dependencies only
RUN apk add --no-cache dumb-init

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY shared/package.json ./shared/

# Install production dependencies only
RUN npm ci --legacy-peer-deps --no-audit --no-fund --only=production && \
    npm cache clean --force

# Copy built application from builder
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/public ./backend/public
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/node_modules ./node_modules

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "backend/dist/index.js"]

