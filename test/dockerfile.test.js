'use strict';

// Unit test for the Dockerfile: guards the root-then-drop-privileges setup
// (see entrypoint.sh) that fixes /app/data's ownership on every boot,
// regardless of what a mounted volume/bind-mount driver left it as.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const DOCKERFILE = path.join(__dirname, '..', 'Dockerfile');
const source = fs.readFileSync(DOCKERFILE, 'utf8');

test('Dockerfile installs gosu (used by entrypoint.sh to drop root)', () => {
  assert.match(source, /apt-get install[\s\S]*?\bgosu\b/);
});

test('Dockerfile does not switch to a non-root USER before ENTRYPOINT (entrypoint.sh needs to start as root)', () => {
  const entrypointIndex = source.indexOf('ENTRYPOINT');
  assert.ok(entrypointIndex > -1, 'Dockerfile should have an ENTRYPOINT instruction');
  const beforeEntrypoint = source.slice(0, entrypointIndex);
  assert.doesNotMatch(beforeEntrypoint, /^\s*USER\s+nodejs\s*$/m);
});

test('Dockerfile still creates the non-root nodejs user (for gosu to drop into)', () => {
  assert.match(source, /useradd[\s\S]*?nodejs/);
});

test('Dockerfile runs /app/entrypoint.sh as the entrypoint', () => {
  assert.match(source, /ENTRYPOINT \["\/app\/entrypoint\.sh"\]/);
});

test('Dockerfile still declares a healthcheck', () => {
  assert.match(source, /HEALTHCHECK/);
});
