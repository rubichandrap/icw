# ── build stage ────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

RUN npm install -g pnpm@12
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
# Site env is baked at build time; LLM keys are runtime-only (MCP/CI) and
# must never be needed to render static pages.
RUN pnpm build

# ── serve stage ────────────────────────────────────────────────
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
