#!/usr/bin/env node
'use strict';

// Descarga el binario de yt-dlp que usa @distube/yt-dlp y VERIFICA que quedó
// completo antes de terminar.
//
// ¿Por qué existe? download() del plugin resuelve su promesa antes de que el
// writeFile interno termine (bug upstream 2.0.1, parcheado en patches/). Un
// `process.exit()` inmediato — como hacía el Dockerfile — mataba el proceso a
// mitad de escritura y dejaba un binario de 0 bytes: el bot arrancaba normal,
// las búsquedas por texto funcionaban (van por SoundCloud) pero los ENLACES
// fallaban siempre. Este script espera la escritura y valida el tamaño.
//
// Uso: `npm run setup:ytdlp` (local) o `RUN node scripts/download-ytdlp.js`
// en el Dockerfile (falla el build si la descarga es incompleta).

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
    // ENOENT: evaluateYtDlpBinary lo reporta como faltante
  }
  const verdict = evaluateYtDlpBinary({ exists: size !== null, size });
  if (!verdict.ok) {
    console.error(verdict.reason);
    process.exit(1);
  }
  console.log(`✅ yt-dlp ${version} listo (${(size / (1024 * 1024)).toFixed(1)}MB) en ${binPath}`);
}

main().catch((err) => {
  console.error('❌ No se pudo descargar el binario de yt-dlp:', err.message);
  process.exit(1);
});
