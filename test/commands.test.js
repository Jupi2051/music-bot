'use strict';

// Tests for every command in commands/*.js. interaction and client.distube are
// mocked; commands never touch the network or real DisTube.
//
// NOT TESTABLE: the real construction of SlashCommandBuilder.data (real
// discord.js) is not exercised here: assumed valid since update-commands.js
// validates it on deploy. DisTube's network error handlers aren't either,
// since distube is fully mocked.

const { test, describe, mock } = require('node:test');
const assert = require('node:assert/strict');

const { YtDlpPlugin } = require('@distube/yt-dlp');
const play = require('../commands/play');
const skip = require('../commands/skip');
const stop = require('../commands/stop');
const pause = require('../commands/pause');
const resume = require('../commands/resume');
const volume = require('../commands/volume');
const queueCmd = require('../commands/queue');
const leave = require('../commands/leave');
const help = require('../commands/help');
const set = require('../commands/set');
const nowplaying = require('../commands/nowplaying');

const VC_BOT = 'vc-bot';
const VC_OTHER = 'vc-other';

function makeInteraction(overrides = {}) {
  const interaction = {
    reply: mock.fn(async () => {}),
    editReply: mock.fn(async () => {}),
    deferred: false,
    replied: false,
    guildId: 'guild-1',
    guild: { id: 'guild-1' },
    user: { id: 'user-1' },
    channel: { id: 'chan-1' },
    options: {
      getString: () => 'test query',
      getInteger: () => 50,
    },
    member: { voice: { channel: { id: VC_BOT } } },
  };
  return { ...interaction, ...overrides };
}

function makeQueue(overrides = {}) {
  return {
    playing: true,
    voiceChannel: { id: VC_BOT },
    volume: 50,
    songs: [
      { name: 'Song A', url: 'https://youtube.com/watch?v=a', duration: 125, formattedDuration: '2:05' },
      { name: 'Song B', url: 'https://youtube.com/watch?v=b', duration: 200, formattedDuration: '3:20' },
    ],
    pause: mock.fn(() => {}),
    resume: mock.fn(() => {}),
    skip: mock.fn(async () => {}),
    stop: mock.fn(async () => {}),
    setVolume: mock.fn(() => {}),
    seek: mock.fn(async () => {}),
    ...overrides,
  };
}

function makeClient({ queue = null, connection = null, plugins } = {}) {
  return {
    distube: {
      getQueue: mock.fn(() => queue),
      play: mock.fn(async () => {}),
      voices: { get: mock.fn(() => connection) },
      ...(plugins ? { plugins } : {}),
    },
  };
}

// Object.create(YtDlpPlugin.prototype) satisfies `instanceof YtDlpPlugin`
// without invoking the real constructor (which would try to download the
// yt-dlp binary), so play.js's plugin lookup works against a plain mock.
function makeYtDlpPlugin(resolveImpl) {
  const plugin = Object.create(YtDlpPlugin.prototype);
  plugin.resolve = mock.fn(resolveImpl);
  return plugin;
}

function replyArg(interaction, callIndex = 0) {
  return interaction.reply.mock.calls[callIndex].arguments[0];
}

// Normalizes the reply argument: commands respond with a string or with
// { content, ephemeral }; this extracts the text in both cases.
function replyContent(interaction, callIndex = 0) {
  const arg = replyArg(interaction, callIndex);
  return typeof arg === 'string' ? arg : arg.content;
}

