FROM node:lts-alpine

# Set working directory
WORKDIR /app/apps/admin

# Increase Node.js memory limit
ENV NODE_OPTIONS="--max_old_space_size=4096"

# Install dependencies using pnpm
RUN pnpm install

EXPOSE 3003

CMD ["pnpm", "--filter", "@fastybird/smart-panel-admin", "start:dev"]
