# 1. Base image for dependencies
FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm install

# 2. Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY . .

COPY --from=deps /app/node_modules ./node_modules

RUN npm run build

# 3. Final runtime image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV production

# ✅ Copy built code and dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

# ✅ Copy .env file (so dotenv works at runtime)
COPY --from=builder /app/.env .env

EXPOSE 3000

CMD ["node", "dist/index.js"]