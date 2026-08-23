FROM node:20-alpine AS base
WORKDIR /app

# ── Dependencies ────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# ── Build ────────────────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time secrets passed as ARG so they are baked into the Next.js bundle
ARG MONGODB_URI
ARG SESSION_SECRET
ARG PG_HOST
ARG PG_PORT=5432
ARG PG_DB
ARG PG_USER
ARG PG_PASS

ENV MONGODB_URI=$MONGODB_URI \
    SESSION_SECRET=$SESSION_SECRET \
    PG_HOST=$PG_HOST \
    PG_PORT=$PG_PORT \
    PG_DB=$PG_DB \
    PG_USER=$PG_USER \
    PG_PASS=$PG_PASS

ARG MINIO_ENDPOINT
ARG MINIO_PORT=9000
ARG MINIO_ACCESS_KEY
ARG MINIO_SECRET_KEY
ARG MINIO_BUCKET
ARG MINIO_USE_SSL=false
ARG MINIO_PUBLIC_URL

ENV MINIO_ENDPOINT=$MINIO_ENDPOINT \
    MINIO_PORT=$MINIO_PORT \
    MINIO_ACCESS_KEY=$MINIO_ACCESS_KEY \
    MINIO_SECRET_KEY=$MINIO_SECRET_KEY \
    MINIO_BUCKET=$MINIO_BUCKET \
    MINIO_USE_SSL=$MINIO_USE_SSL \
    MINIO_PUBLIC_URL=$MINIO_PUBLIC_URL

RUN npm run build

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

# Runtime environment variables (override build-time values if needed)
ARG MONGODB_URI
ARG SESSION_SECRET
ARG PG_HOST
ARG PG_PORT=5432
ARG PG_DB
ARG PG_USER
ARG PG_PASS

ENV MONGODB_URI=$MONGODB_URI \
    SESSION_SECRET=$SESSION_SECRET \
    PG_HOST=$PG_HOST \
    PG_PORT=$PG_PORT \
    PG_DB=$PG_DB \
    PG_USER=$PG_USER \
    PG_PASS=$PG_PASS \
    PORT=3000 \
    HOSTNAME="0.0.0.0"

EXPOSE 3000
CMD ["node", "server.js"]
