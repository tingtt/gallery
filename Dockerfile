#
# dev
#
FROM oven/bun:latest as dev

WORKDIR /app
COPY . .

RUN bun install

CMD [ "bun", "dev" ]

#
# Builder
#
FROM oven/bun:latest as builder

WORKDIR /app
COPY . .

RUN bun install
RUN bun run build

#
# Runner
#
FROM oven/bun:latest

WORKDIR /app
COPY --from=builder /app/.next /app/.next
COPY --from=builder /app/node_modules /app/node_modules
COPY package.json .
ENTRYPOINT [ "bun", "run", "start" ]
