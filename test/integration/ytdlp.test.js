'use strict';

// Tests de integración opt-in: usan red real contra YouTube y el binario
// yt-dlp local (node_modules/@distube/yt-dlp/bin/yt-dlp). NO corren con
// `npm test`; se ejecutan explícitamente con `npm run test:integration`
// (requiere TEST_INTEGRATION=1, seteado por el propio script).
//
// Estos tests cubren los dos fallos de producción de 2026-08:
//  1. Resolución de un video individual (bot-check / config de yt-dlp).
//  2. Radios RD (listas ilimitadas) — deben resolverse acotadas por
//     --playlist-end 25, aplicado vía config temporal de yt-dlp.

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
        : 'opt-in: corré con `npm run test:integration`',
    },
    fn,
  );
}

// Directorio temporal con config de yt-dlp (--playlist-end) para aislar el
// test de la config del sistema. Devuelve cleanup que restaura el entorno.
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
  '@integration: resuelve un video individual de YouTube',
  { timeout: 90_000 },
  async () => {
    const cleanup = withTmpYtDlpConfig(['--js-runtimes node', '--extractor-args youtube:player_client=android']);
    try {
      const plugin = new YtDlpPlugin({ update: false });
      const song = await plugin.resolve(
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        { member: { id: 'test' } },
      );
      assert.ok(song, 'resolve() devolvió undefined');
      assert.match(song.url, /youtube\.com/, 'la URL resuelta debe ser de YouTube');
      assert.ok(song.name.length > 0, 'el nombre no debe estar vacío');
    } finally {
      cleanup();
    }
  },
);

integrationTest(
  '@integration: una radio RD se resuelve acotada por --playlist-end 25',
  { timeout: 120_000 },
  async () => {
    const cleanup = withTmpYtDlpConfig([
      '--js-runtimes node',
      '--extractor-args youtube:player_client=android',
      '--playlist-end 25',
    ]);
    try {
      const plugin = new YtDlpPlugin({ update: false });
      const playlist = await plugin.resolve(
        'https://www.youtube.com/watch?v=GK4nqwzLevY&list=RDGK4nqwzLevY&start_radio=1',
        { member: { id: 'test' } },
      );
      assert.ok(playlist, 'resolve() devolvió undefined');
      assert.ok(Array.isArray(playlist.songs), 'debe devolver una playlist');
      assert.ok(playlist.songs.length > 0, 'la playlist no debe estar vacía');
      assert.ok(
        playlist.songs.length <= 25,
        `la playlist debe estar acotada a 25, recibí ${playlist.songs.length}`,
      );
    } finally {
      cleanup();
    }
  },
);
