'use strict';

// Tests de todos los comandos en commands/*.js. Se mockea interaction y
// client.distube; los comandos nunca tocan red ni DisTube real.
//
// NOT TESTABLE: la construcción real de SlashCommandBuilder.data (discord.js
// real) no se ejercita aquí: se asume válida porque update-commands.js la
// valida al deployar. Los handlers de error de red de DisTube tampoco, ya que
// distube se mockea por completo.

const { test, describe, mock } = require('node:test');
const assert = require('node:assert/strict');

const play = require('../commands/play');
const skip = require('../commands/skip');
const stop = require('../commands/stop');
const pause = require('../commands/pause');
const resume = require('../commands/resume');
const volume = require('../commands/volume');
const queueCmd = require('../commands/queue');
const leave = require('../commands/leave');
const help = require('../commands/help');

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
    songs: [{ name: 'Song A' }, { name: 'Song B' }],
    pause: mock.fn(() => {}),
    resume: mock.fn(() => {}),
    skip: mock.fn(async () => {}),
    stop: mock.fn(async () => {}),
    setVolume: mock.fn(() => {}),
    ...overrides,
  };
}

function makeClient({ queue = null, connection = null } = {}) {
  return {
    distube: {
      getQueue: mock.fn(() => queue),
      play: mock.fn(async () => {}),
      voices: { get: mock.fn(() => connection) },
    },
  };
}

function replyArg(interaction, callIndex = 0) {
  return interaction.reply.mock.calls[callIndex].arguments[0];
}

// Normaliza el argumento del reply: los comandos responden con string o con
// { content, ephemeral }; esto extrae el texto en ambos casos.
function replyContent(interaction, callIndex = 0) {
  const arg = replyArg(interaction, callIndex);
  return typeof arg === 'string' ? arg : arg.content;
}

describe('pause', () => {
  test('responde error si no hay cola', async () => {
    const interaction = makeInteraction();
    await pause.execute(interaction, makeClient({ queue: null }));
    assert.equal(replyContent(interaction), '❌ No hay música reproduciéndose.');
  });

  test('responde error si la cola está pausada (playing=false)', async () => {
    const interaction = makeInteraction();
    const queue = makeQueue({ playing: false });
    await pause.execute(interaction, makeClient({ queue }));
    assert.equal(replyContent(interaction), '❌ No hay música reproduciéndose.');
    assert.equal(queue.pause.mock.calls.length, 0);
  });

  test('responde error de control si el usuario no está en el canal del bot', async () => {
    const interaction = makeInteraction({ member: { voice: { channel: { id: VC_OTHER } } } });
    const queue = makeQueue();
    await pause.execute(interaction, makeClient({ queue }));
    assert.equal(replyContent(interaction), '❌ Debes estar en el mismo canal de voz que el bot.');
    assert.equal(queue.pause.mock.calls.length, 0);
  });

  test('pausa la cola y confirma', async () => {
    const interaction = makeInteraction();
    const queue = makeQueue();
    await pause.execute(interaction, makeClient({ queue }));
    assert.equal(queue.pause.mock.calls.length, 1);
    assert.equal(replyContent(interaction), '⏸️ Música pausada.');
  });

  test('responde error si pause() falla', async (t) => {
    mock.method(console, 'error', () => {});
    t.after(() => mock.restoreAll());
    const interaction = makeInteraction();
    const queue = makeQueue({
      pause: mock.fn(async () => {
        throw new Error('voice lost');
      }),
    });
    await pause.execute(interaction, makeClient({ queue }));
    assert.equal(replyContent(interaction), '❌ No se pudo pausar la música.');
  });
});

