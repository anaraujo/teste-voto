# build do frontend
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig*.json vite.config.ts index.html ./
COPY src ./src
COPY public ./public
RUN npm run build   # gera dist/

# runtime: servidor é 100% stdlib (node:http + node:sqlite) — sem node_modules
FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY server ./server
COPY src ./src
COPY content ./content
COPY --from=build /app/dist ./dist
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh
ENV PORT=8080 SERVE_STATIC=true DATA_DIR=/app/data
EXPOSE 8080
CMD ["./docker-entrypoint.sh"]
