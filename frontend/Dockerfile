FROM node:24-alpine AS development

RUN corepack enable
WORKDIR /app
COPY package.json ./
RUN pnpm install
COPY . .

EXPOSE 5173
CMD ["pnpm", "dev", "--host", "0.0.0.0"]

FROM development AS build
ARG VITE_API_BASE_URL=/api
ARG VITE_APP_NAME=ИПМКН Старт
ARG VITE_DGIS_MAPGL_KEY=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_APP_NAME=$VITE_APP_NAME
ENV VITE_DGIS_MAPGL_KEY=$VITE_DGIS_MAPGL_KEY
RUN pnpm build

FROM caddy:2-alpine AS production
COPY --from=build /app/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile
