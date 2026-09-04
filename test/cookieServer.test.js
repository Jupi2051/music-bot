'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { startCookieServer, looksLikeNetscapeCookies, timingSafeEqualStrings } = require('../web/cookieServer');

const NETSCAPE_SAMPLE = '# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t0\tFOO\tbar\n';

describe('looksLikeNetscapeCookies', () => {
  test('accepts content with the Netscape header', () => {
    assert.equal(looksLikeNetscapeCookies(NETSCAPE_SAMPLE), true);
  });

  test('accepts a tab-separated line even without the header', () => {
    assert.equal(looksLikeNetscapeCookies('.youtube.com\tTRUE\t/\tTRUE\t0\tFOO\tbar'), true);
  });

  test('rejects a JSON export (the common mistake)', () => {
    assert.equal(looksLikeNetscapeCookies('[{"name":"FOO","value":"bar","domain":".youtube.com"}]'), false);
  });

  test('rejects empty or non-string input', () => {
    assert.equal(looksLikeNetscapeCookies(''), false);
    assert.equal(looksLikeNetscapeCookies('   '), false);
    assert.equal(looksLikeNetscapeCookies(null), false);
    assert.equal(looksLikeNetscapeCookies(undefined), false);
  });
});

describe('timingSafeEqualStrings', () => {
  test('true for identical strings', () => {
    assert.equal(timingSafeEqualStrings('abc123', 'abc123'), true);
  });

  test('false for different strings of the same length', () => {
    assert.equal(timingSafeEqualStrings('abc123', 'abc124'), false);
  });

  test('false for different lengths without throwing', () => {
    assert.equal(timingSafeEqualStrings('short', 'a-much-longer-string'), false);
  });

  test('false when either side is missing', () => {
    assert.equal(timingSafeEqualStrings(null, 'abc'), false);
    assert.equal(timingSafeEqualStrings('abc', undefined), false);
  });
});

