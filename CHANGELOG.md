# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

- Anti-RCE hardening: blocks queries starting with `-` (yt-dlp flag injection) and non-http(s) protocols (`file://` → LFI).
- The yt-dlp binary no longer auto-updates at runtime: it's downloaded at build time and node_modules stays immutable in the container.

### Added
- Text/prefix commands alongside slash commands: type `<prefix><command or alias> [args]` (e.g. `Chlplay`, `Chlp`, `ChlNP`) in any text channel. Prefix defaults to `Chl`, configurable via `PREFIX` in `.env`; matching is case-insensitive and space-before-command-optional. Implemented in `utils/textCommands.js`, which adapts a `Message` into a fake `Interaction` so every command's existing `execute(interaction, client)` runs unmodified — new commands automatically get a text-command form. Requires the `MessageContent` gateway intent (now requested in `index.js`) and the Message Content Intent enabled in the Discord Developer Portal.
- `/set [time]` command to seek to a position in the current song (mm:ss or hh:mm:ss)
- `/nowplaying` command, showing the current song as an embed with cover art, duration, uploader and volume
- `/queue` now replies with an embed: song titles are clickable links to their source, each with its duration and a total queue duration in the footer
- The "added to queue" announcement is now an embed too (title link, thumbnail, duration, source, queue position), matching the "now playing" one — works the same regardless of source (YouTube, Spotify, SoundCloud)
- Shared `utils/embeds.js` styling (brand color, footer, timestamp) reused by `/queue`, `/nowplaying` and the automatic "now playing"/"added to queue" announcements

### Fixed

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
