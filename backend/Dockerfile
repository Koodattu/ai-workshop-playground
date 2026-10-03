# syntax=docker/dockerfile:1

FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --no-audit --no-fund

COPY --chown=node:node src ./src

USER node
EXPOSE 5000
CMD ["node", "src/index.js"]
