# Imagen de la API. Se construye desde la raíz del proyecto (contexto ".")
# para poder incluir backend/, frontend/ y database/.
FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production

# 1. Dependencias primero: esta capa se reutiliza mientras package*.json no cambie.
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# 2. Código de la API, web estática y migraciones.
COPY backend/src ./src
COPY frontend ./frontend
COPY database ./database

# La imagen oficial trae el usuario "node": no se ejecuta como root.
USER node

EXPOSE 3000
CMD ["node", "src/server.js"]
