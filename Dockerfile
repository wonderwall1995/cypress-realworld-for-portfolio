# Development image for the monorepo: web app (apps/web, port 7201) and API (apps/api, port 7202)
FROM node:22.20.0-alpine

RUN corepack enable
WORKDIR /app

# Install dependencies first so Docker can cache this layer.
# Only the manifests are copied here, so a source change does not invalidate the install layer.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY apps/web/patches apps/web/patches
COPY apps/api/prisma apps/api/prisma
RUN pnpm install --frozen-lockfile --ignore-scripts \
  && pnpm --filter @rwa/web exec patch-package \
  && pnpm --filter @rwa/api exec prisma generate

# Source code is bind-mounted by docker-compose for live reload
COPY . .

EXPOSE 7201 7202
CMD ["pnpm", "docker:dev"]
