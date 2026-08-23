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

# Copiar manifests, patches, scripts y utils primero (aprovecha cache de Docker)
COPY package*.json ./
COPY patches/ ./patches/
COPY scripts/ ./scripts/
COPY utils/ ./utils/

# Instalar dependencias como root (necesario para compilar módulos nativos).
# Se instala TODO (incluye devDeps) para que el postinstall corra patch-package
# (fix del bug de JSON.parse en @distube/yt-dlp), y luego se podan las devDeps.
RUN npm ci && npx patch-package && npm prune --omit=dev && npm cache clean --force

# Descargar el binario de yt-dlp en build-time (root) verificando que quede
# completo. Con update:false en config/distube.js el runtime NO puede
# sobrescribirlo → si un ataque lograra inyectar flags (--update-to), no habría
# binario reemplazable = sin RCE. El script falla el build si la descarga
# queda truncada: antes, el process.exit() inmediato dejaba un binario de
# 0 bytes y los enlaces no funcionaban (las búsquedas sí, van por SoundCloud).
RUN node scripts/download-ytdlp.js

# Fijar ownership DESPUÉS del npm ci y de la descarga del binario. SOLO la
# raíz de /app es escribible (bot-state.json): node_modules queda root-owned
# y el binario de yt-dlp es inmutable en runtime (nada de auto-updates).
RUN chown nodejs:nodejs /app

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
