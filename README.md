# GordoDJ - Discord Music Bot

[Español](README.es.md) · **English**

A Discord music bot that plays music from YouTube, Spotify and SoundCloud directly in your voice channels.

## Features

- Music from multiple sources (YouTube, Spotify, SoundCloud)
- Playback control commands (play, pause, resume, skip, stop)
- Volume control
- Playback queue with a 100-song limit
- Playlist support (playlists are capped at 15 songs to avoid hanging on infinite radio lists)
- Access control: only users in the same voice channel as the bot can control it
- 5s per-user cooldown on `/play` to prevent abuse
- Validation errors are ephemeral (only the requesting user sees them)

## Commands

- `/play [song]` - Plays a song or playlist (URL or text search)
- `/stop` - Stops playback and leaves the voice channel
- `/skip` - Skips to the next song
- `/pause` - Pauses the current song
- `/resume` - Resumes the paused song
- `/queue` - Shows the songs in the queue (as an embed, with clickable titles and durations)
- `/nowplaying` - Shows the currently playing song (as an embed, with cover art)
- `/volume [1-100]` - Changes the bot volume
- `/set [time]` - Changes the playback position (mm:ss or hh:mm:ss)
- `/leave` - Makes the bot leave the voice channel
- `/help` - Shows the available commands

Every command is also available as a text command: type the prefix (default `Chl`, configurable via `PREFIX` in `.env`) followed by the command name or a short alias, case-insensitive and with no space needed — e.g. `Chlplay a song`, `ChlNP`, `chl q`. Aliases: `p` (play), `st` (stop), `s`/`next` (skip), `ps` (pause), `r`/`unpause` (resume), `q`/`list` (queue), `np`/`now` (nowplaying), `v`/`vol` (volume), `seek` (set), `l`/`dc` (leave), `h` (help). See [utils/textCommands.js](utils/textCommands.js) to add more. Requires the **Message Content Intent** enabled in the Discord Developer Portal (see below).

## Requirements

- Node.js v20.18.1 or higher
- FFmpeg installed on the system (the Docker container includes it)
- Discord bot token
- Discord application ID

## Installation

1. Clone this repository:
   ```
   git clone https://github.com/santino-rosso/BotMusicaDiscord.git
   cd BotMusicaDiscord
   ```

2. Install dependencies and the yt-dlp binary:
   ```
   npm install
   npm run setup:ytdlp
   ```

3. Create a `.env` file in the project root:
   ```
   TOKEN=your_discord_token
   CLIENT_ID=your_application_id
   ```

4. (Optional) For full Spotify playlist/album support, create an app in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and add the credentials to `.env`:
   ```
   SPOTIFY_CLIENT_ID=your_spotify_client_id
   SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
   ```
   Without them, Spotify works partially (individual tracks only). Audio is always streamed from YouTube; the credentials only enable full list resolution.

5. Start the bot:
   ```
   node index.js
   ```

Slash commands are registered automatically on startup (and re-synced every 6 hours if they change).

### Docker

```bash
docker compose up -d --build
```

The container includes a real healthcheck (heartbeat every 30s), memory/CPU limits and log rotation.

## Discord Developer Portal setup

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application or select an existing one
3. Go to the "Bot" section and generate a token (store it in `.env`)
4. Go to OAuth2 > URL Generator, select the "bot" and "applications.commands" scopes
5. Select the permissions: View Channels, Send Messages, Embed Links, Read Message History, Connect, Speak
6. Use the generated URL to invite the bot to your servers
7. Under the "Bot" section, enable **Message Content Intent** — required for text/prefix commands (see [Commands](#commands)) to read message content. `Guilds`, `GuildMessages` and `GuildVoiceStates` are also needed but are non-privileged. You do not need Server Members or Presence.

## YouTube cookies (fixing the bot-check)

YouTube sometimes blocks the bot with `Sign in to confirm you're not a bot`. This affects direct YouTube links *and* Spotify (which streams audio via YouTube under the hood) — SoundCloud is unaffected either way. The fix is a `cookies.txt` from a real, logged-in YouTube session.

**Easiest: the built-in cookie upload page.** Set in `.env`:
```
COOKIE_SERVER_PORT=8080
```
On Docker, also run `touch cookies.txt` in the project root before the first `docker compose up` (otherwise Docker auto-creates the mount target as a root-owned stub the bot can't write to — see the comment in `docker-compose.yml`). Start/restart the bot, then check the logs (`docker logs gordodj-bot` or your console) for a line like:
```
🍪 Cookie upload page: http://localhost:8080/?token=<random-token>
```
Open that URL — the page has a step-by-step tutorial (using the "Get cookies.txt LOCALLY" or "Cookie-Editor" browser extension) and a form to submit the cookies. No restart needed; it takes effect on the next request. Set `COOKIE_SERVER_TOKEN` in `.env` to fix the token instead of a new random one each restart, and treat that URL as a secret — anyone with it can overwrite the bot's YouTube session. If you're exposing this on a public VM, restrict the port with a firewall/VPN rather than relying on the token alone.

**Manual alternative**: export a Netscape-format `cookies.txt` yourself (e.g. `yt-dlp --cookies-from-browser chrome --cookies cookies.txt`) and drop it in the project root — the container picks it up the same way.

Cookies expire/rotate, so you may need to redo this occasionally.

## Troubleshooting

- **"Could not play" / `Sign in to confirm you're not a bot`**: see [YouTube cookies](#youtube-cookies-fixing-the-bot-check) above. The bot also tries a fallback chain of yt-dlp player clients (`tv`, `web_safari`, `android`) to reduce how often this happens, but YouTube's bot-check keeps tightening and no client-spoofing trick is permanently reliable — cookies are the only fully reliable fix. Also make sure yt-dlp itself is current (`npm run setup:ytdlp` or `docker compose build --no-cache`); an outdated binary is the next most common cause.
- **Links don't work but text searches do**: the yt-dlp binary is missing or was truncated (interrupted download during a build). Searches don't use yt-dlp (they go through SoundCloud), so only links fail. The bot checks the binary on startup and warns you; fix it with `npm run setup:ytdlp` or by rebuilding the image (`docker compose build`).
- **The bot does not respond**: verify it is `healthy` (`docker ps`) and that the `.env` token is valid.

## Dependencies

- discord.js - Framework for interacting with the Discord API
- distube - Music player for discord.js
- @distube/yt-dlp - YouTube extraction plugin
- @distube/spotify - Spotify support plugin
- @distube/soundcloud - SoundCloud support plugin
- dotenv - Environment variables management

## Testing

```bash
npm test                  # Unit tests (node:test, no network or extra dependencies)
npm run test:integration  # Opt-in: real network against YouTube (requires local yt-dlp binary)
```

Integration tests (`test/integration/`) are skipped in `npm test`; they cover individual video resolution and bounded RD radio lists (`--playlist-end 15`).

## Future improvements

- **Scaling to hundreds/thousands of servers**: sharding (one instance per shard) + Redis for shared state + a separate audio service (Lavalink) + rotating cookies/proxies for yt-dlp. The code is already prepared (guild-isolated queue state in DisTube, no fragile global state); apply when the bot reaches ~100+ servers or approaches the practical discord.js guild limit (~2,500).

## Contributing

Want to contribute? Read [CONTRIBUTING.md](CONTRIBUTING.md) — golden rules: never commit secrets, always with tests, conventional commits.

## License

[MIT](LICENSE)

## Author

[Santino Rosso](https://github.com/santino-rosso)
