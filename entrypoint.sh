#!/bin/sh
# GordoDJ entrypoint
# The yt-dlp config (js runtime, player-client fallback chain, playlist limit,
# and --cookies if cookies.txt exists) is built by scripts/write-ytdlp-config.js
# (shared with web/cookieServer.js, which re-runs it whenever a new
# cookies.txt is submitted through the web form).
set -e

node scripts/write-ytdlp-config.js

exec node index.js
