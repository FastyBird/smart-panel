FROM node:lts-alpine

# Set working directory
WORKDIR /app/apps/backend

# Increase Node.js memory limit
ENV NODE_OPTIONS="--max_old_space_size=4096"

# Install dependencies using pnpm
RUN pnpm install

EXPOSE 3000

CMD ["pnpm", "--filter", "@fastybird/smart-panel-backend", "start:dev"]
