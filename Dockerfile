# 1. Base Image 
FROM node:18-alpine AS base 

# 2. Install Dependencies 
FROM base AS deps 
WORKDIR /app 
COPY package.json package-lock.json ./ 
RUN npm ci 

# 3. Build Project 
FROM base AS builder 
WORKDIR /app 
COPY --from=deps /app/node_modules ./node_modules 
COPY . . 
RUN npm run build 

# 4. Production Runner 
FROM base AS runner 
WORKDIR /app 
ENV NODE_ENV production 
ENV HOSTNAME "0.0.0.0" 
ENV PORT 3000 

COPY --from=builder /app/public ./public 
COPY --from=builder /app/.next/standalone ./ 
COPY --from=builder /app/.next/static ./.next/static 

EXPOSE 3000 
CMD ["node", "server.js"]