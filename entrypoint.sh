#!/bin/sh
# Entrypoint de GordoDJ
# Arma el config de yt-dlp dinámicamente:
#  - --js-runtimes node: yt-dlp 2026 requiere un JS runtime para extracción completa
#  - --cookies: se activa solo si existe /app/cookies.txt (exportadas por el admin)
set -e

mkdir -p /home/nodejs/.config/yt-dlp
# yt-dlp 2026 requiere un JS runtime para extracción completa
echo "--js-runtimes node" > /home/nodejs/.config/yt-dlp/config
# Cliente Android de YouTube: evade el bot-check "Sign in to confirm you're
# not a bot" que bloquea al cliente web por defecto (probado 2026-07)
echo "--extractor-args youtube:player_client=android" >> /home/nodejs/.config/yt-dlp/config
# Límite de playlists: las radios (list=RD...) son listas virtuales ilimitadas y
# sin este límite la extracción nunca termina (bot colgado en "🔍 Buscando:").
# 25 canciones máximas por playlist/radio (probado 2026-08, ~42s).
echo "--playlist-end 25" >> /home/nodejs/.config/yt-dlp/config

if [ -s /app/cookies.txt ]; then
  echo "--cookies /app/cookies.txt" >> /home/nodejs/.config/yt-dlp/config
  echo "🍪 Cookies de YouTube detectadas"
else
  echo "⚠️  Sin cookies.txt: YouTube puede bloquear con bot-check"
fi

exec node index.js
