FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.4.0 --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/ ./packages/
COPY apps/supplier-portal/ ./apps/supplier-portal/
RUN pnpm install --frozen-lockfile

FROM deps AS builder
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_API_URL=\
ENV NEXT_PUBLIC_WS_URL=\
RUN pnpm --filter supplier-portal build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/supplier-portal/.next/standalone ./
COPY --from=builder /app/apps/supplier-portal/.next/static ./apps/supplier-portal/.next/static
COPY --from=builder /app/apps/supplier-portal/public ./apps/supplier-portal/public
EXPOSE 3001
CMD ["node", "apps/supplier-portal/server.js"]
