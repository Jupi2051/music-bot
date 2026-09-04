const { SlashCommandBuilder } = require("discord.js");
const { assertControl } = require("../utils/helpers");

function parseTimestamp(value) {
  const parts = value.trim().split(":");
  if (
    parts.length < 2 ||
    parts.length > 3 ||
    parts.some((part) => !/^\d+$/.test(part))
  )
    return null;

  const seconds = Number(parts.at(-1));
  const minutes = Number(parts.at(-2));
  const hours = parts.length === 3 ? Number(parts[0]) : 0;
  if (seconds > 59 || minutes > 59 || !Number.isSafeInteger(hours)) return null;

  const totalSeconds = hours * 3600 + minutes * 60 + seconds;
  return Number.isSafeInteger(totalSeconds) ? totalSeconds : null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("set")
    .setDescription("Changes the playback position")
    .addStringOption((option) =>
      option
        .setName("time")
        .setDescription("Position (mm:ss or hh:mm:ss)")
        .setRequired(true),
    ),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction);
    if (!queue)
      return interaction.reply({
        content: "❌ No music is playing.",
        ephemeral: true,
      });

    const controlError = assertControl(interaction, queue.voiceChannel?.id);
    if (controlError)
      return interaction.reply({ content: controlError, ephemeral: true });

    const timestamp = interaction.options.getString("time");
    const seconds = parseTimestamp(timestamp);
    const duration = queue.songs?.[0]?.duration;
    if (seconds === null || !Number.isFinite(duration)) {
      return interaction.reply({
        content: "❌ Use a valid time in mm:ss format (for example, 3:20).",
        ephemeral: true,
      });
    }
    if (seconds > duration) {
      return interaction.reply({
        content: `❌ The time cannot exceed the song duration (${queue.songs[0].formattedDuration}).`,
        ephemeral: true,
      });
    }

    try {
      await queue.seek(seconds);
      await interaction.reply(`⏩ Playback set to ${timestamp.trim()}.`);
    } catch (error) {
      console.error("Error changing playback position:", error);
      await interaction
        .reply("❌ Could not change the playback position.")
        .catch(() => {});
    }
  },
};
