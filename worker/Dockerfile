# Runs via tsx rather than pre-compiling with tsc: Prisma's generated client uses extensionless
# relative imports (e.g. "./internal/class") that resolve fine under tsx's bundler-style loader,
# but Node 22.2x's native ESM resolver tries to resolve them as TypeScript-adjacent (.ts) and
# fails outright once compiled to plain .js and run with a bare `node`. tsx's loader doesn't hit
# that, and it's already how this worker runs in dev, so there's one resolution path, not two.
FROM node:22-bookworm-slim AS base
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm install

FROM deps AS generate
COPY prisma ./prisma
RUN npx prisma generate

FROM base AS prod-deps
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=generate /app/src/generated ./src/generated
COPY src ./src
COPY package.json ./
COPY assets ./assets

CMD ["node_modules/.bin/tsx", "src/index.ts"]
