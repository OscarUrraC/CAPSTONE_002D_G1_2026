FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

# Primero solo los manifiestos: si no cambian las dependencias, Docker reutiliza esta capa en cada build.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src

# El contenedor no corre como root.
USER node

EXPOSE 3000

# Se arranca con node directo (no con "npm start"): el .env NO va dentro de la imagen,
# las variables las inyecta docker compose.
CMD ["node", "src/index.js"]