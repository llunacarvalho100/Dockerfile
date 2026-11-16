FROM node:20-slim

# Instala o FFmpeg e certificados no servidor Linux
RUN apt-get update && apt-get install -y ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Cria diretórios persistentes para vídeos e histórico (DATA_DIR)
RUN mkdir -p videos_renderizados data

ENV NODE_ENV=production
ENV DATA_DIR=./data

EXPOSE 3000

# Executa server.ts via tsx no Node 20 mantendo "start": "node server.ts" para ambientes Node 22+
CMD ["./node_modules/.bin/tsx", "server.ts"]
