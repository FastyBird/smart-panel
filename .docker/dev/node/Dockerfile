FROM node:lts-alpine

# Set working directory
WORKDIR /app/apps/backend

# Increase Node.js memory limit
ENV NODE_OPTIONS="--max_old_space_size=4096"

# Install dependencies using Yarn
RUN yarn install

EXPOSE 3000

CMD ["yarn", "start:dev"]
