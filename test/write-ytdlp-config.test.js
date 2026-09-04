'use strict';

// Tests for scripts/write-ytdlp-config.js's fs-touching writeYtDlpConfig().
// The config-text logic itself is covered as a pure function in
// test/helpers.test.js (buildYtDlpConfig); this only checks that the right
// content lands in the right file given a real (temp) filesystem.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { writeYtDlpConfig, DEFAULT_DATA_DIR, DEFAULT_COOKIES_PATH } = require('../scripts/write-ytdlp-config');

function withTmpDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ytdlp-cfg-'));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe('writeYtDlpConfig', () => {
  test('writes a config without --cookies when cookies.txt does not exist', () => {
    withTmpDir((dir) => {
      const cookiesPath = path.join(dir, 'cookies.txt');
      const configPath = path.join(dir, 'config', 'config');
      const result = writeYtDlpConfig({ cookiesPath, configPath });

      assert.equal(result.cookiesExist, false);
      const content = fs.readFileSync(configPath, 'utf8');
      assert.match(content, /--js-runtimes node/);
      assert.doesNotMatch(content, /--cookies/);
    });
  });

  test('creates the config directory if it does not exist', () => {
    withTmpDir((dir) => {
      const configPath = path.join(dir, 'nested', 'deep', 'config');
      writeYtDlpConfig({ cookiesPath: path.join(dir, 'cookies.txt'), configPath });
      assert.ok(fs.existsSync(configPath));
    });
  });

  test('includes --cookies with the real path when cookies.txt exists and is non-empty', () => {
    withTmpDir((dir) => {
      const cookiesPath = path.join(dir, 'cookies.txt');
      const configPath = path.join(dir, 'config');
      fs.writeFileSync(cookiesPath, '# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t0\tFOO\tbar\n');

      const result = writeYtDlpConfig({ cookiesPath, configPath });

      assert.equal(result.cookiesExist, true);
      const content = fs.readFileSync(configPath, 'utf8');
      assert.ok(content.includes(`--cookies ${cookiesPath}`));
    });
  });

  test('treats an empty cookies.txt as not present', () => {
    withTmpDir((dir) => {
      const cookiesPath = path.join(dir, 'cookies.txt');
      const configPath = path.join(dir, 'config');
      fs.writeFileSync(cookiesPath, '');

      const result = writeYtDlpConfig({ cookiesPath, configPath });

      assert.equal(result.cookiesExist, false);
      assert.doesNotMatch(fs.readFileSync(configPath, 'utf8'), /--cookies/);
    });
  });

  test('treats a directory at cookiesPath as not present (Docker bind-mount stub)', () => {
    withTmpDir((dir) => {
      const cookiesPath = path.join(dir, 'cookies.txt');
      fs.mkdirSync(cookiesPath);
      const configPath = path.join(dir, 'config');

      const result = writeYtDlpConfig({ cookiesPath, configPath });

      assert.equal(result.cookiesExist, false);
      assert.doesNotMatch(fs.readFileSync(configPath, 'utf8'), /--cookies/);
    });
  });
});

describe('default paths', () => {
  test('DEFAULT_COOKIES_PATH lives inside DEFAULT_DATA_DIR, not at a would-be mount point', () => {
    // Regression: cookies.txt must never be the literal path Docker mounts,
    // since a mount point can't be replaced by a plain file from inside the
    // container (EBUSY) — see the comment in docker-compose.yml.
    assert.equal(path.dirname(DEFAULT_COOKIES_PATH), DEFAULT_DATA_DIR);
    assert.equal(path.basename(DEFAULT_COOKIES_PATH), 'cookies.txt');
    assert.equal(path.basename(DEFAULT_DATA_DIR), 'data');
  });
});
