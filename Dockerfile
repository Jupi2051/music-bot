FROM node:22-bookworm-slim

# System dependencies: ffmpeg (audio transcoding), ca-certificates
# (required for yt-dlp to validate SSL against YouTube — slim images don't
# include it) and the build toolchain (build-essential + python3) for
# @discordjs/opus: there's no prebuild for Node 22 (ABI 127), node-gyp compiles from source
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    build-essential \
    python3 \
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
# 0-byte binary and links didn't work (searches did, they go through SoundCloud).
RUN node scripts/download-ytdlp.js

# Set ownership AFTER npm ci and the binary download. ONLY the root of /app
# is writable (bot-state.json): node_modules stays root-owned and the yt-dlp
# binary is immutable at runtime (no auto-updates).
RUN chown nodejs:nodejs /app

# Pre-create /app/data (cookies.txt lives here, see docker-compose.yml) owned
# by nodejs BEFORE anything mounts over it. Docker seeds a fresh named
# volume's permissions from whatever already exists at the mount path in the
# image — PaaS platforms (Dokploy, etc.) generally back a compose `volumes:`
# entry with a named volume rather than a raw host bind mount, so without
# this the mount point comes up root-owned and the cookie upload web UI can't
# write to it (EACCES). Harmless for a real host bind mount too — the host
# side's ownership wins there regardless.
RUN mkdir -p /app/data && chown nodejs:nodejs /app/data

# Switch to the non-root user
USER nodejs

# Copy the source code
COPY --chown=nodejs:nodejs . .

# Entrypoint: builds the yt-dlp config (js runtime + cookies if present).
# chmod runs as nodejs but the file already belongs to it (--chown above).
RUN chmod +x /app/entrypoint.sh

# Default environment variables
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=512"

# Cookie upload web UI (web/cookieServer.js): only actually listens if
# COOKIE_SERVER_PORT is set in .env — this alone doesn't publish anything,
# docker-compose.yml's `ports:` does that.
EXPOSE 8080

# Healthcheck to verify the bot is running
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node healthcheck.js || exit 1

# Command to start the bot
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", "index.js"]
