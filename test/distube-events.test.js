'use strict';

// Tests de config/distube.js. Se intercepta require('distube') y los plugins
// con clases falsas que capturan los listeners `.on(evento, cb)` en un Map;
// luego se invocan los handlers con payloads simulados.
//
// NOT TESTABLE: el comportamiento real de DisTube (streams, conexiones de voz)
// y los plugins de YouTube/Spotify/SoundCloud: requerirían la instancia real.
// Aquí solo se verifican las transformaciones de mensajes y los guards del
// factory.

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
        // El factory adjunta .catch al retorno de send(): se registra acá
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

  test('registra la instancia en client.distube con la configuración base', () => {
    assert.equal(client.distube, distubeInstance);
    assert.equal(distubeOptions.emitNewSongOnly, true);
    assert.equal(distubeOptions.plugins.length, 3);
  });

  test('playSong: envía el título y duración formateada al canal de texto', () => {
    const { channel, state } = makeChannel();
    listeners.get('playSong')(
      { textChannel: channel },
      { name: 'Bohemian Rhapsody', formattedDuration: '5:55' }
    );
    assert.equal(state.sent[0], '🎵 Reproduciendo: **Bohemian Rhapsody** [`5:55`]');
    assert.equal(state.catchAttached, true, 'send() debe tener .catch adjunto');
  });

  test('addSong: anuncia la canción añadida', () => {
    const { channel, state } = makeChannel();
    listeners.get('addSong')(
      { textChannel: channel, songs: [{ name: 'A' }] },
      { name: 'Song X' }
    );
    assert.equal(state.sent[0], '➕ Añadido: **Song X**');
  });

  test('addSong con cola llena: recorta la cola y avisa', () => {
    const { channel, state } = makeChannel();
    const queue = {
      textChannel: channel,
      songs: Array.from({ length: 101 }, () => ({ name: 'X' })),
    };
    listeners.get('addSong')(queue, { name: 'Song Y' });
    assert.equal(queue.songs.length, 100, 'debería recortar a MAX_QUEUE_SIZE');
    assert.equal(
      state.sent[0],
      '⚠️ Cola llena (máximo 100 canciones). No se agregó: **Song Y**'
    );
  });

  test('addList: anuncia la playlist con la cantidad de canciones', () => {
    const { channel, state } = makeChannel();
    listeners.get('addList')(
      { textChannel: channel, songs: [{ name: 'A' }] },
      { name: 'Top Hits', songs: [{}, {}, {}, {}, {}] }
    );
    assert.equal(state.sent[0], '📃 Lista añadida: **Top Hits** con 5 canciones.');
  });

  test('addList con cola llena: recorta y avisa cuántas canciones se recortaron', () => {
    const { channel, state } = makeChannel();
    const queue = {
      textChannel: channel,
      songs: Array.from({ length: 105 }, () => ({ name: 'X' })),
    };
    listeners.get('addList')(queue, { name: 'Mega Mix', songs: [] });
    assert.equal(queue.songs.length, 100);
    assert.ok(state.sent[0].includes('se recortaron 5 canciones'));
    assert.ok(state.sent[0].includes('máximo 100'));
  });

  test('error: envía el mensaje de error al canal de texto', (t) => {
    mock.method(console, 'error', () => {});
    t.after(() => mock.restoreAll());
    const { channel, state } = makeChannel();
    listeners.get('error')(new Error('boom'), { textChannel: channel });
    assert.equal(state.sent[0], '❌ Error al reproducir música.');
    assert.equal(state.catchAttached, true);
  });

  test('error sin textChannel: no crashea ni envía nada', (t) => {
    mock.method(console, 'error', () => {});
    t.after(() => mock.restoreAll());
    const { channel, state } = makeChannel();
    assert.doesNotThrow(() => listeners.get('error')(new Error('boom'), {}));
    assert.equal(state.sent.length, 0);
  });

  test('finish: avisa que la reproducción terminó', () => {
    const { channel, state } = makeChannel();
    listeners.get('finish')({ textChannel: channel });
    assert.equal(state.sent[0], '✅ Reproducción terminada.');
  });

  test('empty: avisa que el canal quedó vacío', () => {
    const { channel, state } = makeChannel();
    listeners.get('empty')({ textChannel: channel });
    assert.equal(state.sent[0], '📭 Canal de voz vacío, saliendo...');
  });

  test('disconnect: avisa que se desconectó del canal', () => {
    const { channel, state } = makeChannel();
    listeners.get('disconnect')({ textChannel: channel });
    assert.equal(state.sent[0], '👋 Me desconecté del canal.');
  });
});
