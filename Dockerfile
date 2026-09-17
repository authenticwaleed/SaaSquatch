# Multi-stage build for SaaSquatch Signal.
#
# This image is NOT for Netlify — Netlify builds in its own image and deploys the
# API routes as serverless functions, and cannot run a container. It exists for
# two other reasons:
#
#   1. Reproducible local runs, matching the Node version CI uses.
#   2. Hosts that run a real Node process (Render, Fly.io, Koyeb, any VPS), where
#      there is no synchronous function timeout — so ENRICH_BATCH_LIMIT can be
#      raised well above the 15 that Netlify's free tier forces.

# ---- deps ---------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
# Only the manifests, so this layer caches until dependencies actually change.
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder ------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Produces .next/standalone: a self-contained server with only the modules it traced.
ENV BUILD_STANDALONE=true
RUN npm run build

# ---- runner -------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Run as a non-root user. The app makes outbound requests to arbitrary sites;
# there is no reason for that process to own the filesystem.
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public
# standalone already contains the traced node_modules and a server.js entrypoint.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# No shell, so signals reach node directly and the container stops cleanly.
CMD ["node", "server.js"]
