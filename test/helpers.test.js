'use strict';

const { test, describe, mock, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const { assertControl, checkCooldown, cleanQuery, evaluateYtDlpBinary, getQueryError, isPlaylistUrl, YT_DLP_MIN_BYTES, ytDlpBinaryPath } = require('../utils/helpers');

function makeInteraction({ channelId = 'vc-1' } = {}) {
  return {
    member: {
      voice: {
        channel: channelId ? { id: channelId } : null,
      },
    },
  };
}

describe('assertControl', () => {
  test('devuelve error si el usuario no está en un canal de voz', () => {
    const interaction = makeInteraction({ channelId: null });
    assert.equal(
      assertControl(interaction, 'vc-bot'),
      '❌ Debes estar en un canal de voz.'
    );
  });

  test('devuelve error si el usuario está en un canal distinto al del bot', () => {
    const interaction = makeInteraction({ channelId: 'vc-user' });
    assert.equal(
      assertControl(interaction, 'vc-bot'),
      '❌ Debes estar en el mismo canal de voz que el bot.'
    );
  });

  test('devuelve null si el usuario está en el mismo canal que el bot', () => {
    const interaction = makeInteraction({ channelId: 'vc-bot' });
    assert.equal(assertControl(interaction, 'vc-bot'), null);
  });

  test('devuelve null si no hay botChannelId aunque el usuario esté en voz', () => {
    const interaction = makeInteraction({ channelId: 'vc-user' });
    assert.equal(assertControl(interaction, undefined), null);
  });
});

describe('checkCooldown', () => {
  // El Map de cooldowns es compartido a nivel de módulo: cada test usa una
  // key distinta para no interferir. Se stubbea Date.now para no dormir.
  let now = 0;

  beforeEach(() => {
    now = 1000;
    mock.method(Date, 'now', () => now);
  });

  afterEach(() => {
    mock.restoreAll();
  });

  test('la primera llamada permite la acción (devuelve false)', () => {
    assert.equal(checkCooldown('helpers-key-a', 500), false);
  });

  test('la segunda llamada inmediata bloquea (devuelve true)', () => {
    checkCooldown('helpers-key-b', 500);
    assert.equal(checkCooldown('helpers-key-b', 500), true);
  });

  test('después de esperar el ms permitido vuelve a permitir', () => {
    checkCooldown('helpers-key-c', 500);
    now = 1501;
    assert.equal(checkCooldown('helpers-key-c', 500), false);
  });
});

describe('cleanQuery', () => {
  test('devuelve texto plano sin cambios', () => {
    assert.equal(cleanQuery('mi canción'), 'mi canción');
  });

  test('extrae la URL del mensaje pegado del bot', () => {
    const pasted = '🔍 Buscando: `https://www.youtube.com/watch?v=eBqthnZnu3Y`';
    assert.equal(cleanQuery(pasted), 'https://www.youtube.com/watch?v=eBqthnZnu3Y');
  });

  test('recorta puntuación de cierre pegada a la URL', () => {
    assert.equal(
      cleanQuery('mirá https://www.youtube.com/watch?v=eBqthnZnu3Y).'),
      'https://www.youtube.com/watch?v=eBqthnZnu3Y',
    );
  });

  test('quita backticks envolventes de un query sin URL', () => {
    assert.equal(cleanQuery('`mi canción`'), 'mi canción');
  });

  test('devuelve vacío para entradas no string', () => {
    assert.equal(cleanQuery(null), '');
    assert.equal(cleanQuery(undefined), '');
  });
});

describe('isPlaylistUrl', () => {
  test('detecta playlist de YouTube', () => {
    assert.equal(isPlaylistUrl('https://www.youtube.com/playlist?list=PLabc123'), true);
    assert.equal(isPlaylistUrl('https://www.youtube.com/watch?v=x&list=RDabc123'), true);
    assert.equal(isPlaylistUrl('https://youtu.be/x?list=PLabc123'), true);
  });

  test('detecta playlist y álbum de Spotify', () => {
    assert.equal(isPlaylistUrl('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M'), true);
    assert.equal(isPlaylistUrl('https://open.spotify.com/album/6k3L0Pk8yRfDbq6Jw9dG2m'), true);
  });

  test('detecta sets de SoundCloud', () => {
    assert.equal(isPlaylistUrl('https://soundcloud.com/dj-foo/sets/mix-2026'), true);
  });

  test('no detecta videos sueltos ni queries de texto', () => {
    assert.equal(isPlaylistUrl('https://www.youtube.com/watch?v=eBqthnZnu3Y'), false);
    assert.equal(isPlaylistUrl('mi canción favorita'), false);
    assert.equal(isPlaylistUrl(null), false);
  });
});

describe('getQueryError', () => {
  test('bloquea queries que empiezan con guion (inyección de flags de yt-dlp)', () => {
    assert.equal(getQueryError('-x'), '❌ Ese término de búsqueda no es válido.');
    assert.equal(getQueryError('--update-to=attacker/repo@tag'), '❌ Ese término de búsqueda no es válido.');
  });

  test('bloquea protocolos no-http(s) (LFI vía file://)', () => {
    assert.equal(getQueryError('file:///etc/passwd'), '❌ Solo se admiten enlaces http(s).');
    assert.equal(getQueryError('ftp://x.com/y'), '❌ Solo se admiten enlaces http(s).');
  });

  test('permite URLs http(s) normales', () => {
    assert.equal(getQueryError('https://youtube.com/watch?v=abc'), null);
  });

  test('no bloquea texto normal con guiones adentro', () => {
    assert.equal(getQueryError('Duki - She Don\'t Give a Fo'), null);
  });

  test('bloquea queries vacías o no string', () => {
    assert.equal(getQueryError(''), '❌ Ingresá un nombre o URL.');
    assert.equal(getQueryError('   '), '❌ Ingresá un nombre o URL.');
    assert.equal(getQueryError(null), '❌ Ingresá un nombre o URL.');
  });
});

describe('evaluateYtDlpBinary', () => {
  test('rechaza cuando el binario no existe', () => {
    const verdict = evaluateYtDlpBinary({ exists: false, size: undefined });
    assert.equal(verdict.ok, false);
    assert.match(verdict.reason, /Falta el binario de yt-dlp/);
    assert.match(verdict.reason, /setup:ytdlp/, 'debe sugerir el comando de reparación');
  });

  test('rechaza un binario vacío o truncado (descarga interrumpida)', () => {
    for (const size of [0, 1, 1024]) {
      const verdict = evaluateYtDlpBinary({ exists: true, size });
      assert.equal(verdict.ok, false);
      assert.match(verdict.reason, /vacío o truncado/);
      assert.ok(verdict.reason.includes(String(size)), 'el motivo debe incluir el tamaño real');
    }
  });

  test('acepta un binario de tamaño razonable', () => {
    assert.deepEqual(evaluateYtDlpBinary({ exists: true, size: YT_DLP_MIN_BYTES }), { ok: true });
    assert.deepEqual(evaluateYtDlpBinary({ exists: true, size: 3_072_464 }), { ok: true });
  });

  test('rechaza tamaños no numéricos aunque exista', () => {
    const verdict = evaluateYtDlpBinary({ exists: true, size: undefined });
    assert.equal(verdict.ok, false);
  });
});

describe('ytDlpBinaryPath', () => {
  test('apunta al bin dentro del paquete por defecto', () => {
    const p = ytDlpBinaryPath();
    assert.ok(p.includes('@distube/yt-dlp'), 'la ruta debe vivir dentro del paquete');
    assert.ok(p.endsWith(`yt-dlp${process.platform === 'win32' ? '.exe' : ''}`));
  });

  test('honra los overrides YTDLP_DIR y YTDLP_FILENAME como el plugin', () => {
    const prevDir = process.env.YTDLP_DIR;
    const prevFile = process.env.YTDLP_FILENAME;
    process.env.YTDLP_DIR = '/opt/ytdlp';
    process.env.YTDLP_FILENAME = 'mi-yt-dlp';
    try {
      const p = ytDlpBinaryPath();
      assert.equal(p, require('node:path').join('/opt/ytdlp', 'mi-yt-dlp'));
    } finally {
      if (prevDir === undefined) delete process.env.YTDLP_DIR;
      else process.env.YTDLP_DIR = prevDir;
      if (prevFile === undefined) delete process.env.YTDLP_FILENAME;
      else process.env.YTDLP_FILENAME = prevFile;
    }
  });
});