describe('resume', () => {
  test('responde error si no hay cola', async () => {
    const interaction = makeInteraction();
    await resume.execute(interaction, makeClient({ queue: null }));
    assert.equal(replyContent(interaction), '❌ No hay música pausada.');
  });

  test('responde error si la cola ya está reproduciendo (playing=true)', async () => {
    const interaction = makeInteraction();
    const queue = makeQueue({ playing: true });
    await resume.execute(interaction, makeClient({ queue }));
    assert.equal(replyContent(interaction), '❌ No hay música pausada.');
    assert.equal(queue.resume.mock.calls.length, 0);
  });

  test('responde error de control si el usuario está en otro canal', async () => {
    const interaction = makeInteraction({ member: { voice: { channel: { id: VC_OTHER } } } });
    const queue = makeQueue({ playing: false });
    await resume.execute(interaction, makeClient({ queue }));
    assert.equal(replyContent(interaction), '❌ Debes estar en el mismo canal de voz que el bot.');
  });

  test('reanuda la cola y confirma', async () => {
    const interaction = makeInteraction();
    const queue = makeQueue({ playing: false });
    await resume.execute(interaction, makeClient({ queue }));
    assert.equal(queue.resume.mock.calls.length, 1);
    assert.equal(replyContent(interaction), '▶️ Música reanudada.');
  });

  test('responde error si resume() falla', async (t) => {
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
    assert.equal(replyContent(interaction), '❌ No se pudo reanudar la música.');
  });
});

describe('skip', () => {
  test('responde error si no hay cola', async () => {
    const interaction = makeInteraction();
    await skip.execute(interaction, makeClient({ queue: null }));
    assert.equal(replyContent(interaction), '❌ No hay música reproduciéndose.');
  });

  test('responde error de control si el usuario está en otro canal', async () => {
    const interaction = makeInteraction({ member: { voice: { channel: { id: VC_OTHER } } } });
    const queue = makeQueue();
    await skip.execute(interaction, makeClient({ queue }));
    assert.equal(replyContent(interaction), '❌ Debes estar en el mismo canal de voz que el bot.');
    assert.equal(queue.skip.mock.calls.length, 0);
  });

  test('salta la canción y confirma cuando hay más canciones', async () => {
    const interaction = makeInteraction();
    const queue = makeQueue();
    await skip.execute(interaction, makeClient({ queue }));
    assert.equal(queue.skip.mock.calls.length, 1);
    assert.equal(replyArg(interaction), '⏭️ Canción saltada.');
  });

  test('responde que no hay más canciones cuando skip() tira NO_UP_NEXT', async (t) => {
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
    assert.equal(replyArg(interaction), '⚠️ No hay más canciones para saltar.');
  });

  test('responde error real si skip() falla por otra causa', async (t) => {
    mock.method(console, 'error', () => {});
    t.after(() => mock.restoreAll());
    const interaction = makeInteraction();
    const queue = makeQueue({
      skip: mock.fn(async () => {
        throw new Error('voice connection lost');
      }),
    });
    await skip.execute(interaction, makeClient({ queue }));
    assert.equal(replyArg(interaction), '❌ No se pudo saltar la canción.');
  });
});

