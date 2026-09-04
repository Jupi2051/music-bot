FROM node:22-bookworm-slim

# System dependencies: ffmpeg (audio transcoding), ca-certificates
# (required for yt-dlp to validate SSL against YouTube — slim images don't
# include it), the build toolchain (build-essential + python3) for
# @discordjs/opus (no prebuild for Node 22 / ABI 127, node-gyp compiles from
# source), and gosu (drops root privileges cleanly — see entrypoint.sh).
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    build-essential \
    python3 \
    gosu \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user for security
RUN groupadd --gid 1001 --system nodejs && \
    useradd --uid 1001 --system --gid nodejs --shell /bin/bash --create-home nodejs

WORKDIR /app

# Copy manifests, patches, scripts and utils first (leverages Docker cache)
COPY package*.json ./
COPY patches/ ./patches/
COPY scripts/ ./scripts/
COPY utils/ ./utils/

# Install dependencies as root (needed to compile native modules).
# Installs EVERYTHING (including devDeps) so postinstall can run patch-package
# (fixes the JSON.parse bug in @distube/yt-dlp), then devDeps are pruned.
RUN npm ci && npx patch-package && npm prune --omit=dev && npm cache clean --force

# Download the yt-dlp binary at build time (root), verifying it's complete.
# With update:false in config/distube.js, the runtime CANNOT overwrite it →
# if an attack managed to inject flags (--update-to), there would be no
# replaceable binary = no RCE. The script fails the build if the download
# comes out truncated: previously, the immediate process.exit() left a
# 0-byte binary — links didn't work then, and now search doesn't either
# (both default to yt-dlp/YouTube, see commands/play.js).
RUN node scripts/download-ytdlp.js

# Set ownership AFTER npm ci and the binary download. ONLY the root of /app
# is writable (bot-state.json): node_modules stays root-owned and the yt-dlp
# binary is immutable at runtime (no auto-updates).
RUN chown nodejs:nodejs /app

# Pre-create /app/data (cookies.txt lives here, see docker-compose.yml) owned
# by nodejs, as a baseline. Belt-and-suspenders: entrypoint.sh also re-chowns
# it on every boot (see below) since in practice different volume drivers
# (bind mount vs named volume, and PaaS-managed volumes on top of either)
# don't consistently honor an image's baked-in ownership at the mount path.
RUN mkdir -p /app/data && chown nodejs:nodejs /app/data

# Copy the source code. Ownership is set explicitly via --chown regardless of
# the active USER (still root here — see the note above ENTRYPOINT below for
# why we stay root through the rest of the build and only drop to nodejs at
# container start).
COPY --chown=nodejs:nodejs . .

RUN chmod +x /app/entrypoint.sh

# Default environment variables
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=512"

# Cookie upload web UI (web/cookieServer.js): only actually listens if
# COOKIE_SERVER_PORT is set in .env — this alone doesn't publish anything,
# docker-compose.yml's `ports:` does that.
EXPOSE 8080

# Healthcheck to verify the bot is running. Runs as root (no USER switch
# above) — harmless, and able to signal PID 1 regardless of its uid.
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node healthcheck.js || exit 1

# No USER nodejs here: the container starts as root so entrypoint.sh can fix
# ownership of whatever got mounted at /app/data (bind mount or volume,
# freshly created or reused — different drivers/platforms proved inconsistent
# about honoring the image's baked-in permissions there) on every boot, then
# drops to the non-root nodejs user via gosu before running anything that
# touches untrusted input. The long-running bot process itself is unaffected:
# it still always runs as nodejs, exactly as before.
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", "index.js"]
