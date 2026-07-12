/**
 * UNIT SEQUENCER — audio engine core (Module 1)
 *
 * Owns the Tone.js context, sample preloading, and the LIVE rack instance.
 * The audio graph itself lives in rack.js (context-agnostic) so live playback
 * and offline export share one builder. Nothing outside the engine/rack pair
 * connects to Tone.getDestination().
 *
 * Requires Tone.js >= 14.x
 */
import * as Tone from 'tone';
import { buildRack } from './rack.js';

// ---------------------------------------------------------------------------
// 1. Context — created once, before any node, tuned for feel over safety.
// ---------------------------------------------------------------------------

const context = new Tone.Context({
  latencyHint: 'interactive',
  lookAhead: 0.05,
  updateInterval: 0.02,
});
Tone.setContext(context);

export function getLatencyReport() {
  const raw = context.rawContext;
  return {
    baseLatency: raw.baseLatency ?? null,
    outputLatency: raw.outputLatency ?? null,
    lookAhead: context.lookAhead,
    sampleRate: raw.sampleRate,
  };
}

// ---------------------------------------------------------------------------
// 2. Sample preloading — decode once, share buffers, never fetch mid-pattern.
// ---------------------------------------------------------------------------

const SAMPLE_MANIFEST = {
  kick: 'samples/909-kick.wav',
  clap: 'samples/909-clap.wav',
  hatClosed: 'samples/909-hat-closed.wav',
  hatOpen: 'samples/909-hat-open.wav',
};

export const buffers = new Tone.ToneAudioBuffers();

/** Resolves when every sample is decoded. Gate the play button on this. */
export function preloadSamples(manifest = SAMPLE_MANIFEST) {
  const entries = Object.entries(manifest);
  if (entries.length === 0) return Promise.resolve(buffers); // empty-manifest fix
  return new Promise((resolve, reject) => {
    let remaining = entries.length;
    for (const [name, url] of entries) {
      buffers.add(
        name, url,
        () => { if (--remaining === 0) resolve(buffers); },
        (err) => reject(new Error(`sample load failed: ${name} (${url}): ${err}`)),
      );
    }
  });
}

// ---------------------------------------------------------------------------
// 3. Live rack — one instance, built against the live context.
// ---------------------------------------------------------------------------

let liveRack = null;

/** Build (or rebuild) the live audio graph from a state snapshot. */
export async function initLiveRack(state) {
  if (liveRack) liveRack.dispose();
  liveRack = await buildRack(state, { buffers, withPreview: true });
  return liveRack;
}

export function getLiveRack() { return liveRack; }

/** Master output meter for the VU strip (liveRack.meter.getValue()). */
export function getMasterMeter() { return liveRack?.meter ?? null; }

// ---------------------------------------------------------------------------
// 4. Transport — call startAudio() inside the user's first gesture.
// ---------------------------------------------------------------------------

export async function startAudio(bpm = 175) {
  await Tone.start();
  Tone.getTransport().bpm.value = bpm;
  Tone.getTransport().start('+0.05');
  console.info('[engine] latency report:', getLatencyReport());
}

export function stopAudio() { Tone.getTransport().stop(); }
export function setBpm(bpm) { Tone.getTransport().bpm.rampTo(bpm, 0.05); }