describe('pause', () => {
  test('replies with an error if there is no queue', async () => {
    const interaction = makeInteraction();
    await pause.execute(interaction, makeClient({ queue: null }));
    assert.equal(replyContent(interaction), '❌ No music is playing.');
  });

  test('replies with an error if the queue is already paused (playing=false)', async () => {
    const interaction = makeInteraction();
    const queue = makeQueue({ playing: false });
    await pause.execute(interaction, makeClient({ queue }));
    assert.equal(replyContent(interaction), '❌ No music is playing.');
    assert.equal(queue.pause.mock.calls.length, 0);
  });

  test('replies with a control error if the user is not in the bot channel', async () => {
    const interaction = makeInteraction({ member: { voice: { channel: { id: VC_OTHER } } } });
    const queue = makeQueue();
    await pause.execute(interaction, makeClient({ queue }));
    assert.equal(replyContent(interaction), '❌ You must be in the same voice channel as the bot.');
    assert.equal(queue.pause.mock.calls.length, 0);
  });

  test('pauses the queue and confirms', async () => {
    const interaction = makeInteraction();
    const queue = makeQueue();
    await pause.execute(interaction, makeClient({ queue }));
    assert.equal(queue.pause.mock.calls.length, 1);
    assert.equal(replyContent(interaction), '⏸️ Music paused.');
  });

  test('replies with an error if pause() throws', async (t) => {
    mock.method(console, 'error', () => {});
    t.after(() => mock.restoreAll());
    const interaction = makeInteraction();
    const queue = makeQueue({
      pause: mock.fn(async () => {
        throw new Error('voice lost');
      }),
    });
    await pause.execute(interaction, makeClient({ queue }));
    assert.equal(replyContent(interaction), '❌ Could not pause the music.');
  });
});

describe('resume', () => {
  test('replies with an error if there is no queue', async () => {
    const interaction = makeInteraction();
    await resume.execute(interaction, makeClient({ queue: null }));
    assert.equal(replyContent(interaction), '❌ No music is paused.');
  });

  test('replies with an error if the queue is already playing (playing=true)', async () => {
    const interaction = makeInteraction();
    const queue = makeQueue({ playing: true });
    await resume.execute(interaction, makeClient({ queue }));
    assert.equal(replyContent(interaction), '❌ No music is paused.');
    assert.equal(queue.resume.mock.calls.length, 0);
  });

  test('replies with a control error if the user is in another channel', async () => {
    const interaction = makeInteraction({ member: { voice: { channel: { id: VC_OTHER } } } });
    const queue = makeQueue({ playing: false });
    await resume.execute(interaction, makeClient({ queue }));
    assert.equal(replyContent(interaction), '❌ You must be in the same voice channel as the bot.');
  });

  test('resumes the queue and confirms', async () => {
    const interaction = makeInteraction();
    const queue = makeQueue({ playing: false });
    await resume.execute(interaction, makeClient({ queue }));
    assert.equal(queue.resume.mock.calls.length, 1);
    assert.equal(replyContent(interaction), '▶️ Music resumed.');
  });

  test('replies with an error if resume() throws', async (t) => {
    mock.method(console, 'error', () => {});
    t.after(() => mock.restoreAll());
    const interaction = makeInteraction();
    const queue = makeQueue({
      playing: false,
      resume: mock.fn(async () => {
        throw new Error('voice lost');
      }),
    });
    await resume.execute(interaction, makeClient({ queue }));
    assert.equal(replyContent(interaction), '❌ Could not resume the music.');
  });
});

describe('skip', () => {
  test('replies with an error if there is no queue', async () => {
    const interaction = makeInteraction();
    await skip.execute(interaction, makeClient({ queue: null }));
    assert.equal(replyContent(interaction), '❌ No music is playing.');
  });

  test('replies with a control error if the user is in another channel', async () => {
    const interaction = makeInteraction({ member: { voice: { channel: { id: VC_OTHER } } } });
    const queue = makeQueue();
    await skip.execute(interaction, makeClient({ queue }));
    assert.equal(replyContent(interaction), '❌ You must be in the same voice channel as the bot.');
    assert.equal(queue.skip.mock.calls.length, 0);
  });

  test('skips the song and confirms when there are more songs', async () => {
    const interaction = makeInteraction();
    const queue = makeQueue();
    await skip.execute(interaction, makeClient({ queue }));
    assert.equal(queue.skip.mock.calls.length, 1);
    assert.equal(replyArg(interaction), '⏭️ Song skipped.');
  });

  test('replies that there are no more songs when skip() throws NO_UP_NEXT', async (t) => {
    mock.method(console, 'error', () => {});
    t.after(() => mock.restoreAll());
    const interaction = makeInteraction();
    const queue = makeQueue({
      skip: mock.fn(async () => {
        const err = new Error('no more songs');
        err.errorCode = 'NO_UP_NEXT';
        throw err;
      }),
    });
    await skip.execute(interaction, makeClient({ queue }));
    assert.equal(replyArg(interaction), '⚠️ No more songs to skip.');
  });

  test('replies with a real error if skip() fails for another reason', async (t) => {
    mock.method(console, 'error', () => {});
    t.after(() => mock.restoreAll());
    const interaction = makeInteraction();
    const queue = makeQueue({
      skip: mock.fn(async () => {
        throw new Error('voice connection lost');
      }),
    });
    await skip.execute(interaction, makeClient({ queue }));
    assert.equal(replyArg(interaction), '❌ Could not skip the song.');
  });
});

