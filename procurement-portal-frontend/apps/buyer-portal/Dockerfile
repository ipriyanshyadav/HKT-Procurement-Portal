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
COPY --from=builder /app/apps/buyer-portal/.next/standalone ./
COPY --from=builder /app/apps/buyer-portal/.next/static ./apps/buyer-portal/.next/static
COPY --from=builder /app/apps/buyer-portal/public ./apps/buyer-portal/public
EXPOSE 3000
CMD ["node", "apps/buyer-portal/server.js"]
