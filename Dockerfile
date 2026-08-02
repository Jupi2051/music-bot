FROM node:22-bookworm-slim

# Dependencias del sistema: ffmpeg (transcodificación de audio) y toolchain de
# compilación (build-essential + python3) para @discordjs/opus: no hay prebuild
# para Node 22 (ABI 127), así que node-gyp compila desde source
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ffmpeg \
    build-essential \
    python3 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Crear usuario no-root para seguridad
RUN groupadd --gid 1001 --system nodejs && \
    useradd --uid 1001 --system --gid nodejs --shell /bin/bash --create-home nodejs

WORKDIR /app

# Copiar manifests primero (aprovecha cache de Docker)
COPY package*.json ./

# Instalar dependencias como root (necesario para compilar módulos nativos)
RUN npm ci --omit=dev && npm cache clean --force

# Fijar ownership DESPUÉS del npm ci: node_modules debe pertenecer al usuario
# no-root para que yt-dlp pueda auto-actualizarse en runtime
RUN chown -R nodejs:nodejs /app

# Cambiar a usuario no-root
USER nodejs

# Copiar el código fuente
COPY --chown=nodejs:nodejs . .

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=512"

# Healthcheck para verificar que el bot esté funcionando
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node healthcheck.js || exit 1

# Comando para iniciar el bot
CMD ["node", "index.js"]