describe('stop', () => {
  test('replies with an error (ephemeral) if there is no queue', async () => {
    const interaction = makeInteraction();
    await stop.execute(interaction, makeClient({ queue: null }));
    const arg = replyArg(interaction);
    assert.equal(arg.content, '❌ No music is playing.');
    assert.equal(arg.ephemeral, true);
  });

  test('replies with a control error if the user is in another channel', async () => {
    const interaction = makeInteraction({ member: { voice: { channel: { id: VC_OTHER } } } });
    const queue = makeQueue();
    await stop.execute(interaction, makeClient({ queue }));
    const arg = replyArg(interaction);
    assert.equal(arg.content, '❌ You must be in the same voice channel as the bot.');
    assert.equal(arg.ephemeral, true);
    assert.equal(queue.stop.mock.calls.length, 0);
  });

  test('stops the queue and disconnects the bot if there is a connection', async () => {
    const interaction = makeInteraction();
    const queue = makeQueue();
    const connection = { leave: mock.fn(() => {}) };
    await stop.execute(interaction, makeClient({ queue, connection }));
    assert.equal(queue.stop.mock.calls.length, 1);
    assert.equal(connection.leave.mock.calls.length, 1);
    assert.equal(replyArg(interaction), '🛑 Music stopped and bot disconnected from the voice channel.');
  });

  test('stops the queue and does not disconnect if there is no connection', async () => {
    const interaction = makeInteraction();
    const queue = makeQueue();
    await stop.execute(interaction, makeClient({ queue, connection: null }));
    assert.equal(queue.stop.mock.calls.length, 1);
    assert.equal(replyArg(interaction), '🛑 Music stopped and bot disconnected from the voice channel.');
  });

  test('replies with an error if queue.stop() throws', async (t) => {
    mock.method(console, 'error', () => {});
    t.after(() => mock.restoreAll());
    const interaction = makeInteraction();
    const queue = makeQueue({
      stop: mock.fn(async () => {
        throw new Error('stop failed');
      }),
    });
    await stop.execute(interaction, makeClient({ queue }));
    assert.equal(replyArg(interaction), '❌ There was an error stopping the music.');
  });
});

describe('volume', () => {
  test('replies with an error if there is no queue', async () => {
    const interaction = makeInteraction();
    await volume.execute(interaction, makeClient({ queue: null }));
    assert.equal(replyContent(interaction), '❌ No music is playing.');
  });

  test('replies with a control error if the user is in another channel', async () => {
    const interaction = makeInteraction({ member: { voice: { channel: { id: VC_OTHER } } } });
    const queue = makeQueue();
    await volume.execute(interaction, makeClient({ queue }));
    assert.equal(replyContent(interaction), '❌ You must be in the same voice channel as the bot.');
  });

  test('sets the volume to the parsed value and confirms', async () => {
    const interaction = makeInteraction();
    const queue = makeQueue();
    await volume.execute(interaction, makeClient({ queue }));
    assert.equal(queue.setVolume.mock.calls.length, 1);
    assert.equal(queue.setVolume.mock.calls[0].arguments[0], 50);
    assert.equal(replyArg(interaction), '🔊 Volume set to 50%');
  });
});

