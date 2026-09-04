'use strict';

// Tests for update-commands.js. Strategy:
// - The module uses path.join(__dirname, ...) pointing at the real repo root,
//   so fs.existsSync/readFileSync/writeFileSync are stubbed to redirect the
//   state file to an in-memory Map (the real commands-state.json is never touched).
// - require('discord.js') is intercepted with a Proxy that only replaces REST
//   (to capture the PUT) and passes everything else (SlashCommandBuilder,
//   Routes) through to the commands.
//
// NOT TESTABLE: the require.main === module branch (manual deploy via
// `node update-commands.js`) and a real PUT to the Discord API: would require
// real network or a process spawn, out of scope for this file.

process.env.TOKEN = 'test-token';
process.env.CLIENT_ID = '123456789';

const { test, describe, mock, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');

const fs = require('fs');
const path = require('path');
const Module = require('module');

const realLoad = Module._load;
const realReadFileSync = fs.readFileSync;
const realExistsSync = fs.existsSync;
const realWriteFileSync = fs.writeFileSync;

const statePath = path.join(__dirname, '..', 'commands-state.json');
const stateStore = new Map();
const eventLog = [];

const rest = { instances: [], fail: false };

class FakeREST {
  constructor(options) {
    this.options = options;
    this.calls = [];
    rest.instances.push(this);
  }

  setToken(token) {
    this.token = token;
    return this;
  }

  async put(url, options) {
    eventLog.push('put');
    this.calls.push({ url, body: options.body });
    if (rest.fail) throw new Error('deploy failed (simulated)');
    return {};
  }
}

mock.method(Module, '_load', function (request, parent, isMain) {
  if (request === 'discord.js') {
    const realDiscord = realLoad.call(this, request, parent, isMain);
    return new Proxy(realDiscord, {
      get(target, prop) {
        if (prop === 'REST') return FakeREST;
        return target[prop];
      },
    });
  }
  return realLoad.call(this, request, parent, isMain);
});

mock.method(fs, 'existsSync', (p) => {
  if (String(p).endsWith('commands-state.json')) return stateStore.has(p);
  return realExistsSync.call(fs, p);
});
mock.method(fs, 'readFileSync', (p, ...args) => {
  if (String(p).endsWith('commands-state.json')) return stateStore.get(p);
  return realReadFileSync.call(fs, p, ...args);
});
mock.method(fs, 'writeFileSync', (p, content, ...args) => {
  if (String(p).endsWith('commands-state.json')) {
    eventLog.push('write');
    stateStore.set(p, String(content));
    return;
  }
  return realWriteFileSync.call(fs, p, content, ...args);
});

mock.method(console, 'log', () => {});
mock.method(console, 'error', () => {});
mock.method(console, 'warn', () => {});

const checkAndUpdateCommands = require('../update-commands');

let firstHash = null;

beforeEach(() => {
  stateStore.clear();
  eventLog.length = 0;
  rest.instances.length = 0;
  rest.fail = false;
});

describe('checkAndUpdateCommands', () => {
  test('first run without a state file: does a PUT and only then saves state', async () => {
    const result = await checkAndUpdateCommands();

    assert.equal(result, true);
    assert.equal(rest.instances.length, 1);
    const putCall = rest.instances[0].calls[0];
    assert.ok(putCall, 'should have called REST.put');
    assert.match(putCall.url, /\/applications\/123456789\/commands$/);
    assert.equal(putCall.body.length, 11);

    // Critical order: deploy first, save state after
    assert.deepEqual(eventLog, ['put', 'write']);

    const written = JSON.parse(stateStore.get(statePath));
    assert.equal(written.count, 11);
    assert.ok(written.hash.length > 0);
    assert.ok(written.timestamp);
    firstHash = written.hash;
  });

  test('second run without changes: does NOT do a PUT, only updates the timestamp', async () => {
    assert.ok(firstHash, 'the hash captured from the first run');
    stateStore.set(
      statePath,
      JSON.stringify({ hash: firstHash, timestamp: 'previous', count: 9 })
    );

    const result = await checkAndUpdateCommands();

    assert.equal(result, false);
    assert.equal(rest.instances.length, 0, 'should not deploy');
    assert.deepEqual(eventLog, ['write']);
  });

  test('a failing deploy: does not save the new hash, keeps the old one', async () => {
    stateStore.set(
      statePath,
      JSON.stringify({ hash: 'old-hash-000', timestamp: 'previous', count: 9 })
    );
    rest.fail = true;

    const result = await checkAndUpdateCommands();

    assert.equal(result, false);
    assert.equal(rest.instances[0].calls.length, 1, 'should attempt the deploy');
    assert.ok(!eventLog.includes('write'), 'should not save state after a failed deploy');
    assert.equal(JSON.parse(stateStore.get(statePath)).hash, 'old-hash-000');
  });

  test('first run with a failing deploy: the state file is not created', async () => {
    rest.fail = true;

    const result = await checkAndUpdateCommands();

    assert.equal(result, false);
    assert.equal(stateStore.size, 0, 'the state file should not exist');
  });

  test('after a failed deploy, the next run retries and saves state', async () => {
    stateStore.set(
      statePath,
      JSON.stringify({ hash: 'old-hash-000', timestamp: 'previous', count: 9 })
    );
    rest.fail = true;
    assert.equal(await checkAndUpdateCommands(), false);

    rest.fail = false;
    assert.equal(await checkAndUpdateCommands(), true);
    assert.equal(JSON.parse(stateStore.get(statePath)).hash, firstHash);
  });
});

after(() => {
  mock.restoreAll();
});
