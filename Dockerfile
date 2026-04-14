FROM node:20-alpine

WORKDIR /app

COPY youngminds/backend/package.json youngminds/backend/package-lock.json ./youngminds/backend/
RUN cd youngminds/backend && npm ci --omit=dev

COPY youngminds ./youngminds

WORKDIR /app/youngminds/backend

ENV NODE_ENV=production
EXPOSE 5501

CMD ["npm", "start"]
