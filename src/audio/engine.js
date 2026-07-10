/**
 * UNIT SEQUENCER — audio engine core (Module 1)
 *
 * Owns the Tone.js context, the master bus (glue compressor + brickwall
 * limiter), sample preloading, and track registration. Nothing outside this
 * file may connect to Tone.getDestination() — all audio routes through the
 * master chain built here.
 *
 * Requires Tone.js >= 14.x
 */
import * as Tone from 'tone';
import { createClapDistortion } from './fx/clapDistortion.js';

// ---------------------------------------------------------------------------
// 1. Context — created once, before any node, tuned for feel over safety.
// ---------------------------------------------------------------------------

const context = new Tone.Context({
  latencyHint: 'interactive',
  lookAhead: 0.05,     // 50 ms scheduling horizon
  updateInterval: 0.02,
});
Tone.setContext(context);

export function getLatencyReport() {
  const raw = context.rawContext;
  return {
    baseLatency: raw.baseLatency ?? null,     // s, hardware buffer
    outputLatency: raw.outputLatency ?? null, // s, full output path
    lookAhead: context.lookAhead,
    sampleRate: raw.sampleRate,
  };
}

// ---------------------------------------------------------------------------
// 2. Master bus — the only path to the speakers.
//    tracks → masterBus(-3dB) → glue comp → limiter(-1dBFS) → destination
// ---------------------------------------------------------------------------

const limiter = new Tone.Limiter(-1).toDestination();

const glueCompressor = new Tone.Compressor({
  threshold: -12,
  ratio: 4,
  attack: 0.003,
  release: 0.25,
  knee: 6,
}).connect(limiter);

const masterBus = new Tone.Gain(Tone.dbToGain(-3)).connect(glueCompressor);

/** Master output meter, e.g. for a VU in the UI (call .getValue()). */
export const masterMeter = new Tone.Meter({ smoothing: 0.9 });
limiter.connect(masterMeter);

// ---------------------------------------------------------------------------
// 3. Sample preloading — decode once, share buffers, never fetch mid-pattern.
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
  return new Promise((resolve, reject) => {
    let remaining = Object.keys(manifest).length;
    for (const [name, url] of Object.entries(manifest)) {
      buffers.add(
        name,
        url,
        () => { if (--remaining === 0) resolve(buffers); },
        (err) => reject(new Error(`sample load failed: ${name} (${url}): ${err}`)),
      );
    }
  });
}

// ---------------------------------------------------------------------------
// 4. Track registration — per-track Channel with enforced -6 dB headroom.
// ---------------------------------------------------------------------------

const tracks = new Map();

/**
 * Register a voice on the master bus.
 * @param {string} name          track id, e.g. 'kick'
 * @param {Tone.ToneAudioNode} voice  the sound source (Player, synth, ...)
 * @param {Tone.ToneAudioNode[]} [inserts]  FX between voice and channel
 * @returns {Tone.Channel}
 */
export function registerTrack(name, voice, inserts = []) {
  const channel = new Tone.Channel({ volume: -6, pan: 0 }).connect(masterBus);
  Tone.connectSeries(voice, ...inserts, channel);
  tracks.set(name, { voice, inserts, channel });
  return channel;
}

export function getTrack(name) {
  return tracks.get(name);
}

// ---------------------------------------------------------------------------
// 5. Voice rack — everything allocated HERE, at init. The sequencer loop only
//    triggers; it never constructs.
// ---------------------------------------------------------------------------

export const clapDistortion = createClapDistortion();

export function buildVoiceRack() {
  const kick = new Tone.Player(buffers.get('kick'));
  const clap = new Tone.Player(buffers.get('clap'));
  const hat = new Tone.Player(buffers.get('hatClosed'));

  // 303: mono synth + its signature filter squelch
  const acidFilter = new Tone.Filter({ type: 'lowpass', frequency: 800, rolloff: -24, Q: 8 });
  const acid = new Tone.MonoSynth({
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.003, decay: 0.12, sustain: 0.1, release: 0.05 },
    filterEnvelope: { attack: 0.003, decay: 0.18, sustain: 0.2, baseFrequency: 200, octaves: 3.5 },
  });

  registerTrack('kick', kick);
  registerTrack('clap', clap, clapDistortion.inserts); // Module 1.3 pedal in the insert slot
  registerTrack('hat', hat);
  registerTrack('acid', acid, [acidFilter]);

  return { kick, clap, hat, acid, acidFilter };
}

// ---------------------------------------------------------------------------
// 6. Transport helpers — sample-accurate scheduling pattern.
// ---------------------------------------------------------------------------

/**
 * Build the 16-step sequence. `onStep(time, stepIndex)` MUST use `time` for all
 * trigger calls and Tone.Draw for all UI work — never Tone.now(), never direct
 * DOM mutation.
 */
export function buildSequence(onStep) {
  return new Tone.Sequence(
    (time, step) => {
      onStep(time, step);
      Tone.Draw.schedule(() => {
        document.dispatchEvent(new CustomEvent('sequencer:step', { detail: { step } }));
      }, time);
    },
    [...Array(16).keys()],
    '16n',
  );
}

/** Call inside the user's first click/tap. */
export async function startAudio(bpm = 175) {
  await Tone.start();
  Tone.getTransport().bpm.value = bpm;
  Tone.getTransport().start('+0.05');
  console.info('[engine] latency report:', getLatencyReport());
}
