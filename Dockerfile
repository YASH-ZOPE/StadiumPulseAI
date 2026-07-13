FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

FROM node:20-alpine
WORKDIR /app
RUN addgroup -g 1001 appgroup && adduser -u 1001 -G appgroup -D appuser
COPY --from=build --chown=appuser:appgroup /app .
USER appuser
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "src/core/bootstrap.js"]