describe('queue', () => {
  test('replies that the queue is empty if there is no queue', async () => {
    const interaction = makeInteraction();
    await queueCmd.execute(interaction, makeClient({ queue: null }));
    assert.equal(replyContent(interaction), '📭 The queue is empty.');
  });

  test('shows an embed with song titles as links and their durations', async () => {
    const interaction = makeInteraction();
    const queue = makeQueue();
    await queueCmd.execute(interaction, makeClient({ queue }));
    const arg = replyArg(interaction);
    assert.ok(Array.isArray(arg.embeds) && arg.embeds.length === 1);
    const json = arg.embeds[0].toJSON();
    assert.equal(json.title, '📀 Current queue');
    assert.ok(json.description.includes('[Song A](https://youtube.com/watch?v=a)'));
    assert.ok(json.description.includes('[Song B](https://youtube.com/watch?v=b)'));
    assert.ok(json.description.includes('[2:05]'));
    assert.ok(json.description.includes('[3:20]'));
    assert.ok(json.footer.text.includes('2 song(s)'));
  });
});

describe('nowplaying', () => {
  test('replies with an error if there is no queue', async () => {
    const interaction = makeInteraction();
    await nowplaying.execute(interaction, makeClient({ queue: null }));
    const arg = replyArg(interaction);
    assert.equal(arg.content, '❌ No music is playing.');
    assert.equal(arg.ephemeral, true);
  });

  test('replies with an error if the queue has no songs', async () => {
    const interaction = makeInteraction();
    const queue = makeQueue({ songs: [] });
    await nowplaying.execute(interaction, makeClient({ queue }));
    const arg = replyArg(interaction);
    assert.equal(arg.content, '❌ No music is playing.');
  });

  test('shows an embed with the current song as a clickable title, thumbnail and volume', async () => {
    const interaction = makeInteraction();
    const queue = makeQueue({
      songs: [{ name: 'Song A', url: 'https://youtube.com/watch?v=a', duration: 125, formattedDuration: '2:05', thumbnail: 'https://img/a.jpg' }],
    });
    await nowplaying.execute(interaction, makeClient({ queue }));
    const arg = replyArg(interaction);
    const json = arg.embeds[0].toJSON();
    assert.equal(json.title, 'Song A');
    assert.equal(json.url, 'https://youtube.com/watch?v=a');
    assert.equal(json.thumbnail.url, 'https://img/a.jpg');
    assert.ok(json.fields.some(f => f.name === 'Duration' && f.value === '2:05'));
    assert.ok(json.fields.some(f => f.name === 'Volume' && f.value === '50%'));
  });
});

describe('leave', () => {
  test('replies with an error if the bot is not in a voice channel', async () => {
    const interaction = makeInteraction();
    await leave.execute(interaction, makeClient({ connection: null }));
    assert.equal(replyContent(interaction), '❌ The bot is not in a voice channel.');
  });

  test('replies with a control error if the user is in another channel', async () => {
    const interaction = makeInteraction({ member: { voice: { channel: { id: VC_OTHER } } } });
    const connection = { channel: { id: VC_BOT }, leave: mock.fn(() => {}) };
    await leave.execute(interaction, makeClient({ connection }));
    assert.equal(replyContent(interaction), '❌ You must be in the same voice channel as the bot.');
    assert.equal(connection.leave.mock.calls.length, 0);
  });

  test('makes the bot leave and confirms', async () => {
    const interaction = makeInteraction();
    const connection = { channel: { id: VC_BOT }, leave: mock.fn(() => {}) };
    await leave.execute(interaction, makeClient({ connection }));
    assert.equal(connection.leave.mock.calls.length, 1);
    assert.equal(replyArg(interaction), '👋 The bot has left the voice channel.');
  });

  test('replies with an error if connection.leave() throws', async (t) => {
    mock.method(console, 'error', () => {});
    t.after(() => mock.restoreAll());
    const interaction = makeInteraction();
    const connection = {
      channel: { id: VC_BOT },
      leave: mock.fn(() => {
        throw new Error('leave failed');
      }),
    };
    await leave.execute(interaction, makeClient({ connection }));
    assert.equal(replyArg(interaction), '❌ Could not leave the voice channel.');
  });
});

