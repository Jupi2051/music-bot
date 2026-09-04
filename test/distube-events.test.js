'use strict';

// Tests for config/distube.js. Intercepts require('distube') and its plugins
// with fake classes that capture the `.on(event, cb)` listeners in a Map;
// the handlers are then invoked with simulated payloads.
//
// NOT TESTABLE: real DisTube behavior (streams, voice connections) and the
// YouTube/Spotify/SoundCloud plugins: would require the real instance. Only
// message transformations and the factory's guards are verified here.

const { test, describe, mock, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const Module = require('module');
const realLoad = Module._load;

const listeners = new Map();
let distubeOptions = null;
let distubeInstance = null;

class FakeDisTube {
  constructor(client, options) {
    distubeOptions = options;
    distubeInstance = this;
  }

  on(event, cb) {
    listeners.set(event, cb);
    return this;
  }
}

class FakePlugin {}

mock.method(Module, '_load', function (request, parent, isMain) {
  if (request === 'distube') return { DisTube: FakeDisTube };
  if (request === '@distube/yt-dlp' || request === '@distube/spotify' || request === '@distube/soundcloud') {
    return { YtDlpPlugin: FakePlugin, SpotifyPlugin: FakePlugin, SoundCloudPlugin: FakePlugin };
  }
  return realLoad.call(this, request, parent, isMain);
});

const setupDistube = require('../config/distube');

function makeChannel() {
  const state = { sent: [], catchAttached: false };
  return {
    channel: {
      send(message) {
        state.sent.push(message);
        // The factory attaches .catch to the return value of send(): recorded here
        return {
          catch() {
            state.catchAttached = true;
          },
        };
      },
    },
    state,
  };
}

describe('config/distube', () => {
  let client;

  beforeEach(() => {
    listeners.clear();
    distubeOptions = null;
    distubeInstance = null;
    client = {};
    setupDistube(client);
  });

  test('registers the instance on client.distube with the base configuration', () => {
    assert.equal(client.distube, distubeInstance);
    assert.equal(distubeOptions.emitNewSongOnly, true);
    assert.equal(distubeOptions.plugins.length, 3);
  });

  test('playSong: sends a now-playing embed with title, URL and duration to the text channel', () => {
    const { channel, state } = makeChannel();
    listeners.get('playSong')(
      { textChannel: channel, volume: 75 },
      { name: 'Bohemian Rhapsody', url: 'https://youtube.com/watch?v=x', formattedDuration: '5:55', thumbnail: 'https://img/x.jpg' }
    );
    const payload = state.sent[0];
    assert.ok(Array.isArray(payload.embeds) && payload.embeds.length === 1);
    const json = payload.embeds[0].toJSON();
    assert.equal(json.title, 'Bohemian Rhapsody');
    assert.equal(json.url, 'https://youtube.com/watch?v=x');
    assert.equal(json.thumbnail.url, 'https://img/x.jpg');
    assert.ok(json.fields.some(f => f.name === 'Duration' && f.value === '5:55'));
    assert.ok(json.fields.some(f => f.name === 'Volume' && f.value === '75%'));
    assert.equal(state.catchAttached, true, 'send() should have .catch attached');
  });

  test('addSong: sends an added-to-queue embed with title, URL, duration and position', () => {
    const { channel, state } = makeChannel();
    const addedSong = { name: 'Song X', url: 'https://youtube.com/watch?v=x', formattedDuration: '2:40', thumbnail: 'https://img/x.jpg', source: 'spotify' };
    listeners.get('addSong')(
      { textChannel: channel, songs: [{ name: 'A' }, addedSong] },
      addedSong
    );
    const payload = state.sent[0];
    assert.ok(Array.isArray(payload.embeds) && payload.embeds.length === 1);
    const json = payload.embeds[0].toJSON();
    assert.equal(json.author.name, '➕ Added to queue');
    assert.equal(json.title, 'Song X');
    assert.equal(json.url, 'https://youtube.com/watch?v=x');
    assert.equal(json.author.icon_url, 'https://img/x.jpg');
    assert.ok(json.fields.some(f => f.name === 'Duration' && f.value === '2:40'));
    assert.ok(json.fields.some(f => f.name === 'Source' && f.value === 'Spotify'));
    assert.ok(json.fields.some(f => f.name === 'Position in queue' && f.value === '2'));
  });

  test('addSong with a full queue: trims the queue and warns', () => {
    const { channel, state } = makeChannel();
    const queue = {
      textChannel: channel,
      songs: Array.from({ length: 101 }, () => ({ name: 'X' })),
    };
    listeners.get('addSong')(queue, { name: 'Song Y' });
    assert.equal(queue.songs.length, 100, 'should trim to MAX_QUEUE_SIZE');
    assert.equal(
      state.sent[0],
      '⚠️ Queue full (max 100 songs). Not added: **Song Y**'
    );
  });

  test('addList: announces the playlist with the number of songs', () => {
    const { channel, state } = makeChannel();
    listeners.get('addList')(
      { textChannel: channel, songs: [{ name: 'A' }] },
      { name: 'Top Hits', songs: [{}, {}, {}, {}, {}] }
    );
    assert.equal(state.sent[0], '📃 Playlist added: **Top Hits** with 5 songs.');
  });

  test('addList with a full queue: trims and warns how many songs were trimmed', () => {
    const { channel, state } = makeChannel();
    const queue = {
      textChannel: channel,
      songs: Array.from({ length: 105 }, () => ({ name: 'X' })),
    };
    listeners.get('addList')(queue, { name: 'Mega Mix', songs: [] });
    assert.equal(queue.songs.length, 100);
    assert.ok(state.sent[0].includes('trimmed 5 songs'));
    assert.ok(state.sent[0].includes('max 100'));
  });

  test('error: sends the generic error message to the text channel', (t) => {
    mock.method(console, 'error', () => {});
    t.after(() => mock.restoreAll());
    const { channel, state } = makeChannel();
    listeners.get('error')(new Error('boom'), { textChannel: channel });
    assert.equal(state.sent[0], '❌ Error playing music.');
    assert.equal(state.catchAttached, true);
  });

  test('error: sends the bot-check-specific message for a YouTube sign-in wall', (t) => {
    mock.method(console, 'error', () => {});
    t.after(() => mock.restoreAll());
    const { channel, state } = makeChannel();
    listeners.get('error')(new Error("Sign in to confirm you're not a bot."), { textChannel: channel });
    assert.match(state.sent[0], /bot-check/);
    assert.match(state.sent[0], /cookies\.txt/);
  });

  test('error without textChannel: does not crash or send anything', (t) => {
    mock.method(console, 'error', () => {});
    t.after(() => mock.restoreAll());
    const { channel, state } = makeChannel();
    assert.doesNotThrow(() => listeners.get('error')(new Error('boom'), {}));
    assert.equal(state.sent.length, 0);
  });

  test('ffmpegDebug: logs lines that look like real ffmpeg errors', (t) => {
    const errorLog = mock.method(console, 'error', () => {});
    t.after(() => mock.restoreAll());
    listeners.get('ffmpegDebug')('[https @ 0x123] HTTP error 403 Forbidden');
    assert.equal(errorLog.mock.calls.length, 1);
    assert.equal(errorLog.mock.calls[0].arguments[0], '[ffmpeg]');
    assert.match(errorLog.mock.calls[0].arguments[1], /403 Forbidden/);
  });

  test('ffmpegDebug: does not log routine info-level lines', (t) => {
    const errorLog = mock.method(console, 'error', () => {});
    t.after(() => mock.restoreAll());
    listeners.get('ffmpegDebug')('Stream #0:0: Audio: aac, 48000 Hz, stereo');
    assert.equal(errorLog.mock.calls.length, 0);
  });

  test('finish: announces that playback finished', () => {
    const { channel, state } = makeChannel();
    listeners.get('finish')({ textChannel: channel });
    assert.equal(state.sent[0], '✅ Playback finished.');
  });

  test('empty: announces that the channel is now empty', () => {
    const { channel, state } = makeChannel();
    listeners.get('empty')({ textChannel: channel });
    assert.equal(state.sent[0], '📭 Voice channel empty, leaving...');
  });

  test('disconnect: announces it disconnected from the channel', () => {
    const { channel, state } = makeChannel();
    listeners.get('disconnect')({ textChannel: channel });
    assert.equal(state.sent[0], '👋 Disconnected from the channel.');
  });
});
