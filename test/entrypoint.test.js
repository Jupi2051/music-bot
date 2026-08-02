'use strict';

// Unit del entrypoint: verifica que la config de yt-dlp que genera el
// contenedor contiene las líneas críticas de producción (sin ejecutar el
// script, solo su contenido). Previene regresiones del fix de radios RD
// (--playlist-end) y del bot-check (player_client=android).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ENTRYPOINT = path.join(__dirname, '..', 'entrypoint.sh');
const source = fs.readFileSync(ENTRYPOINT, 'utf8');

test('entrypoint.sh genera config de yt-dlp con --js-runtimes node', () => {
  assert.match(source, /--js-runtimes node/);
});

test('entrypoint.sh usa player_client=android para evadir el bot-check', () => {
  assert.match(source, /--extractor-args youtube:player_client=android/);
});

test('entrypoint.sh limita playlists a 25 canciones (fix radios RD)', () => {
  assert.match(source, /--playlist-end 25/);
});

test('entrypoint.sh activa cookies solo si existe el archivo', () => {
  assert.match(source, /-s \/app\/cookies\.txt/);
  assert.match(source, /--cookies \/app\/cookies\.txt/);
});