describe('stop', () => {
  test('responde error (ephemeral) si no hay cola', async () => {
    const interaction = makeInteraction();
    await stop.execute(interaction, makeClient({ queue: null }));
    const arg = replyArg(interaction);
    assert.equal(arg.content, '❌ No hay música reproduciéndose.');
    assert.equal(arg.ephemeral, true);
  });

  test('responde error de control si el usuario está en otro canal', async () => {
    const interaction = makeInteraction({ member: { voice: { channel: { id: VC_OTHER } } } });
    const queue = makeQueue();
    await stop.execute(interaction, makeClient({ queue }));
    const arg = replyArg(interaction);
    assert.equal(arg.content, '❌ Debes estar en el mismo canal de voz que el bot.');
    assert.equal(arg.ephemeral, true);
    assert.equal(queue.stop.mock.calls.length, 0);
  });

  test('detiene la cola y desconecta al bot si hay conexión', async () => {
    const interaction = makeInteraction();
    const queue = makeQueue();
    const connection = { leave: mock.fn(() => {}) };
    await stop.execute(interaction, makeClient({ queue, connection }));
    assert.equal(queue.stop.mock.calls.length, 1);
    assert.equal(connection.leave.mock.calls.length, 1);
    assert.equal(replyArg(interaction), '🛑 Música detenida y bot desconectado del canal de voz.');
  });

  test('detiene la cola y no desconecta si no hay conexión', async () => {
    const interaction = makeInteraction();
    const queue = makeQueue();
    await stop.execute(interaction, makeClient({ queue, connection: null }));
    assert.equal(queue.stop.mock.calls.length, 1);
    assert.equal(replyArg(interaction), '🛑 Música detenida y bot desconectado del canal de voz.');
  });

  test('responde error si queue.stop() falla', async (t) => {
    mock.method(console, 'error', () => {});
    t.after(() => mock.restoreAll());
    const interaction = makeInteraction();
    const queue = makeQueue({
      stop: mock.fn(async () => {
        throw new Error('stop failed');
      }),
    });
    await stop.execute(interaction, makeClient({ queue }));
    assert.equal(replyArg(interaction), '❌ Hubo un error al detener la música.');
  });
});

describe('volume', () => {
  test('responde error si no hay cola', async () => {
    const interaction = makeInteraction();
    await volume.execute(interaction, makeClient({ queue: null }));
    assert.equal(replyContent(interaction), '❌ No hay música reproduciéndose.');
  });

  test('responde error de control si el usuario está en otro canal', async () => {
    const interaction = makeInteraction({ member: { voice: { channel: { id: VC_OTHER } } } });
    const queue = makeQueue();
    await volume.execute(interaction, makeClient({ queue }));
    assert.equal(replyContent(interaction), '❌ Debes estar en el mismo canal de voz que el bot.');
  });

  test('ajusta el volumen con el valor parseado y confirma', async () => {
    const interaction = makeInteraction();
    const queue = makeQueue();
    await volume.execute(interaction, makeClient({ queue }));
    assert.equal(queue.setVolume.mock.calls.length, 1);
    assert.equal(queue.setVolume.mock.calls[0].arguments[0], 50);
    assert.equal(replyArg(interaction), '🔊 Volumen ajustado a 50%');
  });
});

describe('queue', () => {
  test('responde que la cola está vacía si no hay cola', async () => {
    const interaction = makeInteraction();
    await queueCmd.execute(interaction, makeClient({ queue: null }));
    assert.equal(replyContent(interaction), '📭 La cola está vacía.');
  });

  test('muestra la cola formateada con los títulos de las canciones', async () => {
    const interaction = makeInteraction();
    const queue = makeQueue({ songs: [{ name: 'Song A' }, { name: 'Song B' }] });
    await queueCmd.execute(interaction, makeClient({ queue }));
    const content = replyArg(interaction);
    assert.ok(content.includes('🎶 Song A'));
    assert.ok(content.includes('1. Song B'));
  });
});

describe('leave', () => {
  test('responde error si el bot no está en un canal de voz', async () => {
    const interaction = makeInteraction();
    await leave.execute(interaction, makeClient({ connection: null }));
    assert.equal(replyContent(interaction), '❌ El bot no está en un canal de voz.');
  });

  test('responde error de control si el usuario está en otro canal', async () => {
    const interaction = makeInteraction({ member: { voice: { channel: { id: VC_OTHER } } } });
    const connection = { channel: { id: VC_BOT }, leave: mock.fn(() => {}) };
    await leave.execute(interaction, makeClient({ connection }));
    assert.equal(replyContent(interaction), '❌ Debes estar en el mismo canal de voz que el bot.');
    assert.equal(connection.leave.mock.calls.length, 0);
  });

  test('hace salir al bot y confirma', async () => {
    const interaction = makeInteraction();
    const connection = { channel: { id: VC_BOT }, leave: mock.fn(() => {}) };
    await leave.execute(interaction, makeClient({ connection }));
    assert.equal(connection.leave.mock.calls.length, 1);
    assert.equal(replyArg(interaction), '👋 El bot ha salido del canal de voz.');
  });

  test('responde error si connection.leave() falla', async (t) => {
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
    assert.equal(replyArg(interaction), '❌ No se pudo salir del canal de voz.');
  });
});

