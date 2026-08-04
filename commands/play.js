const { SlashCommandBuilder, escapeMarkdown } = require('discord.js');
const { MAX_QUEUE_SIZE, checkCooldown, cleanQuery, getQueryError, isPlaylistUrl } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Reproduce una canción o playlist')
    .addStringOption(option =>
      option.setName('cancion')
        .setDescription('Nombre o URL')
        .setRequired(true)
    ),
  async execute(interaction, client) {
    const query = cleanQuery(interaction.options.getString('cancion'));
    // Hardening anti-RCE: bloquear queries que empiecen con "-" (inyección de
    // flags de yt-dlp) o usen protocolos no-http(s) (LFI vía file://).
    const queryError = getQueryError(query);
    if (queryError) return interaction.reply({ content: queryError, ephemeral: true });
    const voiceChannel = interaction.member?.voice?.channel;
    // En DMs `interaction.member` es null; dar mensaje claro en vez de TypeError
    if (!interaction.member) return interaction.reply({ content: '❌ Este comando solo funciona en servidores.', ephemeral: true });
    if (!voiceChannel) return interaction.reply({ content: '❌ Debes estar en un canal de voz.', ephemeral: true });

    const key = `${interaction.guildId}:${interaction.user.id}`;
    if (checkCooldown(key, 5000)) {
      return interaction.reply({ content: '⏳ Esperá unos segundos antes de pedir otra canción.', ephemeral: true });
    }

    const queue = client.distube.getQueue(interaction);
    if (queue && queue.songs.length >= MAX_QUEUE_SIZE) {
      return interaction.reply({ content: `❌ La cola está llena (máximo ${MAX_QUEUE_SIZE} canciones).`, ephemeral: true });
    }

    // Las playlists/álbumes tardan en resolverse canción por canción
    // (yt-dlp extrae secuencialmente; probado: ~1.5s por canción). Mostrar
    // "cargando playlist" en vez de "buscando" para que no parezca colgado.
    const isPlaylist = isPlaylistUrl(query);
    await interaction.reply(
      isPlaylist
        ? `📃 Cargando playlist: \`${escapeMarkdown(query)}\`. Lleva unos segundos...`
        : `🔍 Buscando: \`${escapeMarkdown(query)}\``
    );
    try {
      await client.distube.play(voiceChannel, query, {
        textChannel: interaction.channel,
        member: interaction.member,
      });
    } catch (error) {
      console.error('Error al reproducir:', error);
      await interaction
        .editReply('❌ No se pudo reproducir. Probá con otro nombre o URL.')
        .catch(() => {});
    }
  },
};
