FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.4.0 --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/ ./packages/
COPY apps/buyer-portal/ ./apps/buyer-portal/
RUN pnpm install --frozen-lockfile

FROM deps AS builder
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
RUN pnpm --filter buyer-portal build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/apps/buyer-portal/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/buyer-portal/.next/static ./apps/buyer-portal/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/buyer-portal/public ./apps/buyer-portal/public
USER nextjs
EXPOSE 3000
CMD ["node", "apps/buyer-portal/server.js"]
