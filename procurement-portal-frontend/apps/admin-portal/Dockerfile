FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.4.0 --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/ ./packages/
COPY apps/admin-portal/ ./apps/admin-portal/
RUN pnpm install --frozen-lockfile

FROM deps AS builder
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_API_URL=\
ENV NEXT_PUBLIC_WS_URL=\
RUN pnpm --filter admin-portal build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/admin-portal/.next/standalone ./
COPY --from=builder /app/apps/admin-portal/.next/static ./apps/admin-portal/.next/static
COPY --from=builder /app/apps/admin-portal/public ./apps/admin-portal/public
EXPOSE 3002
CMD ["node", "apps/admin-portal/server.js"]
