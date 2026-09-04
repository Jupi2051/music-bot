'use strict';

const { test, describe, mock, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const { ALIASES, getPrefix, resolveCommand, createFakeInteraction, handleTextCommand } = require('../utils/textCommands');

function makeMessage({ content = '', bot = false, guild = { id: 'guild-1' }, member = { id: 'member-1' } } = {}) {
  const message = {
    content,
    author: { id: 'user-1', bot },
    guild,
    guildId: guild ? guild.id : null,
    member,
  };
  message.channel = {
    send: mock.fn(async (payload) => {
      const sent = { ...(typeof payload === 'string' ? { content: payload } : payload) };
      sent.edit = mock.fn(async (editPayload) => {
        Object.assign(sent, typeof editPayload === 'string' ? { content: editPayload } : editPayload);
        return sent;
      });
      return sent;
    }),
  };
  return message;
}

function makeClient(commands) {
  return { commands: new Map(Object.entries(commands)) };
}

describe('getPrefix', () => {
  const original = process.env.PREFIX;
  afterEach(() => {
    if (original === undefined) delete process.env.PREFIX;
    else process.env.PREFIX = original;
  });

  test('defaults to Chl when PREFIX is not set', () => {
    delete process.env.PREFIX;
    assert.equal(getPrefix(), 'Chl');
  });

  test('uses PREFIX from the environment when set', () => {
    process.env.PREFIX = '!!';
    assert.equal(getPrefix(), '!!');
  });

  test('falls back to Chl when PREFIX is blank', () => {
    process.env.PREFIX = '   ';
    assert.equal(getPrefix(), 'Chl');
  });
});

describe('resolveCommand', () => {
  const client = makeClient({ play: { data: { name: 'play' } }, queue: { data: { name: 'queue' } } });

  test('resolves the canonical command name, case-insensitively', () => {
    assert.equal(resolveCommand(client, 'PLAY'), client.commands.get('play'));
  });

  test('resolves a declared alias, case-insensitively', () => {
    assert.equal(resolveCommand(client, 'P'), client.commands.get('play'));
    assert.equal(resolveCommand(client, 'q'), client.commands.get('queue'));
  });

  test('returns undefined for an unknown token', () => {
    assert.equal(resolveCommand(client, 'nonsense'), undefined);
  });

  test('every canonical name and alias maps to exactly one command (no collisions)', () => {
    const seen = new Map();
    for (const [name, aliases] of Object.entries(ALIASES)) {
      for (const token of [name, ...aliases]) {
        const lower = token.toLowerCase();
        const owner = seen.get(lower);
        assert.ok(!owner || owner === name, `"${token}" is claimed by both "${owner}" and "${name}"`);
        seen.set(lower, name);
      }
    }
  });
});

describe('createFakeInteraction', () => {
  test('exposes member/guild/guildId/channel/user from the message', () => {
    const message = makeMessage();
    const interaction = createFakeInteraction(message, '');
    assert.equal(interaction.member, message.member);
    assert.equal(interaction.guild, message.guild);
    assert.equal(interaction.guildId, message.guildId);
    assert.equal(interaction.channel, message.channel);
    assert.equal(interaction.user, message.author);
  });

  test('getString returns the trimmed argument string', () => {
    const interaction = createFakeInteraction(makeMessage(), '  never gonna give you up  ');
    assert.equal(interaction.options.getString(), 'never gonna give you up');
  });

  test('getString returns an empty string when there are no arguments', () => {
    const interaction = createFakeInteraction(makeMessage(), '');
    assert.equal(interaction.options.getString(), '');
  });

  test('getInteger parses the argument string as a number', () => {
    const interaction = createFakeInteraction(makeMessage(), '80');
    assert.equal(interaction.options.getInteger(), 80);
  });

  test('getInteger returns NaN when the argument is not numeric', () => {
    const interaction = createFakeInteraction(makeMessage(), 'abc');
    assert.ok(Number.isNaN(interaction.options.getInteger()));
  });

  test('reply() sends a string through message.channel.send and marks replied', async () => {
    const message = makeMessage();
    const interaction = createFakeInteraction(message, '');
    await interaction.reply('hello');
    assert.equal(message.channel.send.mock.calls.length, 1);
    assert.deepEqual(message.channel.send.mock.calls[0].arguments[0], { content: 'hello' });
    assert.equal(interaction.replied, true);
  });

  test('reply() with an object payload passes content and embeds through, dropping ephemeral', async () => {
    const message = makeMessage();
    const interaction = createFakeInteraction(message, '');
    const embeds = [{ fake: true }];
    await interaction.reply({ content: 'hi', embeds, ephemeral: true });
    assert.deepEqual(message.channel.send.mock.calls[0].arguments[0], { content: 'hi', embeds });
  });

  test('editReply() edits the previously sent reply', async () => {
    const message = makeMessage();
    const interaction = createFakeInteraction(message, '');
    const sent = await interaction.reply('first');
    await interaction.editReply('second');
    assert.equal(sent.edit.mock.calls.length, 1);
    assert.deepEqual(sent.edit.mock.calls[0].arguments[0], { content: 'second' });
  });

  test('editReply() falls back to reply() if nothing was sent yet', async () => {
    const message = makeMessage();
    const interaction = createFakeInteraction(message, '');
    await interaction.editReply('only message');
    assert.equal(message.channel.send.mock.calls.length, 1);
  });
});

describe('handleTextCommand', () => {
  afterEach(() => {
    delete process.env.PREFIX;
  });

  test('ignores messages from bots', async () => {
    const execute = mock.fn(async () => {});
    const message = makeMessage({ content: 'Chlplay test', bot: true });
    const client = makeClient({ play: { execute } });
    assert.equal(await handleTextCommand(message, client), false);
    assert.equal(execute.mock.calls.length, 0);
  });

  test('ignores DMs (no guild)', async () => {
    const execute = mock.fn(async () => {});
    const message = makeMessage({ content: 'Chlplay test', guild: null });
    const client = makeClient({ play: { execute } });
    assert.equal(await handleTextCommand(message, client), false);
    assert.equal(execute.mock.calls.length, 0);
  });

  test('ignores messages that do not start with the prefix', async () => {
    const execute = mock.fn(async () => {});
    const message = makeMessage({ content: 'hello there' });
    const client = makeClient({ play: { execute } });
    assert.equal(await handleTextCommand(message, client), false);
    assert.equal(execute.mock.calls.length, 0);
  });

  test('ignores an unknown command after a valid prefix', async () => {
    const execute = mock.fn(async () => {});
    const message = makeMessage({ content: 'Chlfoobar' });
    const client = makeClient({ play: { execute } });
    assert.equal(await handleTextCommand(message, client), false);
    assert.equal(execute.mock.calls.length, 0);
  });

  test('resolves the canonical command name and runs it, case-insensitively', async () => {
    const execute = mock.fn(async () => {});
    const message = makeMessage({ content: 'CHLPLAY some song' });
    const client = makeClient({ play: { execute } });
    assert.equal(await handleTextCommand(message, client), true);
    assert.equal(execute.mock.calls.length, 1);
    const [interaction] = execute.mock.calls[0].arguments;
    assert.equal(interaction.options.getString(), 'some song');
  });

  test('resolves a short alias to the same command', async () => {
    const execute = mock.fn(async () => {});
    const message = makeMessage({ content: 'Chlp some song' });
    const client = makeClient({ play: { execute } });
    assert.equal(await handleTextCommand(message, client), true);
    assert.equal(execute.mock.calls.length, 1);
  });

  test('allows optional whitespace between the prefix and the command', async () => {
    const execute = mock.fn(async () => {});
    const message = makeMessage({ content: 'Chl  play song' });
    const client = makeClient({ play: { execute } });
    assert.equal(await handleTextCommand(message, client), true);
    const [interaction] = execute.mock.calls[0].arguments;
    assert.equal(interaction.options.getString(), 'song');
  });

  test('respects a custom PREFIX from the environment', async () => {
    process.env.PREFIX = '!!';
    const execute = mock.fn(async () => {});
    const message = makeMessage({ content: '!!play song' });
    const client = makeClient({ play: { execute } });
    assert.equal(await handleTextCommand(message, client), true);
    assert.equal(execute.mock.calls.length, 1);
  });

  test('replies with a generic error message if the command throws before replying', async (t) => {
    mock.method(console, 'error', () => {});
    t.after(() => mock.restoreAll());
    const message = makeMessage({ content: 'Chlplay boom' });
    const client = makeClient({
      play: { execute: mock.fn(async () => { throw new Error('boom'); }) },
    });
    assert.equal(await handleTextCommand(message, client), true);
    assert.equal(message.channel.send.mock.calls.length, 1);
    assert.deepEqual(message.channel.send.mock.calls[0].arguments[0], { content: '❌ An error occurred.' });
  });

  test('edits the existing reply with the error if the command had already replied before throwing', async (t) => {
    mock.method(console, 'error', () => {});
    t.after(() => mock.restoreAll());
    const message = makeMessage({ content: 'Chlplay boom' });
    let capturedSent;
    const client = makeClient({
      play: {
        execute: mock.fn(async (interaction) => {
          capturedSent = await interaction.reply('searching...');
          throw new Error('boom');
        }),
      },
    });
    assert.equal(await handleTextCommand(message, client), true);
    assert.equal(message.channel.send.mock.calls.length, 1, 'only the initial reply should call send()');
    assert.equal(capturedSent.edit.mock.calls.length, 1);
    assert.deepEqual(capturedSent.edit.mock.calls[0].arguments[0], { content: '❌ An error occurred.' });
  });
});

describe('integration with a real command', () => {
  test('runs the real /queue command end-to-end from a text message', async () => {
    const queueCmd = require('../commands/queue');
    const message = makeMessage({ content: 'Chlqueue' });
    const client = { commands: new Map([['queue', queueCmd]]), distube: { getQueue: () => null } };

    assert.equal(await handleTextCommand(message, client), true);
    assert.equal(message.channel.send.mock.calls.length, 1);
    assert.deepEqual(message.channel.send.mock.calls[0].arguments[0], { content: '📭 The queue is empty.' });
  });

  test('runs the real /queue command via its "q" alias', async () => {
    const queueCmd = require('../commands/queue');
    const message = makeMessage({ content: 'ChlQ' });
    const client = { commands: new Map([['queue', queueCmd]]), distube: { getQueue: () => null } };

    assert.equal(await handleTextCommand(message, client), true);
    assert.equal(message.channel.send.mock.calls.length, 1);
  });
});
