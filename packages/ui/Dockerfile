FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared ./packages/shared
COPY packages/ui ./packages/ui

# Install pnpm and dependencies
RUN npm install -g pnpm
RUN pnpm install

# Build shared first, then ui
RUN pnpm --filter @abcc/shared build
RUN pnpm --filter @abcc/ui build

# Production image
FROM nginx:alpine

# Copy built assets
COPY --from=builder /app/packages/ui/dist /usr/share/nginx/html

# Copy nginx config
COPY packages/ui/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 5173

CMD ["nginx", "-g", "daemon off;"]
