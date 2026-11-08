# Development image for the web app (frontend on 7201, API on 7202)
FROM node:22.20.0-alpine

RUN corepack enable
WORKDIR /app

# Install dependencies first so Docker can cache this layer
COPY package.json pnpm-lock.yaml .npmrc ./
COPY patches ./patches
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile --ignore-scripts \
  && pnpm exec patch-package \
  && pnpm exec prisma generate

# Source code is bind-mounted by docker-compose for live reload
COPY . .

EXPOSE 7201 7202
CMD ["pnpm", "docker:dev"]
