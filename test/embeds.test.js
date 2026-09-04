'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { buildNowPlayingEmbed, buildAddedToQueueEmbed, buildQueueEmbed, formatDuration } = require('../utils/embeds');

function song(overrides = {}) {
  return {
    name: 'Never Gonna Give You Up',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    duration: 213,
    formattedDuration: '3:33',
    ...overrides,
  };
}

describe('formatDuration', () => {
  test('formats seconds under an hour as m:ss', () => {
    assert.equal(formatDuration(65), '1:05');
    assert.equal(formatDuration(5), '0:05');
  });

  test('formats an hour or more as h:mm:ss', () => {
    assert.equal(formatDuration(3665), '1:01:05');
  });

  test('falls back to 0:00 for invalid input', () => {
    assert.equal(formatDuration(0), '0:00');
    assert.equal(formatDuration(-5), '0:00');
    assert.equal(formatDuration(NaN), '0:00');
    assert.equal(formatDuration(undefined), '0:00');
  });
});

describe('buildNowPlayingEmbed', () => {
  test('sets the title as a clickable link to the song URL', () => {
    const json = buildNowPlayingEmbed(song()).toJSON();
    assert.equal(json.title, 'Never Gonna Give You Up');
    assert.equal(json.url, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    assert.equal(json.author.name, '🎵 Now playing');
  });

  test('includes the thumbnail when the song has one', () => {
    const json = buildNowPlayingEmbed(song({ thumbnail: 'https://img/x.jpg' })).toJSON();
    assert.equal(json.thumbnail.url, 'https://img/x.jpg');
  });

  test('omits the thumbnail when the song has none', () => {
    const json = buildNowPlayingEmbed(song()).toJSON();
    assert.equal(json.thumbnail, undefined);
  });

  test('shows a live badge instead of a duration for live songs', () => {
    const json = buildNowPlayingEmbed(song({ isLive: true, formattedDuration: undefined })).toJSON();
    assert.ok(json.fields.some(f => f.name === 'Duration' && f.value === 'Live'));
  });

  test('labels a YouTube source', () => {
    const json = buildNowPlayingEmbed(song({ source: 'youtube' })).toJSON();
    assert.ok(json.fields.some(f => f.name === 'Source' && f.value === 'YouTube'));
  });

  test('labels a Spotify source', () => {
    const json = buildNowPlayingEmbed(song({ source: 'spotify' })).toJSON();
    assert.ok(json.fields.some(f => f.name === 'Source' && f.value === 'Spotify'));
  });

  test('labels a SoundCloud source', () => {
    const json = buildNowPlayingEmbed(song({ source: 'soundcloud' })).toJSON();
    assert.ok(json.fields.some(f => f.name === 'Source' && f.value === 'SoundCloud'));
  });

  test('omits the Source field when the song has none', () => {
    const json = buildNowPlayingEmbed(song()).toJSON();
    assert.ok(!json.fields.some(f => f.name === 'Source'));
  });

  test('includes volume and requester when provided', () => {
    const json = buildNowPlayingEmbed(song({ user: { id: '42' } }), { volume: 80 }).toJSON();
    assert.ok(json.fields.some(f => f.name === 'Volume' && f.value === '80%'));
    assert.ok(json.fields.some(f => f.name === 'Requested by' && f.value === '<@42>'));
  });

  test('escapes markdown in the uploader name', () => {
    const json = buildNowPlayingEmbed(song({ uploader: { name: '__Sketchy__ Channel' } })).toJSON();
    const field = json.fields.find(f => f.name === 'Uploader');
    assert.equal(field.value, '\\_\\_Sketchy\\_\\_ Channel');
  });
});

describe('buildAddedToQueueEmbed', () => {
  test('uses the "added to queue" author label and shows the queue position', () => {
    const json = buildAddedToQueueEmbed(song(), { position: 4 }).toJSON();
    assert.equal(json.author.name, '➕ Added to queue');
    assert.ok(json.fields.some(f => f.name === 'Position in queue' && f.value === '4'));
  });

  test('works the same for a Spotify-sourced song as a YouTube one', () => {
    const json = buildAddedToQueueEmbed(song({ source: 'spotify', thumbnail: 'https://img/cover.jpg' }), { position: 1 }).toJSON();
    assert.equal(json.title, 'Never Gonna Give You Up');
    assert.equal(json.url, song().url);
    assert.equal(json.thumbnail.url, 'https://img/cover.jpg');
    assert.ok(json.fields.some(f => f.name === 'Source' && f.value === 'Spotify'));
  });

  test('omits the position field when none is given', () => {
    const json = buildAddedToQueueEmbed(song()).toJSON();
    assert.ok(!json.fields.some(f => f.name === 'Position in queue'));
  });
});

describe('buildQueueEmbed', () => {
  test('shows an empty-queue message when there are no songs', () => {
    const json = buildQueueEmbed({ songs: [] }).toJSON();
    assert.equal(json.description, 'The queue is empty.');
  });

  test('lists each song as a link with its duration and totals them in the footer', () => {
    const queue = { songs: [song(), song({ name: 'Take On Me', url: 'https://youtube.com/watch?v=djV11Xbc914', duration: 225, formattedDuration: '3:45' })] };
    const json = buildQueueEmbed(queue).toJSON();
    assert.ok(json.description.includes('[Never Gonna Give You Up](https://www.youtube.com/watch?v=dQw4w9WgXcQ)'));
    assert.ok(json.description.includes('[Take On Me](https://youtube.com/watch?v=djV11Xbc914)'));
    assert.ok(json.description.includes('`[3:33]`'));
    assert.ok(json.description.includes('`[3:45]`'));
    assert.ok(json.footer.text.includes('2 song(s)'));
    assert.ok(json.footer.text.includes('Total: 7:18'));
  });

  test('truncates the description for very long queues instead of exceeding the 4096-char limit', () => {
    const songs = Array.from({ length: 100 }, (_, i) => song({
      name: `Song number ${i} with a fairly long descriptive title to pad things out`,
      url: `https://www.youtube.com/watch?v=song${i}`,
    }));
    const json = buildQueueEmbed({ songs }).toJSON();
    assert.ok(json.description.length <= 4096);
    assert.match(json.description, /…and \d+ more song\(s\)\.$/);
  });
});