describe('cookie server (http)', () => {
  function withServer(t, fn, { token = 'test-token' } = {}) {
    return withTmpDir((dir) => {
      const cookiesPath = path.join(dir, 'cookies.txt');
      const configPath = path.join(dir, 'config');
      const server = startCookieServer({ port: 0, token, cookiesPath, configPath });
      t.after(() => server.close());
      return new Promise((resolve, reject) => {
        server.on('listening', async () => {
          try {
            const port = server.address().port;
            await fn({ port, cookiesPath, configPath });
            resolve();
          } catch (err) {
            reject(err);
          }
        });
      });
    });
  }

  function withTmpDir(fn) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cookie-server-'));
    return Promise.resolve(fn(dir)).finally(() => fs.rmSync(dir, { recursive: true, force: true }));
  }

  test('GET / without a token is forbidden', (t) => withServer(t, async ({ port }) => {
    const res = await fetch(`http://localhost:${port}/`);
    assert.equal(res.status, 403);
  }));

  test('GET / with the wrong token is forbidden', (t) => withServer(t, async ({ port }) => {
    const res = await fetch(`http://localhost:${port}/?token=wrong`);
    assert.equal(res.status, 403);
  }));

  test('GET / with the correct token serves the form with tutorial links', (t) => withServer(t, async ({ port }) => {
    const res = await fetch(`http://localhost:${port}/?token=test-token`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /<form/);
    assert.match(html, /cookie-editor\.com/);
    assert.match(html, /chromewebstore\.google\.com/);
    assert.match(html, /No cookies configured yet/);
    assert.match(html, /name="token" value="test-token"/);
  }));

  test('POST /cookies without a token is forbidden and does not write the file', (t) => withServer(t, async ({ port, cookiesPath }) => {
    const res = await fetch(`http://localhost:${port}/cookies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ cookies: NETSCAPE_SAMPLE }).toString(),
    });
    assert.equal(res.status, 403);
    assert.equal(fs.existsSync(cookiesPath), false);
  }));

  test('POST /cookies with non-Netscape content is rejected with a helpful message', (t) => withServer(t, async ({ port, cookiesPath }) => {
    const res = await fetch(`http://localhost:${port}/cookies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: 'test-token', cookies: '[{"name":"FOO"}]' }).toString(),
    });
    assert.equal(res.status, 400);
    const html = await res.text();
    assert.match(html, /look like a Netscape/);
    assert.equal(fs.existsSync(cookiesPath), false);
  }));

  test('POST /cookies with valid content saves the file and regenerates the yt-dlp config', (t) => withServer(t, async ({ port, cookiesPath, configPath }) => {
    const res = await fetch(`http://localhost:${port}/cookies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: 'test-token', cookies: NETSCAPE_SAMPLE }).toString(),
    });
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /saved/i);

    assert.equal(fs.readFileSync(cookiesPath, 'utf8'), NETSCAPE_SAMPLE);
    const config = fs.readFileSync(configPath, 'utf8');
    assert.ok(config.includes(`--cookies ${cookiesPath}`));
  }));

  test('a subsequent GET / reflects that cookies are now configured', (t) => withServer(t, async ({ port }) => {
    await fetch(`http://localhost:${port}/cookies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: 'test-token', cookies: NETSCAPE_SAMPLE }).toString(),
    });
    const res = await fetch(`http://localhost:${port}/?token=test-token`);
    const html = await res.text();
    assert.match(html, /Cookies are currently configured/);
  }));

  test('creates the parent directory when it does not exist yet', (t) => withTmpDir(async (dir) => {
    const cookiesPath = path.join(dir, 'data', 'cookies.txt');
    const configPath = path.join(dir, 'config');
    const server = startCookieServer({ port: 0, token: 'test-token', cookiesPath, configPath });
    t.after(() => server.close());
    await new Promise((resolve) => server.on('listening', resolve));
    const port = server.address().port;

    const res = await fetch(`http://localhost:${port}/cookies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: 'test-token', cookies: NETSCAPE_SAMPLE }).toString(),
    });
    assert.equal(res.status, 200);
    assert.equal(fs.readFileSync(cookiesPath, 'utf8'), NETSCAPE_SAMPLE);
  }));

  test('replaces a directory left at cookiesPath by a fresh Docker bind-mount', (t) => withServer(t, async ({ port, cookiesPath }) => {
    fs.rmSync(cookiesPath, { recursive: true, force: true });
    fs.mkdirSync(cookiesPath);

    const res = await fetch(`http://localhost:${port}/cookies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: 'test-token', cookies: NETSCAPE_SAMPLE }).toString(),
    });
    assert.equal(res.status, 200);
    assert.equal(fs.readFileSync(cookiesPath, 'utf8'), NETSCAPE_SAMPLE);
  }));

  test('an unknown route returns 404', (t) => withServer(t, async ({ port }) => {
    const res = await fetch(`http://localhost:${port}/nope`);
    assert.equal(res.status, 404);
  }));

  test('GET / with no token configured at all serves the form with no auth required', (t) => withServer(t, async ({ port }) => {
    const res = await fetch(`http://localhost:${port}/`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /<form/);
  }, { token: null }));

  test('POST /cookies with no token configured saves the file with no token field submitted', (t) => withServer(t, async ({ port, cookiesPath }) => {
    const res = await fetch(`http://localhost:${port}/cookies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ cookies: NETSCAPE_SAMPLE }).toString(),
    });
    assert.equal(res.status, 200);
    assert.equal(fs.readFileSync(cookiesPath, 'utf8'), NETSCAPE_SAMPLE);
  }, { token: null }));

  test('the rendered form omits the hidden token field when no token is configured', (t) => withServer(t, async ({ port }) => {
    const res = await fetch(`http://localhost:${port}/`);
    const html = await res.text();
    assert.doesNotMatch(html, /name="token"/);
  }, { token: null }));
});