describe('play', () => {
  // OJO: play.js destructurea checkCooldown al requerir el módulo, así que
  // mockear helpers no tiene efecto. Cada test usa una key de cooldown
  // distinta (guildId:userId) para no bloquearse entre tests.

  test('responde error si el usuario no está en un canal de voz', async () => {
    const interaction = makeInteraction({ member: { voice: { channel: null } } });
    const client = makeClient();
    await play.execute(interaction, client);
    assert.equal(replyContent(interaction), '❌ Debes estar en un canal de voz.');
    assert.equal(client.distube.play.mock.calls.length, 0);
  });

  test('bloquea la segunda petición por cooldown', async () => {
    const interaction = makeInteraction();
    const client = makeClient();
    await play.execute(interaction, client);
    await play.execute(interaction, client);
    assert.equal(interaction.reply.mock.calls.length, 2);
    assert.equal(replyContent(interaction, 1), '⏳ Esperá unos segundos antes de pedir otra canción.');
    assert.equal(client.distube.play.mock.calls.length, 1);
  });

  test('responde error si la cola está llena', async () => {
    const interaction = makeInteraction({ guildId: 'guild-play-full' });
    const client = makeClient({
      queue: makeQueue({ songs: Array.from({ length: 100 }, () => ({ name: 'x' })) }),
    });
    await play.execute(interaction, client);
    assert.equal(replyContent(interaction), '❌ La cola está llena (máximo 100 canciones).');
    assert.equal(client.distube.play.mock.calls.length, 0);
  });

  test('busca la canción y llama a distube.play con el canal de voz', async () => {
    const interaction = makeInteraction({ guildId: 'guild-play-ok' });
    const client = makeClient();
    await play.execute(interaction, client);
    assert.ok(replyArg(interaction).includes('🔍 Buscando:'));
    assert.ok(replyArg(interaction).includes('test query'));
    const [voiceChannel, query, options] = client.distube.play.mock.calls[0].arguments;
    assert.equal(voiceChannel, interaction.member.voice.channel);
    assert.equal(query, 'test query');
    assert.equal(options.textChannel, interaction.channel);
    assert.equal(options.member, interaction.member);
  });

  test('extrae la URL si el usuario pegó el texto del mensaje del bot', async () => {
    const pasted = '🔍 Buscando: `https://www.youtube.com/watch?v=eBqthnZnu3Y`';
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

  test('limpia backticks envolventes de un query sin URL', async () => {
    const interaction = makeInteraction({
      guildId: 'guild-play-backticks',
      options: { getString: () => '`mi canción`' },
    });
    const client = makeClient();
    await play.execute(interaction, client);
    const [, query] = client.distube.play.mock.calls[0].arguments;
    assert.equal(query, 'mi canción');
  });

  test('edita la respuesta con error si distube.play() falla', async (t) => {
    mock.method(console, 'error', () => {});
    t.after(() => mock.restoreAll());
    const interaction = makeInteraction({ guildId: 'guild-play-error' });
    const client = makeClient();
    client.distube.play = mock.fn(async () => {
      throw new Error('play failed');
    });
    await play.execute(interaction, client);
    const arg = interaction.editReply.mock.calls[0].arguments[0];
    assert.equal(arg, '❌ No se pudo reproducir. Probá con otro nombre o URL.');
  });
});

describe('help', () => {
  test('la ayuda lista los comandos, incluyendo /leave y /help', async () => {
    const interaction = makeInteraction();
    await help.execute(interaction);
    const content = replyArg(interaction).content;
    assert.ok(content.includes('/leave'));
    assert.ok(content.includes('/help'));
    assert.equal(replyArg(interaction).flags, 64);
  });
});
