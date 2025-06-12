FROM node:18-slim

# Instalar dependencias del sistema
RUN apt-get update && \
    apt-get install -y \
    ffmpeg \
    python3 \
    build-essential \
    git \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Crear usuario no-root para seguridad
RUN groupadd --gid 1001 --system nodejs && \
    useradd --uid 1001 --system --gid nodejs --shell /bin/bash --create-home nodejs

# Crear directorio de trabajo
WORKDIR /app

# Cambiar propietario del directorio
RUN chown -R nodejs:nodejs /app

# Copiar archivos de dependencias primero (para aprovechar cache de Docker)
COPY --chown=nodejs:nodejs package*.json ./

# Instalar dependencias como root (necesario para compilar módulos nativos)
RUN npm ci --only=production && npm cache clean --force

# Dar permisos de ejecución a binarios de yt-dlp
RUN find /app/node_modules/@distube/yt-dlp/bin -type f -exec chmod +x {} \; || true

# Cambiar a usuario no-root
USER nodejs

# Copiar el código fuente
COPY --chown=nodejs:nodejs . .

# Crear directorios necesarios
RUN mkdir -p /app/data && \
    mkdir -p /app/logs

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=512"

# Healthcheck para verificar que el bot esté funcionando
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node healthcheck.js || exit 1

# Comando para iniciar el bot
CMD ["node", "index.js"]
