#!/bin/sh
# GordoDJ entrypoint. Runs as root (see the Dockerfile's ENTRYPOINT comment).
#
# /app/data (cookies.txt lives here) is often a mounted volume, and in
# practice different volume drivers/platforms don't consistently honor the
# ownership already baked into the image at that path — it can come up
# root-owned regardless. Fix it on every boot instead of trusting that, then
# drop to the non-root nodejs user via gosu for everything else, including
# the yt-dlp config (js runtime, player-client fallback chain, playlist
# limit, --cookies if cookies.txt exists — see scripts/write-ytdlp-config.js,
# shared with web/cookieServer.js which re-runs it whenever a new cookies.txt
# is submitted through the web form) and the bot itself.
set -e

chown -R nodejs:nodejs /app/data 2>/dev/null || true

exec gosu nodejs sh -c "node scripts/write-ytdlp-config.js && exec node index.js"
