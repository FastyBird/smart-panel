FROM node:lts-alpine

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@latest --activate

# Set working directory
WORKDIR /app

# Increase Node.js memory limit
ENV NODE_OPTIONS="--max_old_space_size=4096"

EXPOSE 3000

# Install dependencies and start the backend
CMD ["sh", "-c", "pnpm install && pnpm --filter @fastybird/smart-panel-backend start:dev"]