describe('play', () => {
  // NOTE: play.js destructures checkCooldown at require time, so mocking
  // helpers has no effect. Each test uses a distinct cooldown key
  // (guildId:userId) so tests don't block each other.

  test('replies with an error if the user is not in a voice channel', async () => {
    const interaction = makeInteraction({ member: { voice: { channel: null } } });
    const client = makeClient();
    await play.execute(interaction, client);
    assert.equal(replyContent(interaction), '❌ You must be in a voice channel.');
    assert.equal(client.distube.play.mock.calls.length, 0);
  });

  test('blocks the second request due to cooldown', async () => {
    const interaction = makeInteraction();
    const client = makeClient();
    await play.execute(interaction, client);
    await play.execute(interaction, client);
    assert.equal(interaction.reply.mock.calls.length, 2);
    assert.equal(replyContent(interaction, 1), '⏳ Wait a few seconds before requesting another song.');
    assert.equal(client.distube.play.mock.calls.length, 1);
  });

  test('replies with an error if the queue is full', async () => {
    const interaction = makeInteraction({ guildId: 'guild-play-full' });
    const client = makeClient({
      queue: makeQueue({ songs: Array.from({ length: 100 }, () => ({ name: 'x' })) }),
    });
    await play.execute(interaction, client);
    assert.equal(replyContent(interaction), '❌ The queue is full (max 100 songs).');
    assert.equal(client.distube.play.mock.calls.length, 0);
  });

  test('searches for the song and calls distube.play with the voice channel', async () => {
    const interaction = makeInteraction({ guildId: 'guild-play-ok' });
    const client = makeClient();
    await play.execute(interaction, client);
    assert.ok(replyArg(interaction).includes('🔍 Searching:'));
    assert.ok(replyArg(interaction).includes('test query'));
    const [voiceChannel, query, options] = client.distube.play.mock.calls[0].arguments;
    assert.equal(voiceChannel, interaction.member.voice.channel);
    assert.equal(query, 'test query');
    assert.equal(options.textChannel, interaction.channel);
    assert.equal(options.member, interaction.member);
  });

  test('resolves a plain-text query through YtDlpPlugin (YouTube) and passes the unwrapped song to distube.play', async () => {
    const song = { name: 'Never Gonna Give You Up', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' };
    // yt-dlp's ytsearchN: syntax always resolves to a playlist-shaped result,
    // even for a single match — the plugin lookup must unwrap it.
    const ytDlpPlugin = makeYtDlpPlugin(async () => ({ songs: [song] }));
    const interaction = makeInteraction({ guildId: 'guild-play-yt-search' });
    const client = makeClient({ plugins: [ytDlpPlugin] });

    await play.execute(interaction, client);

    assert.equal(ytDlpPlugin.resolve.mock.calls.length, 1);
    const [searchArg, resolveOptions] = ytDlpPlugin.resolve.mock.calls[0].arguments;
    assert.equal(searchArg, 'ytsearch1:test query');
    assert.equal(resolveOptions.member, interaction.member);

    const [, songArg] = client.distube.play.mock.calls[0].arguments;
    assert.equal(songArg, song);
  });

  test('falls back to the raw query if YtDlpPlugin finds no results', async () => {
    const ytDlpPlugin = makeYtDlpPlugin(async () => ({ songs: [] }));
    const interaction = makeInteraction({ guildId: 'guild-play-yt-empty' });
    const client = makeClient({ plugins: [ytDlpPlugin] });

    await play.execute(interaction, client);

    const [, songArg] = client.distube.play.mock.calls[0].arguments;
    assert.equal(songArg, 'test query');
  });

  test('does not attempt a YouTube search for a URL query, even with YtDlpPlugin available', async () => {
    const ytDlpPlugin = makeYtDlpPlugin(async () => ({ songs: [] }));
    const interaction = makeInteraction({
      guildId: 'guild-play-yt-url',
      options: { getString: () => 'https://www.youtube.com/watch?v=eBqthnZnu3Y' },
    });
    const client = makeClient({ plugins: [ytDlpPlugin] });

    await play.execute(interaction, client);

    assert.equal(ytDlpPlugin.resolve.mock.calls.length, 0);
    const [, songArg] = client.distube.play.mock.calls[0].arguments;
    assert.equal(songArg, 'https://www.youtube.com/watch?v=eBqthnZnu3Y');
  });

  test('propagates a YtDlpPlugin.resolve() error (e.g. bot-check) through the normal error handling', async (t) => {
    mock.method(console, 'error', () => {});
    t.after(() => mock.restoreAll());
    const ytDlpPlugin = makeYtDlpPlugin(async () => {
      throw new Error("Sign in to confirm you're not a bot.");
    });
    const interaction = makeInteraction({ guildId: 'guild-play-yt-error' });
    const client = makeClient({ plugins: [ytDlpPlugin] });

    await play.execute(interaction, client);

    assert.equal(client.distube.play.mock.calls.length, 0);
    const arg = interaction.editReply.mock.calls[0].arguments[0];
    assert.match(arg, /bot-check/);
  });

  test('extracts the URL if the user pasted the bot message text', async () => {
    const pasted = '🔍 Searching: `https://www.youtube.com/watch?v=eBqthnZnu3Y`';
    const interaction = makeInteraction({
      guildId: 'guild-play-pasted',
      options: { getString: () => pasted },
    });
    const client = makeClient();
    await play.execute(interaction, client);
    const [voiceChannel, query] = client.distube.play.mock.calls[0].arguments;
    assert.equal(query, 'https://www.youtube.com/watch?v=eBqthnZnu3Y');
    assert.equal(voiceChannel, interaction.member.voice.channel);
  });

  test('shows the playlist loading message for playlist URLs', async () => {
    const interaction = makeInteraction({
      guildId: 'guild-play-playlist',
      options: { getString: () => 'https://www.youtube.com/playlist?list=PLabc123' },
    });
    const client = makeClient();
    await play.execute(interaction, client);
    assert.ok(replyArg(interaction).includes('📃 Loading playlist:'));
    assert.ok(replyArg(interaction).includes('PLabc123'));
    const [, query] = client.distube.play.mock.calls[0].arguments;
    assert.equal(query, 'https://www.youtube.com/playlist?list=PLabc123');
  });

  test('strips surrounding backticks from a query without a URL', async () => {
    const interaction = makeInteraction({
      guildId: 'guild-play-backticks',
      options: { getString: () => '`my song`' },
    });
    const client = makeClient();
    await play.execute(interaction, client);
    const [, query] = client.distube.play.mock.calls[0].arguments;
    assert.equal(query, 'my song');
  });

  test('edits the reply with an error if distube.play() throws', async (t) => {
    mock.method(console, 'error', () => {});
    t.after(() => mock.restoreAll());
    const interaction = makeInteraction({ guildId: 'guild-play-error' });
    const client = makeClient();
    client.distube.play = mock.fn(async () => {
      throw new Error('play failed');
    });
    await play.execute(interaction, client);
    const arg = interaction.editReply.mock.calls[0].arguments[0];
    assert.equal(arg, '❌ Could not play. Try another name or URL.');
  });

  test('edits the reply with a bot-check-specific error if yt-dlp reports a YouTube sign-in wall', async (t) => {
    mock.method(console, 'error', () => {});
    t.after(() => mock.restoreAll());
    const interaction = makeInteraction({ guildId: 'guild-play-botcheck' });
    const client = makeClient();
    client.distube.play = mock.fn(async () => {
      throw new Error("DisTubeError [YTDLP_ERROR]: ERROR: [youtube] abc: Sign in to confirm you're not a bot.");
    });
    await play.execute(interaction, client);
    const arg = interaction.editReply.mock.calls[0].arguments[0];
    assert.match(arg, /bot-check/);
    assert.match(arg, /cookies\.txt/);
  });

  test('blocks a query with a yt-dlp flag without calling distube.play', async () => {
    const interaction = makeInteraction({
      guildId: 'guild-play-flag',
      options: { getString: () => '--update-to=attacker/repo@tag' },
    });
    const client = makeClient();
    await play.execute(interaction, client);
    const arg = replyArg(interaction);
    assert.equal(arg.content, '❌ That search term is not valid.');
    assert.equal(arg.ephemeral, true);
    assert.equal(client.distube.play.mock.calls.length, 0);
  });

  test('blocks a file:// query (LFI) without calling distube.play', async () => {
    const interaction = makeInteraction({
      guildId: 'guild-play-file',
      options: { getString: () => 'file:///etc/passwd' },
    });
    const client = makeClient();
    await play.execute(interaction, client);
    const arg = replyArg(interaction);
    assert.equal(arg.content, '❌ Only http(s) links are supported.');
    assert.equal(arg.ephemeral, true);
    assert.equal(client.distube.play.mock.calls.length, 0);
  });
});

describe('set', () => {
  function makeSeekInteraction(time, overrides = {}) {
    return makeInteraction({
      options: { getString: () => time, getInteger: () => 50 },
      ...overrides,
    });
  }

  test('replies with an error if there is no queue', async () => {
    const interaction = makeSeekInteraction('1:00');
    await set.execute(interaction, makeClient({ queue: null }));
    assert.equal(replyContent(interaction), '❌ No music is playing.');
  });

  test('replies with a control error if the user is in another channel', async () => {
    const interaction = makeSeekInteraction('1:00', { member: { voice: { channel: { id: VC_OTHER } } } });
    const queue = makeQueue({ songs: [{ name: 'Song A', duration: 200 }] });
    await set.execute(interaction, makeClient({ queue }));
    assert.equal(replyContent(interaction), '❌ You must be in the same voice channel as the bot.');
    assert.equal(queue.seek.mock.calls.length, 0);
  });

  test('replies with an error for an invalid time format', async () => {
    const interaction = makeSeekInteraction('abc');
    const queue = makeQueue({ songs: [{ name: 'Song A', duration: 200 }] });
    await set.execute(interaction, makeClient({ queue }));
    assert.equal(replyContent(interaction), '❌ Use a valid time in mm:ss format (for example, 3:20).');
    assert.equal(queue.seek.mock.calls.length, 0);
  });

  test('replies with an error if the time exceeds the song duration', async () => {
    const interaction = makeSeekInteraction('5:00');
    const queue = makeQueue({ songs: [{ name: 'Song A', duration: 200, formattedDuration: '3:20' }] });
    await set.execute(interaction, makeClient({ queue }));
    assert.equal(replyContent(interaction), '❌ The time cannot exceed the song duration (3:20).');
    assert.equal(queue.seek.mock.calls.length, 0);
  });

  test('sets the position and confirms', async () => {
    const interaction = makeSeekInteraction('3:20');
    const queue = makeQueue({ songs: [{ name: 'Song A', duration: 300 }] });
    await set.execute(interaction, makeClient({ queue }));
    assert.equal(queue.seek.mock.calls.length, 1);
    assert.equal(queue.seek.mock.calls[0].arguments[0], 200);
    assert.equal(replyArg(interaction), '⏩ Playback set to 3:20.');
  });

  test('replies with an error if seek() throws', async (t) => {
    mock.method(console, 'error', () => {});
    t.after(() => mock.restoreAll());
    const interaction = makeSeekInteraction('1:00');
    const queue = makeQueue({
      songs: [{ name: 'Song A', duration: 300 }],
      seek: mock.fn(async () => {
        throw new Error('seek failed');
      }),
    });
    await set.execute(interaction, makeClient({ queue }));
    assert.equal(replyArg(interaction), '❌ Could not change the playback position.');
  });
});

describe('help', () => {
  test('the help text lists the commands, including /leave and /help', async () => {
    const interaction = makeInteraction();
    await help.execute(interaction);
    const content = replyArg(interaction).content;
    assert.ok(content.includes('/leave'));
    assert.ok(content.includes('/help'));
    assert.equal(replyArg(interaction).flags, 64);
  });
});
