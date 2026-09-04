'use strict';

// A tiny built-in web UI for updating cookies.txt without shelling into the
// server. Deliberately dependency-free (Node's http module only) — the whole
// point is to make this the *easy* path, so it shouldn't need `npm install`
// of anything new.
//
// Auth is opt-in: set COOKIE_SERVER_TOKEN to require a matching ?token= on
// every request; leave it unset and the page is fully open to anyone who can
// reach the port. This handles YouTube session cookies — whoever can submit
// the form can make the bot act as that YouTube account — so if this is
// reachable from the public internet, set COOKIE_SERVER_TOKEN.

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { writeYtDlpConfig, DEFAULT_COOKIES_PATH } = require('../scripts/write-ytdlp-config');

const MAX_BODY_BYTES = 512 * 1024; // Netscape cookies.txt files are a few KB; this is generous

function timingSafeEqualStrings(a, b) {
  const bufA = Buffer.from(String(a ?? ''));
  const bufB = Buffer.from(String(b ?? ''));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Loose sanity check, not a strict parser: rejects empty input and the most
// common mistake (pasting the JSON export instead of picking "Netscape").
function looksLikeNetscapeCookies(text) {
  if (typeof text !== 'string' || !text.trim()) return false;
  if (text.includes('# Netscape HTTP Cookie File')) return true;
  return text
    .split('\n')
    .some((line) => line.trim() && !line.startsWith('#') && line.split('\t').length >= 7);
}

// Defensive only: cookiesPath is expected to live inside a mounted directory
// (see docker-compose.yml), never be a mount point itself, so this shouldn't
// normally fire. If it's ever a plain leftover directory (not an active
// mount — those can't be removed this way, see write-ytdlp-config.js), clear
// it so writeFileSync doesn't fail with EISDIR.
function clearDirectoryStub(filePath) {
  try {
    if (fs.statSync(filePath).isDirectory()) fs.rmdirSync(filePath);
  } catch {
    // ENOENT, or EBUSY on an actual mount point: nothing we can do from here
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function renderPage({ token, cookiesConfigured, status, message }) {
  const tokenField = token ? `<input type="hidden" name="token" value="${escapeHtml(token)}">` : '';
  const banner = status
    ? `<p class="banner ${status}">${escapeHtml(message)}</p>`
    : '';
  const statusLine = cookiesConfigured
    ? '<p class="status ok">✅ Cookies are currently configured.</p>'
    : '<p class="status warn">⚠️ No cookies configured yet — YouTube links and Spotify may fail with a bot-check.</p>';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>GordoDJ — YouTube cookies</title>
<meta name="robots" content="noindex">
<style>
  :root { color-scheme: light dark; }
  body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; }
  h1 { font-size: 1.4rem; }
  h2 { font-size: 1.1rem; margin-top: 2rem; }
  textarea { width: 100%; box-sizing: border-box; font-family: monospace; font-size: 0.85rem; }
  .banner { padding: 0.75rem 1rem; border-radius: 6px; font-weight: 600; }
  .banner.success { background: #d1fae5; color: #065f46; }
  .banner.error { background: #fee2e2; color: #991b1b; }
  .status { padding: 0.5rem 0.75rem; border-radius: 6px; display: inline-block; }
  .status.ok { background: #d1fae5; color: #065f46; }
  .status.warn { background: #fef3c7; color: #92400e; }
  ol { padding-left: 1.25rem; }
  code { background: rgba(127,127,127,0.15); padding: 0.1rem 0.35rem; border-radius: 4px; }
  .step { margin-bottom: 1.25rem; }
  button { padding: 0.6rem 1.2rem; font-size: 1rem; cursor: pointer; }
</style>
</head>
<body>
<h1>🍪 GordoDJ — YouTube cookies</h1>
<p>YouTube sometimes blocks the bot with "Sign in to confirm you're not a bot". Adding cookies from a real, logged-in YouTube session fixes it. This affects direct YouTube links <em>and</em> Spotify (which streams audio via YouTube) — SoundCloud is unaffected either way.</p>
${statusLine}
${banner}

<h2>How to get your cookies</h2>
<div class="step">
  <strong>Option A (recommended): Get cookies.txt LOCALLY</strong> — exports directly in the right format, no extra steps.
  <ol>
    <li>Install the extension: <a href="https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc" target="_blank" rel="noopener">Chrome Web Store</a> · <a href="https://addons.mozilla.org/en-US/firefox/addon/get-cookies-txt-locally/" target="_blank" rel="noopener">Firefox Add-ons</a></li>
    <li>Log into <a href="https://www.youtube.com" target="_blank" rel="noopener">youtube.com</a> in that browser with the account you want the bot to use.</li>
    <li>While on youtube.com, click the extension icon, then <strong>Export</strong>. It downloads a <code>cookies.txt</code> file.</li>
    <li>Below, click <strong>Choose file</strong> and pick that downloaded file (or open it in a text editor and paste its contents instead).</li>
  </ol>
</div>
<div class="step">
  <strong>Option B: Cookie-Editor</strong>
  <ol>
    <li>Install it from the official site: <a href="https://cookie-editor.com/" target="_blank" rel="noopener">cookie-editor.com</a> (links to Chrome, Firefox, Edge, Safari, Opera).</li>
    <li>Log into <a href="https://www.youtube.com" target="_blank" rel="noopener">youtube.com</a> with the account you want the bot to use.</li>
    <li>Click the extension icon, then <strong>Export</strong> and choose the <strong>Netscape</strong> format (not JSON).</li>
    <li>Paste the exported text into the box below.</li>
  </ol>
</div>
<p>Use an account you're comfortable dedicating to this — the bot will act as it for every stream request, and cookies expire/rotate, so you may need to redo this occasionally.</p>

<h2>Submit</h2>
<form method="POST" action="/cookies">
  ${tokenField}
  <p><input type="file" id="file" accept=".txt"></p>
  <p><textarea name="cookies" id="cookies" rows="12" placeholder="# Netscape HTTP Cookie File&#10;.youtube.com  TRUE  /  TRUE  0  ..."></textarea></p>
  <button type="submit">Save cookies</button>
</form>

<script>
  document.getElementById('file').addEventListener('change', function (e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () { document.getElementById('cookies').value = reader.result; };
    reader.readAsText(file);
  });
</script>
</body>
</html>`;
}

function startCookieServer({ port, token, cookiesPath = DEFAULT_COOKIES_PATH, configPath } = {}) {
  const resolvedPort = Number(port ?? process.env.COOKIE_SERVER_PORT ?? 8080);
  // null means "no auth required" (see the file-level comment). Explicit
  // `undefined` (i.e. not passed at all) falls through to the environment;
  // an explicit `null` forces it off regardless of the environment, which
  // tests rely on for a deterministic "no auth" mode.
  const resolvedToken = token !== undefined ? token : (process.env.COOKIE_SERVER_TOKEN || null);
  const authorized = (providedToken) => resolvedToken === null || timingSafeEqualStrings(providedToken, resolvedToken);

  const cookiesConfigured = () => {
    try {
      const stat = fs.statSync(cookiesPath);
      return stat.isFile() && stat.size > 0;
    } catch {
      return false;
    }
  };

  const server = http.createServer((req, res) => {
    let url;
    try {
      url = new URL(req.url, 'http://localhost');
    } catch {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Bad request.');
      return;
    }

    if (req.method === 'GET' && url.pathname === '/') {
      const providedToken = url.searchParams.get('token');
      if (!authorized(providedToken)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden: missing or invalid token.');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(renderPage({ token: providedToken, cookiesConfigured: cookiesConfigured() }));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/cookies') {
      let body = '';
      let tooLarge = false;
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > MAX_BODY_BYTES) {
          tooLarge = true;
          req.destroy();
        }
      });
      req.on('end', () => {
        if (tooLarge) {
          res.writeHead(413, { 'Content-Type': 'text/plain' });
          res.end('Payload too large.');
          return;
        }

        const params = new URLSearchParams(body);
        const providedToken = params.get('token');
        const cookiesText = params.get('cookies') || '';

        if (!authorized(providedToken)) {
          res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(renderPage({ token: providedToken || '', cookiesConfigured: cookiesConfigured(), status: 'error', message: 'Invalid token.' }));
          return;
        }

        if (!looksLikeNetscapeCookies(cookiesText)) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(renderPage({
            token: providedToken,
            cookiesConfigured: cookiesConfigured(),
            status: 'error',
            message: "That doesn't look like a Netscape-format cookies file. Make sure you exported using the \"Netscape\" format option, not JSON.",
          }));
          return;
        }

        try {
          fs.mkdirSync(path.dirname(cookiesPath), { recursive: true });
          clearDirectoryStub(cookiesPath);
          fs.writeFileSync(cookiesPath, cookiesText.endsWith('\n') ? cookiesText : `${cookiesText}\n`);
          writeYtDlpConfig({ cookiesPath, ...(configPath ? { configPath } : {}) });
        } catch (error) {
          console.error('Error saving cookies.txt:', error);
          res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(renderPage({ token: providedToken, cookiesConfigured: cookiesConfigured(), status: 'error', message: 'Could not save the cookies file on the server.' }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(renderPage({
          token: providedToken,
          cookiesConfigured: true,
          status: 'success',
          message: 'Cookies saved. yt-dlp will use them on the next request — no restart needed.',
        }));
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found.');
  });

  server.listen(resolvedPort, () => {
    const base = `http://localhost:${server.address().port}/`;
    if (resolvedToken === null) {
      console.log(`🍪 Cookie upload page (NO AUTH — set COOKIE_SERVER_TOKEN to lock it down): ${base}`);
    } else {
      console.log(`🍪 Cookie upload page: ${base}?token=${resolvedToken}`);
    }
  });

  return server;
}

module.exports = { startCookieServer, looksLikeNetscapeCookies, timingSafeEqualStrings };
