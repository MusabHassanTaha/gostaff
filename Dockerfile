# 1. Base Image 
FROM node:20-alpine AS base 

# 2. Install Dependencies 
FROM base AS deps 
WORKDIR /app 
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat python3 make g++ 
COPY package.json package-lock.json ./ 
RUN npm install 

# 3. Build Project 
FROM base AS builder 
WORKDIR /app 
COPY --from=deps /app/node_modules ./node_modules 
COPY . . 
RUN npm run build 

# 4. Production Runner 
FROM base AS runner 
WORKDIR /app 
ENV NODE_ENV=production 
ENV HOSTNAME="0.0.0.0" 
ENV PORT=3000 

# Add sqlite3 for debugging (optional) and ensure shared libs are present
RUN apk add --no-cache sqlite

COPY --from=builder /app/public ./public 
COPY --from=builder /app/.next/standalone ./ 
COPY --from=builder /app/.next/static ./.next/static 

# Ensure data directory permissions
RUN mkdir -p /app/data && chown -R node:node /app/data

EXPOSE 3000 
CMD ["node", "server.js"]