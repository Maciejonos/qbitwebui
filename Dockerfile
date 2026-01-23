FROM oven/bun:alpine AS builder
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:alpine
RUN apk add --no-cache curl ca-certificates && \
    curl -sL https://install.speedtest.net/app/cli/ookla-speedtest-1.2.0-linux-x86_64.tgz | tar xz -C /usr/local/bin speedtest
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/server ./src/server
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=/data/qbitwebui.db
ENV SALT_PATH=/data/.salt

EXPOSE 3000
VOLUME /data

CMD ["bun", "run", "src/server/index.ts"]
