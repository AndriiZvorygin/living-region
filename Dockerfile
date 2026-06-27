FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
COPY packages ./packages

RUN npm ci
RUN npm run build:web

FROM caddy:2-alpine

COPY packages/web-client/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/packages/web-client/dist /srv/hamlet

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
