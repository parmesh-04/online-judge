# Purpose: Multi-stage Dockerfile for the React frontend.
# Stage 1 builds the Vite app, Stage 2 serves it via Nginx.

# --- Stage 1: Build ---
FROM node:20-alpine AS builder
WORKDIR /app

# Accept build-time env vars (Vite bakes these into the JS bundle at build time)
ARG VITE_API_BASE_URL=http://localhost:5000
ARG VITE_COMPILER_URL=http://localhost:8000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_COMPILER_URL=$VITE_COMPILER_URL

COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Stage 2: Production ---
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
