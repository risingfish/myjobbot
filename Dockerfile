FROM node:24.21.0-alpine3.24 AS build

WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci
COPY src ./src
COPY web ./web
RUN NEXT_TELEMETRY_DISABLED=1 NEXT_DIST_DIR=.next-prod node_modules/.bin/next build web

FROM node:24.21.0-alpine3.24

ARG TARGETARCH
ARG SUPERCRONIC_VERSION=v0.2.49
ARG SUPERCRONIC_SHA256_AMD64=a53ae236602c7338aba3fbaff40bda6300eae3b9fedb8261eb06cfe3724430c1
ARG SUPERCRONIC_SHA256_ARM64=02aa0cb229ba09050cba6638059dadb9eedc2276632ea43d6a57a2f8c1629dd5

RUN apk add --no-cache ca-certificates tzdata \
 && apk add --no-cache --virtual .fetch curl \
 && case "$TARGETARCH" in \
      amd64) sha="$SUPERCRONIC_SHA256_AMD64" ;; \
      arm64) sha="$SUPERCRONIC_SHA256_ARM64" ;; \
      *) echo "unsupported architecture: $TARGETARCH" >&2; exit 1 ;; \
    esac \
 && curl -fsSLo /usr/local/bin/supercronic \
      "https://github.com/aptible/supercronic/releases/download/${SUPERCRONIC_VERSION}/supercronic-linux-${TARGETARCH}" \
 && echo "${sha}  /usr/local/bin/supercronic" | sha256sum -c - \
 && chmod +x /usr/local/bin/supercronic \
 && apk del .fetch

WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY src ./src
COPY --chown=node:node web ./web
COPY --from=build --chown=node:node /app/web/.next-prod ./web/.next-prod
COPY docker ./docker

ENV MYJOBBOT_DATA_DIR=/data \
    MYJOBBOT_LOG_DIR=/data/log \
    SCHEDULE="0 1/8 * * *" \
    TZ=America/Los_Angeles \
    NODE_OPTIONS=--disable-warning=ExperimentalWarning

USER node
ENTRYPOINT ["/app/docker/entrypoint.sh"]
