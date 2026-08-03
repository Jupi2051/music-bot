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
# 15 canciones máximas por playlist/radio (probado 2026-08, ~25s con el
# extractor secuencial de yt-dlp).
echo "--playlist-end 15" >> /home/nodejs/.config/yt-dlp/config

# Solo archivo regular y no vacío: en un deploy fresco sin cookies.txt, Docker
# monta un DIRECTORIO en /app/cookies.txt y `test -s` pasa contra directorios
# (st_size=4096) → yt-dlp fallaría leyendo un directorio como cookies.
if [ -f /app/cookies.txt ] && [ -s /app/cookies.txt ]; then
  echo "--cookies /app/cookies.txt" >> /home/nodejs/.config/yt-dlp/config
  echo "🍪 Cookies de YouTube detectadas"
else
  echo "⚠️  Sin cookies.txt: YouTube puede bloquear con bot-check"
fi

exec node index.js
