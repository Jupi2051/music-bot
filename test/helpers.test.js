'use strict';

const { test, describe, mock, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const { assertControl, buildYtDlpConfig, checkCooldown, cleanQuery, describePlaybackError, evaluateYtDlpBinary, getQueryError, isPlaylistUrl, YT_DLP_MIN_BYTES, ytDlpBinaryPath } = require('../utils/helpers');

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
  test('returns an error if the user is not in a voice channel', () => {
    const interaction = makeInteraction({ channelId: null });
    assert.equal(
      assertControl(interaction, 'vc-bot'),
      '❌ You must be in a voice channel.'
    );
  });

  test('returns an error if the user is in a different channel than the bot', () => {
    const interaction = makeInteraction({ channelId: 'vc-user' });
    assert.equal(
      assertControl(interaction, 'vc-bot'),
      '❌ You must be in the same voice channel as the bot.'
    );
  });

  test('returns null if the user is in the same channel as the bot', () => {
    const interaction = makeInteraction({ channelId: 'vc-bot' });
    assert.equal(assertControl(interaction, 'vc-bot'), null);
  });

  test('returns null if there is no botChannelId even if the user is in voice', () => {
    const interaction = makeInteraction({ channelId: 'vc-user' });
    assert.equal(assertControl(interaction, undefined), null);
  });
});

describe('checkCooldown', () => {
  // The cooldowns Map is shared at module level: each test uses a distinct
  // key to avoid interfering with the others. Date.now is stubbed to avoid sleeping.
  let now = 0;

  beforeEach(() => {
    now = 1000;
    mock.method(Date, 'now', () => now);
  });

  afterEach(() => {
    mock.restoreAll();
  });

  test('the first call allows the action (returns false)', () => {
    assert.equal(checkCooldown('helpers-key-a', 500), false);
  });

  test('an immediate second call blocks (returns true)', () => {
    checkCooldown('helpers-key-b', 500);
    assert.equal(checkCooldown('helpers-key-b', 500), true);
  });

  test('allows again after waiting the permitted ms', () => {
    checkCooldown('helpers-key-c', 500);
    now = 1501;
    assert.equal(checkCooldown('helpers-key-c', 500), false);
  });
});

describe('cleanQuery', () => {
  test('returns plain text unchanged', () => {
    assert.equal(cleanQuery('my song'), 'my song');
  });

  test('extracts the URL from the bot\'s pasted message', () => {
    const pasted = '🔍 Searching: `https://www.youtube.com/watch?v=eBqthnZnu3Y`';
    assert.equal(cleanQuery(pasted), 'https://www.youtube.com/watch?v=eBqthnZnu3Y');
  });

  test('trims trailing punctuation stuck to the URL', () => {
    assert.equal(
      cleanQuery('check this out https://www.youtube.com/watch?v=eBqthnZnu3Y).'),
      'https://www.youtube.com/watch?v=eBqthnZnu3Y',
    );
  });

  test('removes surrounding backticks from a query without a URL', () => {
    assert.equal(cleanQuery('`my song`'), 'my song');
  });

  test('returns empty for non-string inputs', () => {
    assert.equal(cleanQuery(null), '');
    assert.equal(cleanQuery(undefined), '');
  });
});

describe('isPlaylistUrl', () => {
  test('detects a YouTube playlist', () => {
    assert.equal(isPlaylistUrl('https://www.youtube.com/playlist?list=PLabc123'), true);
    assert.equal(isPlaylistUrl('https://www.youtube.com/watch?v=x&list=RDabc123'), true);
    assert.equal(isPlaylistUrl('https://youtu.be/x?list=PLabc123'), true);
  });

  test('detects a Spotify playlist and album', () => {
    assert.equal(isPlaylistUrl('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M'), true);
    assert.equal(isPlaylistUrl('https://open.spotify.com/album/6k3L0Pk8yRfDbq6Jw9dG2m'), true);
  });

  test('detects SoundCloud sets', () => {
    assert.equal(isPlaylistUrl('https://soundcloud.com/dj-foo/sets/mix-2026'), true);
  });

  test('does not detect standalone videos or text queries', () => {
    assert.equal(isPlaylistUrl('https://www.youtube.com/watch?v=eBqthnZnu3Y'), false);
    assert.equal(isPlaylistUrl('my favorite song'), false);
    assert.equal(isPlaylistUrl(null), false);
  });
});

describe('getQueryError', () => {
  test('blocks queries starting with a dash (yt-dlp flag injection)', () => {
    assert.equal(getQueryError('-x'), '❌ That search term is not valid.');
    assert.equal(getQueryError('--update-to=attacker/repo@tag'), '❌ That search term is not valid.');
  });

  test('blocks non-http(s) protocols (LFI via file://)', () => {
    assert.equal(getQueryError('file:///etc/passwd'), '❌ Only http(s) links are supported.');
    assert.equal(getQueryError('ftp://x.com/y'), '❌ Only http(s) links are supported.');
  });

  test('allows normal http(s) URLs', () => {
    assert.equal(getQueryError('https://youtube.com/watch?v=abc'), null);
  });

  test('does not block normal text containing dashes', () => {
    assert.equal(getQueryError('Duki - She Don\'t Give a Fo'), null);
  });

  test('blocks empty or non-string queries', () => {
    assert.equal(getQueryError(''), '❌ Enter a name or URL.');
    assert.equal(getQueryError('   '), '❌ Enter a name or URL.');
    assert.equal(getQueryError(null), '❌ Enter a name or URL.');
  });
});

