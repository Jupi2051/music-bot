'use strict';

// Tests del healthcheck: cubre los modos de fallo y la decisión de auto-recuperación
// (matar el PID 1 ante hang). La lógica es pura (evaluateHealth), testeable sin /proc.

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { evaluateHealth, MAX_AGE_MS, MIN_UP_TIME_MS } = require('../healthcheck');

const NOW = 1_000_000_000_000;

test('pasa cuando el heartbeat es fresco', () => {
  const result = evaluateHealth({
    stateExists: true,
    lastUpdate: NOW - 20_000,
    now: NOW,
    processStartMs: 120_000,
  });
  assert.equal(result.ok, true);
  assert.equal(result.kill, false);
});

test('no mata si el heartbeat falta pero el proceso está en arranque', () => {
  const result = evaluateHealth({
    stateExists: false,
    lastUpdate: null,
    now: NOW,
    processStartMs: 10_000,
  });
  assert.equal(result.ok, false);
  assert.equal(result.kill, false);
});

test('mata si el heartbeat nunca se escribió y el proceso lleva mucho tiempo', () => {
  const result = evaluateHealth({
    stateExists: false,
    lastUpdate: null,
    now: NOW,
    processStartMs: MIN_UP_TIME_MS + 30_000,
  });
  assert.equal(result.ok, false);
  assert.equal(result.kill, true);
});

test('no mata si el heartbeat venció pero el proceso es joven (arranque con archivo viejo)', () => {
  const result = evaluateHealth({
    stateExists: true,
    lastUpdate: NOW - MAX_AGE_MS - 5_000,
    now: NOW,
    processStartMs: 5_000,
  });
  assert.equal(result.ok, false);
  assert.equal(result.kill, false);
});

test('mata si el heartbeat venció y el proceso lleva mucho tiempo (hang real)', () => {
  const result = evaluateHealth({
    stateExists: true,
    lastUpdate: NOW - MAX_AGE_MS - 5_000,
    now: NOW,
    processStartMs: MIN_UP_TIME_MS + 30_000,
  });
  assert.equal(result.ok, false);
  assert.equal(result.kill, true);
});

test('procesoStartMs desconocido: no mata, solo falla', () => {
  const result = evaluateHealth({
    stateExists: true,
    lastUpdate: NOW - MAX_AGE_MS - 5_000,
    now: NOW,
    processStartMs: null,
  });
  assert.equal(result.ok, false);
  assert.equal(result.kill, false);
});
