'use strict';

// Opt-in integration tests: use real network against YouTube and the local
// yt-dlp binary (node_modules/@distube/yt-dlp/bin/yt-dlp). They do NOT run
// with `npm test`; run them explicitly with `npm run test:integration`
// (requires TEST_INTEGRATION=1, set by the script itself).
//
// These tests cover the two production failures from 2026-08:
//  1. Resolving a single video (bot-check / yt-dlp config).
//  2. RD radios (unbounded lists) — must resolve bounded by
//     --playlist-end 25, applied via a temporary yt-dlp config.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { YtDlpPlugin } = require('@distube/yt-dlp');

const INTEGRATION_ENABLED = process.env.TEST_INTEGRATION === '1';

function integrationTest(name, options, fn) {
  test(
    name,
    {
      ...options,
      skip: INTEGRATION_ENABLED
        ? false
        : 'opt-in: run with `npm run test:integration`',
    },
    fn,
  );
}

// Temporary directory with a yt-dlp config (--playlist-end) to isolate the
// test from the system config. Returns a cleanup function that restores the environment.
function withTmpYtDlpConfig(lines) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ytdlp-int-'));
  const cfgDir = path.join(tmp, 'yt-dlp');
  fs.mkdirSync(cfgDir, { recursive: true });
  fs.writeFileSync(path.join(cfgDir, 'config'), lines.join('\n') + '\n');
  const prevXdg = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = tmp;
  return () => {
    if (prevXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = prevXdg;
    fs.rmSync(tmp, { recursive: true, force: true });
  };
}

integrationTest(
  '@integration: resolves a single YouTube video',
  { timeout: 90_000 },
  async () => {
    const cleanup = withTmpYtDlpConfig(['--js-runtimes node', '--extractor-args youtube:player_client=tv,web_safari,android']);
    try {
      const plugin = new YtDlpPlugin({ update: false });
      const song = await plugin.resolve(
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        { member: { id: 'test' } },
      );
      assert.ok(song, 'resolve() returned undefined');
      assert.match(song.url, /youtube\.com/, 'the resolved URL should be a YouTube URL');
      assert.ok(song.name.length > 0, 'the name should not be empty');
    } finally {
      cleanup();
    }
  },
);

integrationTest(
  '@integration: an RD radio resolves bounded by --playlist-end 25',
  { timeout: 120_000 },
  async () => {
    const cleanup = withTmpYtDlpConfig([
      '--js-runtimes node',
      '--extractor-args youtube:player_client=tv,web_safari,android',
      '--playlist-end 25',
    ]);
    try {
      const plugin = new YtDlpPlugin({ update: false });
      const playlist = await plugin.resolve(
        'https://www.youtube.com/watch?v=GK4nqwzLevY&list=RDGK4nqwzLevY&start_radio=1',
        { member: { id: 'test' } },
      );
      assert.ok(playlist, 'resolve() returned undefined');
      assert.ok(Array.isArray(playlist.songs), 'should return a playlist');
      assert.ok(playlist.songs.length > 0, 'the playlist should not be empty');
      assert.ok(
        playlist.songs.length <= 25,
        `the playlist should be bounded to 25, got ${playlist.songs.length}`,
      );
    } finally {
      cleanup();
    }
  },
);
