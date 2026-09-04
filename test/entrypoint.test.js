'use strict';

// Unit test for the entrypoint: verifies it delegates yt-dlp config
// generation to scripts/write-ytdlp-config.js (tested separately in
// test/write-ytdlp-config.test.js) and then execs the bot. The actual config
// content used to be hardcoded here in shell; it's now shared JS so the web
// cookie form can regenerate it too — see write-ytdlp-config.test.js for the
// flag-content assertions this file used to own.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ENTRYPOINT = path.join(__dirname, '..', 'entrypoint.sh');
const source = fs.readFileSync(ENTRYPOINT, 'utf8');

test('entrypoint.sh runs scripts/write-ytdlp-config.js before starting the bot', () => {
  assert.match(source, /node scripts\/write-ytdlp-config\.js/);
});

test('entrypoint.sh execs node index.js as the final step', () => {
  assert.match(source, /exec node index\.js/);
});

test('entrypoint.sh fails fast on error (set -e)', () => {
  assert.match(source, /^set -e$/m);
});

test('entrypoint.sh re-chowns /app/data on every boot regardless of what the volume driver left it as', () => {
  assert.match(source, /chown -R nodejs:nodejs \/app\/data/);
});

test('entrypoint.sh drops root via gosu before running anything else', () => {
  assert.match(source, /exec gosu nodejs/);
});

