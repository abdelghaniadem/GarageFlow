# Multi-stage build for React SPA with Nginx
# Stage 1: Build React static assets
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests and install packages
COPY package.json package-lock.json ./
RUN npm ci

# Copy application source code and configuration
COPY . .

# In production with Nginx reverse proxy, API requests use relative /api/v1
ENV VITE_API_BASE_URL=/api/v1

RUN npm run build

# Stage 2: Serve static assets with Nginx
FROM nginx:1.27-alpine

# Remove default nginx HTML
RUN rm -rf /usr/share/nginx/html/*

# Copy built distribution from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Healthcheck
HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://127.0.0.1:80/ || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
