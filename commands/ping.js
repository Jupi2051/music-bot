const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Comprueba la latencia del bot'),
  async execute(interaction, client) {
    const sent = await interaction.reply({ content: '📡 Calculando ping...', fetchReply: true });
    const ping = sent.createdTimestamp - interaction.createdTimestamp;
    
    await interaction.editReply(`🏓 Pong!\nLatencia del bot: ${ping}ms\nLatencia de la API: ${client.ws.ping}ms`);
  }
};