describe('buildYtDlpConfig', () => {
  test('always includes the js-runtime, player-client chain and playlist limit', () => {
    const config = buildYtDlpConfig({ cookiesExist: false });
    assert.match(config, /--js-runtimes node/);
    assert.match(config, /--extractor-args youtube:player_client=tv,web_safari,android/);
    assert.match(config, /--playlist-end 15/);
  });

  test('omits --cookies when cookiesExist is false', () => {
    const config = buildYtDlpConfig({ cookiesExist: false, cookiesPath: '/app/cookies.txt' });
    assert.doesNotMatch(config, /--cookies/);
  });

  test('omits --cookies when cookiesExist is true but no path is given', () => {
    const config = buildYtDlpConfig({ cookiesExist: true });
    assert.doesNotMatch(config, /--cookies/);
  });

  test('appends --cookies with the given path when cookiesExist is true', () => {
    const config = buildYtDlpConfig({ cookiesExist: true, cookiesPath: '/app/cookies.txt' });
    assert.match(config, /--cookies \/app\/cookies\.txt$/m);
  });

  test('ends with a trailing newline', () => {
    assert.ok(buildYtDlpConfig({ cookiesExist: false }).endsWith('\n'));
  });
});

describe('describePlaybackError', () => {
  test('recognizes a YouTube bot-check and explains it points at cookies.txt', () => {
    const error = new Error("DisTubeError [YTDLP_ERROR]: ERROR: [youtube] abc123: Sign in to confirm you're not a bot.");
    const message = describePlaybackError(error);
    assert.match(message, /bot-check/);
    assert.match(message, /cookies\.txt/);
  });

  test('is case-insensitive and matches regardless of surrounding text', () => {
    const message = describePlaybackError(new Error('SIGN IN TO CONFIRM your age blah blah'));
    assert.match(message, /bot-check/);
  });

  test('returns the default fallback for an unrelated error', () => {
    assert.equal(describePlaybackError(new Error('voice connection lost')), '❌ Could not play. Try another name or URL.');
  });

  test('returns a caller-supplied fallback for an unrelated error', () => {
    assert.equal(describePlaybackError(new Error('boom'), '❌ Error playing music.'), '❌ Error playing music.');
  });

  test('handles a plain string or an error with no message without throwing', () => {
    assert.equal(describePlaybackError('boom'), '❌ Could not play. Try another name or URL.');
    assert.equal(describePlaybackError(undefined), '❌ Could not play. Try another name or URL.');
  });
});

describe('evaluateYtDlpBinary', () => {
  test('rejects when the binary does not exist', () => {
    const verdict = evaluateYtDlpBinary({ exists: false, size: undefined });
    assert.equal(verdict.ok, false);
    assert.match(verdict.reason, /Missing yt-dlp binary/);
    assert.match(verdict.reason, /setup:ytdlp/, 'should suggest the repair command');
  });

  test('rejects an empty or truncated binary (interrupted download)', () => {
    for (const size of [0, 1, 1024]) {
      const verdict = evaluateYtDlpBinary({ exists: true, size });
      assert.equal(verdict.ok, false);
      assert.match(verdict.reason, /empty or truncated/);
      assert.ok(verdict.reason.includes(String(size)), 'the reason should include the actual size');
    }
  });

  test('accepts a reasonably sized binary', () => {
    assert.deepEqual(evaluateYtDlpBinary({ exists: true, size: YT_DLP_MIN_BYTES }), { ok: true });
    assert.deepEqual(evaluateYtDlpBinary({ exists: true, size: 3_072_464 }), { ok: true });
  });

  test('rejects non-numeric sizes even if it exists', () => {
    const verdict = evaluateYtDlpBinary({ exists: true, size: undefined });
    assert.equal(verdict.ok, false);
  });
});

describe('ytDlpBinaryPath', () => {
  test('points to the bin inside the package by default', () => {
    const p = ytDlpBinaryPath();
    assert.ok(p.includes('@distube/yt-dlp'), 'the path should live inside the package');
    assert.ok(p.endsWith(`yt-dlp${process.platform === 'win32' ? '.exe' : ''}`));
  });

  test('honors the YTDLP_DIR and YTDLP_FILENAME overrides like the plugin', () => {
    const prevDir = process.env.YTDLP_DIR;
    const prevFile = process.env.YTDLP_FILENAME;
    process.env.YTDLP_DIR = '/opt/ytdlp';
    process.env.YTDLP_FILENAME = 'my-yt-dlp';
    try {
      const p = ytDlpBinaryPath();
      assert.equal(p, require('node:path').join('/opt/ytdlp', 'my-yt-dlp'));
    } finally {
      if (prevDir === undefined) delete process.env.YTDLP_DIR;
      else process.env.YTDLP_DIR = prevDir;
      if (prevFile === undefined) delete process.env.YTDLP_FILENAME;
      else process.env.YTDLP_FILENAME = prevFile;
    }
  });
});
