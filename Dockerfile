FROM node:22-alpine

WORKDIR /app

# Instalar dependencias primero (capa cacheada)
COPY package*.json ./
RUN npm install --omit=dev

# Copiar código fuente
COPY src/ ./src/

EXPOSE 4001

CMD ["node", "src/server.js"]
