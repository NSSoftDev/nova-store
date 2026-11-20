# Nova Store API image (build context: repository root)
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --omit=dev --workspace server
COPY shared shared
COPY server server
WORKDIR /app/server
USER node
EXPOSE 4000
# Apply pending migrations, then start the API
CMD ["sh", "-c", "node scripts/migrate.js && node src/index.js"]
