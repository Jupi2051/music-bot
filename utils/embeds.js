const { EmbedBuilder, escapeMarkdown } = require('discord.js');

const BRAND_COLOR = 0x8b5cf6;
const FOOTER_TEXT = 'GordoDJ';

// Description hard cap is 4096 chars; leave room for the "…and N more" line.
const MAX_DESCRIPTION = 4096;

function baseEmbed() {
  return new EmbedBuilder().setColor(BRAND_COLOR).setFooter({ text: FOOTER_TEXT }).setTimestamp();
}

// mm:ss / h:mm:ss for a raw seconds count. Songs already carry
// formattedDuration from DisTube; this only covers totals we compute ourselves.
function formatDuration(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '0:00';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${ss}`;
  return `${minutes}:${ss}`;
}

function songDuration(song) {
  if (song.isLive) return 'Live';
  return song.formattedDuration || formatDuration(song.duration);
}

// DisTube plugins tag each song with a lowercase `source` (yt-dlp uses the
// yt-dlp extractor name, e.g. "youtube"; @distube/spotify and
// @distube/soundcloud use "spotify"/"soundcloud"). Prettify the common ones,
// fall back to capitalizing whatever else shows up.
const SOURCE_LABELS = { youtube: 'YouTube', spotify: 'Spotify', soundcloud: 'SoundCloud' };
function sourceLabel(source) {
  if (!source) return null;
  return SOURCE_LABELS[source.toLowerCase()] || source.charAt(0).toUpperCase() + source.slice(1);
}

// Shared song embed: clickable title (setURL turns the whole title into a
// hyperlink), thumbnail as cover/video art, duration and source — same shape
// whether the song came from YouTube, Spotify or SoundCloud. `authorLabel` and
// the extra fields are what distinguish "now playing" from "added to queue".
function buildSongEmbed(song, { authorLabel, volume, position } = {}) {
  const embed = baseEmbed()
    .setAuthor({ name: authorLabel })
    .setTitle(song.name || 'Unknown title')
    .addFields({ name: 'Duration', value: songDuration(song), inline: true });

  if (song.url) embed.setURL(song.url);
  if (song.thumbnail) embed.setThumbnail(song.thumbnail);
  const source = sourceLabel(song.source);
  if (source) embed.addFields({ name: 'Source', value: source, inline: true });
  if (song.uploader?.name) embed.addFields({ name: 'Uploader', value: escapeMarkdown(song.uploader.name), inline: true });
  if (typeof volume === 'number') embed.addFields({ name: 'Volume', value: `${volume}%`, inline: true });
  if (typeof position === 'number') embed.addFields({ name: 'Position in queue', value: `${position}`, inline: true });
  if (song.user) embed.addFields({ name: 'Requested by', value: `<@${song.user.id}>`, inline: true });

  return embed;
}

function buildNowPlayingEmbed(song, { volume } = {}) {
  return buildSongEmbed(song, { authorLabel: '🎵 Now playing', volume });
}

function buildAddedToQueueEmbed(song, { position } = {}) {
  return buildSongEmbed(song, { authorLabel: '➕ Added to queue', position });
}

// Queue embed: each song title is a markdown link to its URL, followed by its
// duration. Trims to fit Discord's 4096-char description limit for long queues.
function buildQueueEmbed(queue) {
  const embed = baseEmbed().setTitle('📀 Current queue');

  if (!queue || !queue.songs.length) {
    embed.setDescription('The queue is empty.');
    return embed;
  }

  const lines = queue.songs.map((song, i) => {
    const name = escapeMarkdown(song.name || 'Unknown title');
    const label = song.url ? `[${name}](${song.url})` : name;
    const duration = songDuration(song);
    return i === 0 ? `🎶 ${label} \`[${duration}]\`` : `**${i}.** ${label} \`[${duration}]\``;
  });

  let description = lines.join('\n');
  if (description.length > MAX_DESCRIPTION) {
    let shown = 0;
    let acc = '';
    for (const line of lines) {
      const next = acc ? `${acc}\n${line}` : line;
      if (next.length > MAX_DESCRIPTION - 60) break;
      acc = next;
      shown++;
    }
    description = `${acc}\n…and ${lines.length - shown} more song(s).`;
  }
  embed.setDescription(description);

  const totalSeconds = queue.songs.reduce((acc, song) => acc + (Number.isFinite(song.duration) ? song.duration : 0), 0);
  embed.setFooter({ text: `${FOOTER_TEXT} • ${queue.songs.length} song(s) • Total: ${formatDuration(totalSeconds)}` });

  return embed;
}

module.exports = { BRAND_COLOR, buildNowPlayingEmbed, buildAddedToQueueEmbed, buildQueueEmbed, formatDuration };
