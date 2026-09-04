#!/bin/sh
# GordoDJ entrypoint
# Builds the yt-dlp config dynamically:
#  - --js-runtimes node: yt-dlp 2026 requires a JS runtime for full extraction
#  - --cookies: only enabled if /app/cookies.txt exists (exported by the admin)
set -e

mkdir -p /home/nodejs/.config/yt-dlp
# yt-dlp 2026 requires a JS runtime for full extraction
echo "--js-runtimes node" > /home/nodejs/.config/yt-dlp/config
# YouTube client fallback chain: the "android"-only workaround stopped being
# enough as YouTube's bot-check tightened (2026-09) — it now blocks with
# "Sign in to confirm you're not a bot" even with player_client=android alone.
# tv is currently the least-scrutinized client; listing several lets yt-dlp
# fall back if one gets blocked. If this still fails, mount cookies.txt
# (see the cookies check below) — that's the only fully reliable fix.
echo "--extractor-args youtube:player_client=tv,web_safari,android" >> /home/nodejs/.config/yt-dlp/config
# Playlist limit: radios (list=RD...) are unbounded virtual lists, and
# without this limit extraction never finishes (bot stuck on "🔍 Searching:").
# 15 songs max per playlist/radio (tested 2026-08, ~25s with yt-dlp's
# sequential extractor).
echo "--playlist-end 15" >> /home/nodejs/.config/yt-dlp/config

# Only a regular, non-empty file: in a fresh deploy without cookies.txt,
# Docker mounts a DIRECTORY at /app/cookies.txt and `test -s` passes against
# directories (st_size=4096) → yt-dlp would fail reading a directory as cookies.
if [ -f /app/cookies.txt ] && [ -s /app/cookies.txt ]; then
  echo "--cookies /app/cookies.txt" >> /home/nodejs/.config/yt-dlp/config
  echo "🍪 YouTube cookies detected"
else
  echo "⚠️  No cookies.txt: YouTube may block with a bot-check"
fi

exec node index.js
