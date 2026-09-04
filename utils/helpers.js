const path = require('path');

const MAX_QUEUE_SIZE = 100;

// Reasonable minimum size for the yt-dlp binary (~3MB in practice). Less than
// this = truncated/empty download: yt-dlp can't run, so both plain-text
// searches (default to YouTube, see commands/play.js) and links fail.
const YT_DLP_MIN_BYTES = 1024 * 1024;

// Stores `{ at: timestamp }` per key so expired entries can be pruned and the
// Map doesn't grow unbounded on busy servers.
const cooldowns = new Map();

function checkCooldown(key, ms) {
  const now = Date.now();

  // Prune expired entries: only the Map is scanned, which stays small in
  // practice (one key per channel/action). Avoids memory leaks.
  for (const [storedKey, entry] of cooldowns) {
    if (now - entry.at >= ms) cooldowns.delete(storedKey);
  }

  const entry = cooldowns.get(key);
  if (entry && now - entry.at < ms) return true;
  cooldowns.set(key, { at: now });
  return false;
}

function assertControl(interaction, botChannelId) {
  const memberChannel = interaction.member?.voice?.channel;
  if (!memberChannel) return '❌ You must be in a voice channel.';
  if (botChannelId && memberChannel.id !== botChannelId) {
    return '❌ You must be in the same voice channel as the bot.';
  }
  return null;
}

// Normalizes the user's query. If they pasted the bot's own message text
// (e.g. `🔍 Searching: \`https://...\``) or a URL wrapped in backticks,
// extracts the real URL. If there's no URL, returns the cleaned text.
function cleanQuery(raw) {
  if (typeof raw !== 'string') return '';
  let text = raw.trim();
  const urlMatch = text.match(/https?:\/\/[^\s'`"<>]+/);
  if (urlMatch) {
    // Trim trailing punctuation stuck to the URL (e.g. "https://...youtube.com/watch?v=x).")
    // that users often include when copying from chat or the browser.
    return urlMatch[0].replace(/[.,;:!?)]+$/, '');
  }
  if (text.length > 1 && text.startsWith('`') && text.endsWith('`')) {
    text = text.slice(1, -1).trim();
  }
  return text;
}

// Detects whether a query is a playlist/album/radio URL (YouTube, Spotify,
// SoundCloud) to show the appropriate loading message. The set is explicit:
// adding a new source here updates both this check and the UX.
function isPlaylistUrl(raw) {
  if (typeof raw !== 'string') return false;
  return /(youtube\.com|youtu\.be).*(playlist|list=)|open\.spotify\.com\/(playlist|album)|soundcloud\.com\/[^/]+\/sets\//.test(raw);
}

// Returns an error message if the query is unsafe (null if it's safe).
// Security: blocks yt-dlp flag injection (queries starting with "-")
// and non-http(s) protocols (LFI via file://).
function getQueryError(query) {
  if (typeof query !== 'string' || !query.trim()) return '❌ Enter a name or URL.';
  if (query.startsWith('-')) return '❌ That search term is not valid.';
  const protocolMatch = query.match(/^[a-z][a-z0-9+.-]*:\/\//i);
  if (protocolMatch && !/^https?:\/\//i.test(query)) return '❌ Only http(s) links are supported.';
  return null;
}

// Pure verdict on the yt-dlp binary (testable without fs), same pattern as
// evaluateHealth in healthcheck.js. Used to fail fast on startup with an
// actionable message instead of failing on a link mid-session.
function evaluateYtDlpBinary({ exists, size }) {
  const fix = 'Fix it with `npm run setup:ytdlp` (local) or by rebuilding the image (`docker compose build`) in Docker.';
  if (!exists) {
    return { ok: false, reason: `❌ Missing yt-dlp binary (${fix})` };
  }
  if (!Number.isFinite(size) || size < YT_DLP_MIN_BYTES) {
    return { ok: false, reason: `❌ The yt-dlp binary is empty or truncated (${size ?? 'unknown size'} bytes). ${fix}` };
  }
  return { ok: true };
}

// Turns a DisTube/yt-dlp playback error into a specific, actionable message
// when the cause is recognized; otherwise returns `fallback`. Used by both
// /play's catch block and the DisTube 'error' event so the message a user
// sees in Discord — not just the server logs — says *why* it failed. This
// matters here because YouTube links AND Spotify (which streams audio via
// YouTube under the hood) both go through yt-dlp, so a YouTube bot-check
// breaks both at once while SoundCloud (self-contained) keeps working —
// without this, that looks like three unrelated failures instead of one cause.
function describePlaybackError(error, fallback = '❌ Could not play. Try another name or URL.') {
  const message = String(error?.message ?? error ?? '');
  if (/sign in to confirm/i.test(message)) {
    return '❌ YouTube is blocking this server with a bot-check (affects YouTube links and Spotify, which streams audio via YouTube — SoundCloud is unaffected). Ask the bot owner to add a `cookies.txt` file (see the README Troubleshooting section).';
  }
  return fallback;
}

// Builds the yt-dlp user config file content. Shared by scripts/write-ytdlp-config.js
// (run at container boot by entrypoint.sh) and web/cookieServer.js (run again
// whenever a new cookies.txt is submitted through the web form, so the change
// applies immediately without a container restart) — keeping this in one
// place means both stay in sync instead of duplicating it in shell and JS.
function buildYtDlpConfig({ cookiesExist, cookiesPath } = {}) {
  const lines = [
    '--js-runtimes node',
    '--extractor-args youtube:player_client=tv,web_safari,android',
    '--playlist-end 15',
  ];
  if (cookiesExist && cookiesPath) lines.push(`--cookies ${cookiesPath}`);
  return `${lines.join('\n')}\n`;
}

// Resolves the yt-dlp binary path the same way @distube/yt-dlp does
// internally (env.ts): honors YTDLP_DIR/YTDLP_FILENAME to avoid diverging.
function ytDlpBinaryPath() {
  const dir = process.env.YTDLP_DIR || path.join(path.dirname(require.resolve('@distube/yt-dlp')), '..', 'bin');
  const filename = process.env.YTDLP_FILENAME || `yt-dlp${process.platform === 'win32' ? '.exe' : ''}`;
  return path.join(dir, filename);
}

module.exports = { MAX_QUEUE_SIZE, YT_DLP_MIN_BYTES, checkCooldown, assertControl, cleanQuery, isPlaylistUrl, getQueryError, describePlaybackError, buildYtDlpConfig, evaluateYtDlpBinary, ytDlpBinaryPath };
