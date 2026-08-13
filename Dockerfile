FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
COPY packages ./packages

RUN npm ci
RUN npm run build:web

FROM caddy:2-alpine AS web

COPY packages/web-client/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/packages/web-client/dist /srv/hamlet

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1

FROM node:24-alpine AS canvassing-api

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
COPY --from=build /app/node_modules ./node_modules
COPY packages/canvassing ./packages/canvassing
COPY packages/web-client/src ./packages/web-client/src
COPY packages/web-client/public ./packages/web-client/public

ENV CANVASS_HOST=0.0.0.0
ENV CANVASS_PORT=4174
ENV CANVASS_AUTH_TOKEN=docker-private-canvassing

EXPOSE 4174

CMD ["npm", "run", "canvassing:server"]
