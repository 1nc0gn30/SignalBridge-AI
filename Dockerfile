FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src/core ./src/core
COPY bridge ./bridge
COPY tsconfig.json signalbridge.config.example.json ./

ENV NODE_ENV=production
ENV SIGNAL_BRIDGE_HOST=0.0.0.0
ENV SIGNAL_BRIDGE_PORT=8787
ENV SIGNAL_BRIDGE_DRY_RUN=true

EXPOSE 8787

CMD ["npx", "tsx", "bridge/cli.ts", "serve"]
