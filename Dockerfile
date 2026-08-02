FROM node:22-bookworm-slim

# Dependencias del sistema: ffmpeg (transcodificación de audio), ca-certificates
# (imprescindible para que yt-dlp valide SSL contra YouTube — las imágenes slim no
# lo traen) y toolchain de compilación (build-essential + python3) para
# @discordjs/opus: no hay prebuild para Node 22 (ABI 127), node-gyp compila source
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    build-essential \
    python3 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Crear usuario no-root para seguridad
RUN groupadd --gid 1001 --system nodejs && \
    useradd --uid 1001 --system --gid nodejs --shell /bin/bash --create-home nodejs

WORKDIR /app

# Copiar manifests y patches primero (aprovecha cache de Docker)
COPY package*.json ./
COPY patches/ ./patches/

# Instalar dependencias como root (necesario para compilar módulos nativos).
# Se instala TODO (incluye devDeps) para que el postinstall corra patch-package
# (fix del bug de JSON.parse en @distube/yt-dlp), y luego se podan las devDeps.
RUN npm ci && npx patch-package && npm prune --omit=dev && npm cache clean --force

# Fijar ownership DESPUÉS del npm ci: node_modules debe pertenecer al usuario
# no-root para que yt-dlp pueda auto-actualizarse en runtime
RUN chown -R nodejs:nodejs /app

# Cambiar a usuario no-root
USER nodejs

# Copiar el código fuente
COPY --chown=nodejs:nodejs . .

# Entrypoint: arma el config de yt-dlp (js runtime + cookies si existen).
# El chmod corre como nodejs pero el archivo es suyo (--chown arriba).
RUN chmod +x /app/entrypoint.sh

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=512"

# Healthcheck para verificar que el bot esté funcionando
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node healthcheck.js || exit 1

# Comando para iniciar el bot
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", "index.js"]
