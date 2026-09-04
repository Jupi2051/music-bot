#!/usr/bin/env node
'use strict';

// Downloads the yt-dlp binary used by @distube/yt-dlp and VERIFIES it's
// complete before finishing.
//
// Why does this exist? The plugin's download() resolves its promise before
// the internal writeFile finishes (upstream bug in 2.0.1, patched in
// patches/). An immediate `process.exit()` — like the Dockerfile used to do —
// killed the process mid-write and left a 0-byte binary: the bot started
// normally but every yt-dlp invocation failed (at the time, that only broke
// links — text search fell back to SoundCloud; now search defaults to
// YouTube too, via commands/play.js, so a broken binary breaks both). This
// script waits for the write and validates the size.
//
// Usage: `npm run setup:ytdlp` (local) or `RUN node scripts/download-ytdlp.js`
// in the Dockerfile (fails the build if the download is incomplete).

const { statSync } = require('fs');
const { download } = require('@distube/yt-dlp');
const { evaluateYtDlpBinary, ytDlpBinaryPath } = require('../utils/helpers');

async function main() {
  const version = await download();
  const binPath = ytDlpBinaryPath();
  let size = null;
  try {
    size = statSync(binPath).size;
  } catch {
    // ENOENT: evaluateYtDlpBinary reports it as missing
  }
  const verdict = evaluateYtDlpBinary({ exists: size !== null, size });
  if (!verdict.ok) {
    console.error(verdict.reason);
    process.exit(1);
  }
  console.log(`✅ yt-dlp ${version} ready (${(size / (1024 * 1024)).toFixed(1)}MB) at ${binPath}`);
}

main().catch((err) => {
  console.error('❌ Could not download the yt-dlp binary:', err.message);
  process.exit(1);
});
