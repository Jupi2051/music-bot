#!/usr/bin/env node
'use strict';

// Writes yt-dlp's user config file (js-runtime, player-client fallback chain,
// playlist limit, and --cookies if cookies.txt exists). Run once by
// entrypoint.sh at container boot, and re-run by web/cookieServer.js whenever
// a new cookies.txt is submitted through the web form — so a submitted cookie
// file takes effect on the very next yt-dlp invocation, no restart needed.
//
// Usage: `node scripts/write-ytdlp-config.js` (entrypoint.sh) or
// `require('./scripts/write-ytdlp-config').writeYtDlpConfig()` (cookie server).

const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildYtDlpConfig } = require('../utils/helpers');

const DEFAULT_COOKIES_PATH = path.join(__dirname, '..', 'cookies.txt');
const DEFAULT_CONFIG_PATH = path.join(os.homedir(), '.config', 'yt-dlp', 'config');

function writeYtDlpConfig({ cookiesPath = DEFAULT_COOKIES_PATH, configPath = DEFAULT_CONFIG_PATH } = {}) {
  let cookiesExist = false;
  try {
    const stat = fs.statSync(cookiesPath);
    cookiesExist = stat.isFile() && stat.size > 0;
  } catch {
    // ENOENT (or a directory — see cleanCookiesPathStub in web/cookieServer.js): no cookies yet
  }

  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, buildYtDlpConfig({ cookiesExist, cookiesPath }));

  return { cookiesExist, cookiesPath, configPath };
}

if (require.main === module) {
  const result = writeYtDlpConfig();
  console.log(result.cookiesExist ? '🍪 YouTube cookies detected' : '⚠️  No cookies.txt: YouTube may block with a bot-check');
} else {
  module.exports = { writeYtDlpConfig, DEFAULT_COOKIES_PATH, DEFAULT_CONFIG_PATH };
}
