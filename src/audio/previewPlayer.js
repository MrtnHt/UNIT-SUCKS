/**
 * UNIT — record preview player (spec §B.3).
 *
 * One reused Tone.Player routed through the live rack's previewChannel
 * (bypasses the glue compressor so a loud record never pumps the loop).
 * Playing a preview ducks the sequencer bus −12 dB; the transport NEVER stops.
 * Mutual exclusion: starting a preview stops any current one — no overlap.
 *
 * Emits DOM CustomEvents: 'preview:started' {url}, 'preview:ended' {url}.
 */
import * as Tone from 'tone';

const BUFFER_CACHE = new Map(); // url → Tone.ToneAudioBuffer (max 8)
const STOP_FADE = 0.08;   // 80 ms
const END_FADE = 0.5;     // 500 ms

let player = null;
let rackRef = null;
let currentUrl = null;
let endTimer = null;

/** Wire the preview player to the live rack (call after initLiveRack). */
export function attachPreview(rack) {
  rackRef = rack;
  if (!player) {
    player = new Tone.Player({ fadeOut: STOP_FADE });
  }
  if (rack?.previewChannel) player.connect(rack.previewChannel);
  return player;
}

export function isPlaying() {
  return !!currentUrl;
}

async function loadBuffer(url) {
  if (BUFFER_CACHE.has(url)) return BUFFER_CACHE.get(url);
  const buf = new Tone.ToneAudioBuffer();
  await buf.load(url);
  if (BUFFER_CACHE.size >= 8) {
    const oldest = BUFFER_CACHE.keys().next().value;
    BUFFER_CACHE.get(oldest)?.dispose?.();
    BUFFER_CACHE.delete(oldest);
  }
  BUFFER_CACHE.set(url, buf);
  return buf;
}

/**
 * Play a record preview. Ducks the loop; stops any current preview first.
 * @param {string} url
 * @param {object} [opts] { duration } seconds (clip to 15–30 s upstream)
 */
export async function playPreview(url, { duration } = {}) {
  if (!rackRef) throw new Error('previewPlayer: call attachPreview(rack) first');

  await stopPreview({ silent: true }); // mutual exclusion, no un-duck flicker
  const buffer = await loadBuffer(url);

  player.buffer = buffer;
  currentUrl = url;
  rackRef.duckSequencer(true);

  const now = Tone.now();
  const len = Math.min(duration ?? buffer.duration, buffer.duration);
  player.start(now);
  // schedule end-fade + natural stop
  player.stop(now + len);
  clearTimeout(endTimer);
  endTimer = setTimeout(() => finish(url), (len - END_FADE) * 1000);

  document.dispatchEvent(new CustomEvent('preview:started', { detail: { url } }));
}

/** Stop the current preview and recover the loop level. */
export async function stopPreview({ silent = false } = {}) {
  clearTimeout(endTimer);
  if (!currentUrl) return;
  const ending = currentUrl;
  currentUrl = null;
  try { player.stop(Tone.now()); } catch { /* already stopped */ }
  if (rackRef) rackRef.duckSequencer(false);
  if (!silent) {
    document.dispatchEvent(new CustomEvent('preview:ended', { detail: { url: ending } }));
  }
}

function finish(url) {
  if (currentUrl !== url) return;
  currentUrl = null;
  if (rackRef) rackRef.duckSequencer(false);
  document.dispatchEvent(new CustomEvent('preview:ended', { detail: { url } }));
}
