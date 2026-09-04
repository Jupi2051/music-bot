'use strict';

// Tests for the healthcheck: covers the failure modes and the auto-recovery
// decision (killing PID 1 on a hang). The logic is pure (evaluateHealth), testable without /proc.

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { evaluateHealth, MAX_AGE_MS, MIN_UP_TIME_MS } = require('../healthcheck');

const NOW = 1_000_000_000_000;

test('passes when the heartbeat is fresh', () => {
  const result = evaluateHealth({
    stateExists: true,
    lastUpdate: NOW - 20_000,
    now: NOW,
    processStartMs: 120_000,
  });
  assert.equal(result.ok, true);
  assert.equal(result.kill, false);
});

test('does not kill if the heartbeat is missing but the process is starting up', () => {
  const result = evaluateHealth({
    stateExists: false,
    lastUpdate: null,
    now: NOW,
    processStartMs: 10_000,
  });
  assert.equal(result.ok, false);
  assert.equal(result.kill, false);
});

test('kills if the heartbeat was never written and the process has been up for a while', () => {
  const result = evaluateHealth({
    stateExists: false,
    lastUpdate: null,
    now: NOW,
    processStartMs: MIN_UP_TIME_MS + 30_000,
  });
  assert.equal(result.ok, false);
  assert.equal(result.kill, true);
});

test('does not kill if the heartbeat expired but the process is young (startup with a stale file)', () => {
  const result = evaluateHealth({
    stateExists: true,
    lastUpdate: NOW - MAX_AGE_MS - 5_000,
    now: NOW,
    processStartMs: 5_000,
  });
  assert.equal(result.ok, false);
  assert.equal(result.kill, false);
});

test('kills if the heartbeat expired and the process has been up for a while (real hang)', () => {
  const result = evaluateHealth({
    stateExists: true,
    lastUpdate: NOW - MAX_AGE_MS - 5_000,
    now: NOW,
    processStartMs: MIN_UP_TIME_MS + 30_000,
  });
  assert.equal(result.ok, false);
  assert.equal(result.kill, true);
});

test('unknown processStartMs: does not kill, only fails', () => {
  const result = evaluateHealth({
    stateExists: true,
    lastUpdate: NOW - MAX_AGE_MS - 5_000,
    now: NOW,
    processStartMs: null,
  });
  assert.equal(result.ok, false);
  assert.equal(result.kill, false);
});
