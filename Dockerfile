#
# dev
#
FROM oven/bun:1.3.11 as dev

WORKDIR /app
COPY . .

RUN bun install

CMD [ "bun", "dev" ]

#
# Builder
#
FROM node:22-slim as builder

WORKDIR /app
COPY . .

RUN npm ci
RUN npm run build

#
# Runner
#
FROM node:22-slim

WORKDIR /app
COPY --from=builder /app/.next /app/.next
COPY --from=builder /app/node_modules /app/node_modules
COPY package.json .

ENTRYPOINT [ "npm", "run", "start" ]
