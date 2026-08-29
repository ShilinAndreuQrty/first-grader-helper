FROM node:24-alpine AS development

RUN corepack enable
WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json frontend/package.json
RUN pnpm install --frozen-lockfile --filter frontend...
COPY frontend frontend
WORKDIR /workspace/frontend

EXPOSE 5173 5174
CMD ["pnpm", "dev", "--host", "0.0.0.0"]

FROM development AS build-base
ARG VITE_API_BASE_URL=/api
ARG VITE_APP_NAME=ИПМКН Старт
ARG VITE_DGIS_ENABLED=false
ARG VITE_DGIS_MAPGL_KEY=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_APP_NAME=$VITE_APP_NAME
ENV VITE_DGIS_ENABLED=$VITE_DGIS_ENABLED
ENV VITE_DGIS_MAPGL_KEY=$VITE_DGIS_MAPGL_KEY

FROM build-base AS build-public
RUN pnpm build:public

FROM build-base AS build-admin
RUN pnpm build:admin

FROM caddy:2-alpine AS production-public
COPY --from=build-public /workspace/frontend/dist/public /srv
COPY frontend/Caddyfile /etc/caddy/Caddyfile

FROM caddy:2-alpine AS production-admin
COPY --from=build-admin /workspace/frontend/dist/admin /srv
COPY frontend/Caddyfile /etc/caddy/Caddyfile

FROM production-public AS production
