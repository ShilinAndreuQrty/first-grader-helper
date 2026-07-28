FROM node:24-alpine AS development

RUN corepack enable
WORKDIR /app
COPY package.json ./
RUN pnpm install
COPY . .

EXPOSE 5173
CMD ["pnpm", "dev", "--host", "0.0.0.0"]

FROM development AS build
RUN pnpm build

FROM caddy:2-alpine AS production
COPY --from=build /app/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile
