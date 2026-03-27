# Build context is the project root (not web/)
FROM node:20-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app/web
COPY web/package.json web/package-lock.json* ./
RUN npm install

# Build the app
FROM base AS builder
WORKDIR /app

# Copy shared types first
COPY shared/ ./shared/

# Copy web app
COPY web/ ./web/
COPY --from=deps /app/web/node_modules ./web/node_modules

WORKDIR /app/web
RUN npx prisma generate
RUN npm run build

# Production
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone build
COPY --from=builder /app/web/public ./public
COPY --from=builder /app/web/.next/standalone ./
COPY --from=builder /app/web/.next/static ./.next/static

# Copy custom server and prisma
COPY --from=builder /app/web/server.js ./server.js
COPY --from=builder /app/web/prisma ./prisma
COPY --from=builder /app/web/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/web/node_modules/@prisma ./node_modules/@prisma

# ws package needed by custom server
COPY --from=builder /app/web/node_modules/ws ./node_modules/ws

USER nextjs

EXPOSE 3124
ENV PORT=3124
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
