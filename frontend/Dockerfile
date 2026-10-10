# syntax=docker/dockerfile:1.7

# ---- Build the static SPA ---------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
# Empty = same origin: nginx below proxies /api to the backend, so no CORS is needed.
# Set to a full URL (e.g. https://api.example.com) when the API lives on another host.
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ---- Serve with nginx (unprivileged image: runs as non-root on port 8080) ----------------
FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
