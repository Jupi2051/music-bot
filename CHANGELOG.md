# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

- Anti-RCE hardening: blocks queries starting with `-` (yt-dlp flag injection) and non-http(s) protocols (`file://` → LFI).
- The yt-dlp binary no longer auto-updates at runtime: it's downloaded at build time and node_modules stays immutable in the container.

### Added
- Cookie upload web UI (`web/cookieServer.js`, opt-in via `COOKIE_SERVER_PORT`): a page with a step-by-step tutorial (Get cookies.txt LOCALLY / Cookie-Editor) and a form to submit a Netscape-format `cookies.txt` without shell access. Auth is opt-in too — set `COOKIE_SERVER_TOKEN` to require `?token=...`; unset (the default) means the page is open to anyone who can reach the port. Saving hot-reloads yt-dlp's config immediately (no restart) via the shared `scripts/write-ytdlp-config.js`, which `entrypoint.sh` also now delegates to instead of hardcoding the config in shell. `docker-compose.yml` now mounts a writable `./data` directory (was a `cookies.txt` file mount, `:ro`) with cookies stored at `data/cookies.txt` — mounting the file itself made it permanently undeletable/unwritable from inside the container, since a mount point can't be replaced by a plain file (EBUSY). Pre-creating `/app/data` owned by nodejs in the image turned out not to be enough in practice — some volume drivers/platforms don't consistently honor that at the mount path — so the container now starts as root and `entrypoint.sh` force-`chown`s `/app/data` on every boot before dropping to the non-root `nodejs` user via `gosu` (newly added to the image) for everything else, including the bot process itself. This self-heals regardless of how the volume got created or by what.
- Text/prefix commands alongside slash commands: type `<prefix><command or alias> [args]` (e.g. `Chlplay`, `Chlp`, `ChlNP`) in any text channel. Prefix defaults to `Chl`, configurable via `PREFIX` in `.env`; matching is case-insensitive and space-before-command-optional. Implemented in `utils/textCommands.js`, which adapts a `Message` into a fake `Interaction` so every command's existing `execute(interaction, client)` runs unmodified — new commands automatically get a text-command form. Requires the `MessageContent` gateway intent (now requested in `index.js`) and the Message Content Intent enabled in the Discord Developer Portal.
- `/set [time]` command to seek to a position in the current song (mm:ss or hh:mm:ss)
- `/nowplaying` command, showing the current song as an embed with cover art, duration, uploader and volume
- `/queue` now replies with an embed: song titles are clickable links to their source, each with its duration and a total queue duration in the footer
- The "added to queue" announcement is now an embed too (title link, duration, source, queue position), matching the "now playing" one — works the same regardless of source (YouTube, Spotify, SoundCloud). Styled as a lighter, secondary notification next to "now playing": a muted color and a small author icon instead of the big cover-art thumbnail.
- Shared `utils/embeds.js` styling (brand color, footer, timestamp) reused by `/queue`, `/nowplaying` and the automatic "now playing"/"added to queue" announcements

### Changed
- `/skip` on the last song in the queue now stops playback and waits (bot stays connected) instead of erroring with "no more songs to skip" while the song kept playing in the background. `queue.skip()` throws before touching anything when there's nothing next, so `skip.js` now calls `queue.stop()` in that case — same as `/stop` minus disconnecting — mirroring what already happens when a song ends naturally with an empty queue.
- `/play` with a plain-text query (not a URL) now defaults to YouTube instead of SoundCloud. DisTube's own search step only considers plugins typed `"extractor"` — SoundCloud is the only one configured that qualifies (`@distube/yt-dlp`'s is `"playable-extractor"`, never eligible there regardless of plugin order), which is why text search always went through SoundCloud before. `commands/play.js` now resolves plain-text queries directly through `YtDlpPlugin` (yt-dlp's own `ytsearchN:` syntax) and hands DisTube the resolved song, falling back to the old SoundCloud-search path only if yt-dlp genuinely finds nothing. Direct URLs (YouTube/Spotify/SoundCloud links) are unaffected. Trade-off: search now depends on yt-dlp/YouTube being reachable, same as links — previously a YouTube outage only broke links while text search kept working via SoundCloud.

### Fixed

- **Links fail with `Sign in to confirm you're not a bot` (2026-09)**: YouTube's bot-check tightened further and started blocking the `player_client=android`-only workaround. `entrypoint.sh` now requests a fallback chain (`player_client=tv,web_safari,android`) instead of a single client. This is a moving target — if it stops working again, rebuild the image to pick up a newer yt-dlp (`npm run setup:ytdlp` / `docker compose build --no-cache`) or mount a `cookies.txt`, the only fully reliable fix.
- **Links don't play (text searches do)**: @distube/yt-dlp's `download()` resolves its promise before the binary write finishes, and the Dockerfile's immediate `process.exit(0)` left a 0-byte binary in the image. Searches kept working because they go through SoundCloud (they don't use yt-dlp); links always failed.
  - The plugin patch now waits for the write and makes `json()` reject with a clear error if yt-dlp exits with no output (previously: crash from `JSON.parse('')`).
  - New `scripts/download-ytdlp.js` (`npm run setup:ytdlp`): downloads and validates the binary size; the Dockerfile uses it and fails the build if the download is incomplete.
  - The bot checks the binary on startup and stops with an actionable message if it's missing or truncated.

## [1.2.1] - 2026-08-02

### Changed
- `/play` shows "📃 Loading playlist..." for playlist/album/radio URLs (YouTube, Spotify, SoundCloud) instead of the generic "🔍 Searching:", so the resolution wait doesn't look like a hang
- Song limit per playlist/radio reduced from 25 to 15 (yt-dlp extraction is sequential: ~1.5s per song; a 25-song playlist took ~42s)

## [1.2.0] - 2026-08-02

### Added
- Spotify Developer credentials (SPOTIFY_CLIENT_ID/SPOTIFY_CLIENT_SECRET) for full playlist and album playback via the official Spotify API

### Changed
- SpotifyPlugin uses the official API when credentials are present in `.env`; without them it keeps the previous behavior (basic metadata only)

## [1.1.0] - 2026-08-02

### Added
- Usage validations as ephemeral responses (only the requesting user sees them) in play, stop, skip, pause, resume, volume, leave and queue
- Tests for execution errors in pause/resume and trimming punctuation from pasted URLs
- Anti-overlap guard on the periodic command update (every 6h)
- Automatic cleanup of expired entries in the cooldowns Map
- CLIENT_ID fallback in update-commands.js to avoid a PUT to `/applications/undefined/commands`

### Changed
- skip.js distinguishes "no more songs" from real errors when skipping
- cleanQuery trims trailing punctuation stuck to URLs (e.g. `https://...watch?v=x).`)
- .dockerignore excludes tests, runtime state and cookies from the build
- .gitignore no longer ignores package-lock.json (it must stay committed for `npm ci`)

### Fixed
- Command loading ignores non-`.js` files in the commands folder (was causing a crash loop)
- stop.js replied to the channel error as a public message; now it's ephemeral

## [1.0.0] - 2025-05-25

### Added
- Basic commands: play, pause, resume, stop, skip, queue, volume, help
- Support for YouTube, Spotify and SoundCloud
- Initial documentation
- Global command registration
- Multi-server configuration

### Removed
- Unnecessary utility commands (stats, ping, nowplaying)
