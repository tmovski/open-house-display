# Build from the repository root so the shared validation code is included:
#   docker build -f server/Dockerfile -t open-house-server .
FROM node:22-alpine
WORKDIR /app
COPY web/site/js/core ./web/site/js/core
COPY web/package.json ./web/package.json
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev
COPY server/src ./server/src
WORKDIR /app/server
ENV NODE_ENV=production PORT=8787 DATABASE_FILE=/data/leads.db
RUN mkdir -p /data && chown node:node /data
VOLUME /data
EXPOSE 8787
USER node
CMD ["node", "--disable-warning=ExperimentalWarning", "src/index.js"]
