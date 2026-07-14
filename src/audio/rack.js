/**
 * UNIT — context-agnostic rack factory (Module 1 core).
 *
 * buildRack() constructs the ENTIRE audio graph inside the CURRENT Tone
 * context, so the exact same code runs live and inside Tone.Offline (export
 * parity). Nothing here references module-level singletons — every node is
 * created per call.
 *
 * Master graph:
 *   voice → [insert pedals from per-track fx] → Channel(-6dB) → sequencerBus(-3dB)
 *         → glueCompressor → limiter(-1dBFS) → destination
 *   previewPlayer → previewChannel(-3dB) → limiter   (bypasses comp: record
 *                                                      previews never pump)
 *
 * Per-track FX schema (state.channels.<id>.fx):
 *   { distortion?: {drive,tone,mix}, delay?: {time,feedback,wet},
 *     reverb?: {decay,preDelay,wet}, filter?: {type,frequency,Q} }
 *
 * Requires Tone.js >= 14.x
 */
import * as Tone from 'tone';
import { createDistortion } from './fx/distortion.js';
import { createDelay } from './fx/delay.js';
import { createReverb } from './fx/reverb.js';
import { createFilter } from './fx/filter.js';
import { createKickVoice, createClapVoice, createHatVoice } from './voices.js';

/** Real Tone node to feed the FX chain — Player is its own node; synth voices expose .outputNode. */
const outNode = (voice) => voice.outputNode ?? voice;

/** Sample if decoded, else synthesized. Both share the rack trigger interface. */
function voiceFor(name, buffers, synthFactory) {
  return buffers.has(name) ? new Tone.Player(buffers.get(name)) : synthFactory();
}

const FX_FACTORY = {
  distortion: createDistortion,
  delay: createDelay,
  reverb: createReverb,
  filter: createFilter,
};

/** Build the insert pedals declared in a track's fx config, in a stable order. */
function buildPedals(fxConfig = {}) {
  const order = ['filter', 'distortion', 'delay', 'reverb'];
  const pedals = [];
  for (const id of order) {
    if (fxConfig[id]) pedals.push(FX_FACTORY[id](fxConfig[id]));
  }
  return pedals;
}

/**
 * @param {object} state   sequencerState (bpm, channels, ...)
 * @param {object} opts
 * @param {Tone.ToneAudioBuffers} opts.buffers  decoded samples
 * @param {Tone.ToneAudioNode}    [opts.destination]  defaults to context destination
 * @param {boolean}               [opts.withPreview]  build previewChannel + duck (live only)
 * @returns {Promise<object>} rack handles
 */
export async function buildRack(state, { buffers, destination, withPreview = false } = {}) {
  const dest = destination ?? Tone.getDestination();

  // ---- master chain -------------------------------------------------------
  const limiter = new Tone.Limiter(-1).connect(dest);
  const glueCompressor = new Tone.Compressor({
    threshold: -12, ratio: 4, attack: 0.003, release: 0.25, knee: 6,
  }).connect(limiter);
  const sequencerBus = new Tone.Gain(Tone.dbToGain(-3)).connect(glueCompressor);

  const meter = new Tone.Meter({ smoothing: 0.9 });
  limiter.connect(meter);

  let previewChannel = null;
  if (withPreview) {
    previewChannel = new Tone.Channel({ volume: -3, channelCount: 2 }).connect(limiter);
  }

  // ---- per-track voices + pedals -----------------------------------------
  const tracks = {};
  const allPedals = [];

  function registerTrack(id, voice, fxConfig) {
    const pedals = buildPedals(fxConfig);
    allPedals.push(...pedals);
    const inserts = pedals.flatMap((p) => p.inserts);
    const channel = new Tone.Channel({ volume: -6, pan: 0 }).connect(sequencerBus);
    Tone.connectSeries(outNode(voice), ...inserts, channel);
    tracks[id] = { voice, pedals, channel };
    return tracks[id];
  }

  const ch = state.channels ?? {};

  // KICK — gabber signature: distortion drive lives here by default
  const kick = voiceFor('kick', buffers, () => createKickVoice(ch.kick?.voice ?? {}));
  registerTrack('kick', kick, ch.kick?.fx);

  // CLAP
  const clap = voiceFor('clap', buffers, () => createClapVoice(ch.clap?.voice ?? {}));
  registerTrack('clap', clap, ch.clap?.fx);

  // HAT — closed + open with a choke group. Sample pair if both decoded,
  // else one synth hat voice exposing the same trigger/stop surface.
  let hatVoice, hat;
  if (buffers.has('hatClosed') && buffers.has('hatOpen')) {
    const hatClosed = new Tone.Player(buffers.get('hatClosed'));
    const hatOpen = new Tone.Player(buffers.get('hatOpen'));
    const hatMerge = new Tone.Gain(1);
    hatClosed.connect(hatMerge);
    hatOpen.connect(hatMerge);
    hatVoice = {
      outputNode: hatMerge,
      dispose: () => { hatClosed.dispose(); hatOpen.dispose(); hatMerge.dispose(); },
    };
    hat = {
      trigger(time, open) {
        hatOpen.stop(time);
        hatClosed.stop(time);
        (open ? hatOpen : hatClosed).start(time);
      },
    };
  } else {
    hatVoice = createHatVoice(ch.hat?.voice ?? {});
    hat = hatVoice; // synth voice already has .trigger / .stop
  }
  registerTrack('hat', hatVoice, ch.hat?.fx);

  // BREAK — sliced amen-style breakbeat (jungle/breakcore). One Player,
  // 16 equal slices; each step triggers a slice (re-choppable via
  // ch.break.slices). playbackRate locks the break to the transport BPM.
  // Optional: only built when the sample is in the manifest.
  let breakPlayer = null;
  const breakNativeBpm = state.breakNativeBpm ?? 165;
  if (buffers.has('break')) {
    breakPlayer = new Tone.Player(buffers.get('break'));
    breakPlayer.playbackRate = state.bpm / breakNativeBpm;
    registerTrack('break', breakPlayer, ch.break?.fx);
  }

  // ACID — 303-style mono synth + dedicated filter (always present)
  const acidFilter = new Tone.Filter({ type: 'lowpass', frequency: 800, rolloff: -24, Q: 8 });
  const acid = new Tone.MonoSynth({
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.003, decay: 0.12, sustain: 0.1, release: 0.05 },
    filterEnvelope: { attack: 0.003, decay: 0.18, sustain: 0.2, baseFrequency: 200, octaves: 3.5 },
  });
  registerTrack('acid', acid, ch.acid?.fx);
  // route acid through its filter first: rewire (voice already connected to pedals+channel)
  acid.disconnect();
  const acidPedalInserts = tracks.acid.pedals.flatMap((p) => p.inserts);
  Tone.connectSeries(acid, acidFilter, ...acidPedalInserts, tracks.acid.channel);
  // (channel already connected to sequencerBus above)

  // ---- sequence -----------------------------------------------------------
  const notesOf = (id) => ch[id]?.pattern ?? null; // optional acid note pattern
  const stepsOf = (id) => ch[id]?.steps ?? [];
  const activeOf = (id) => ch[id]?.active !== false;

  const sequence = new Tone.Sequence(
    (time, step) => {
      if (activeOf('kick') && stepsOf('kick')[step]) kick.start(time);
      if (activeOf('clap') && stepsOf('clap')[step]) clap.start(time);
      if (activeOf('hat') && stepsOf('hat')[step]) {
        const openMap = ch.hat?.open ?? [];
        hat.trigger(time, !!openMap[step]);
      }
      if (breakPlayer && activeOf('break') && stepsOf('break')[step]) {
        const sliceMap = ch.break?.slices ?? [];
        const idx = Math.min(15, Math.max(0, sliceMap[step] ?? step));
        const srcSliceDur = breakPlayer.buffer.duration / 16;
        // consume one source slice; wall-clock time = srcDur / rate = one 16th at bpm
        breakPlayer.start(time, idx * srcSliceDur, srcSliceDur / breakPlayer.playbackRate);
      }
      if (activeOf('acid') && stepsOf('acid')[step]) {
        const notes = notesOf('acid');
        const note = notes?.[step]?.note ?? 'C2';
        acid.triggerAttackRelease(note, '16n', time);
      }
      Tone.Draw.schedule(() => {
        document.dispatchEvent(new CustomEvent('sequencer:step', { detail: { step } }));
      }, time);
    },
    [...Array(16).keys()],
    '16n',
  );
  sequence.start(0);

  // ---- reverb readiness: impulse responses must exist before transport ----
  await Promise.all(
    allPedals.filter((p) => p.id === 'reverb').map((p) => p.ready()),
  );

  // ---- duck (live preview support) ---------------------------------------
  function duckSequencer(on) {
    sequencerBus.gain.rampTo(Tone.dbToGain(on ? -15 : -3), on ? 0.12 : 0.4);
  }

  /** Worst-case FX tail across all tracks, for offline render length. */
  function tailSeconds() {
    let tail = 0.1;
    for (const p of allPedals) {
      if (typeof p.tailSeconds === 'function') tail = Math.max(tail, p.tailSeconds());
    }
    tail = Math.max(tail, acidFilter ? 0.1 : 0);
    return tail;
  }

  function dispose() {
    sequence.dispose();
    allPedals.forEach((p) => p.dispose());
    Object.values(tracks).forEach((t) => { t.voice.dispose?.(); t.channel.dispose(); });
    [acidFilter, sequencerBus, glueCompressor, limiter, meter].forEach((n) => n.dispose());
    previewChannel?.dispose();
  }

  return {
    tracks, sequence, hat, acidFilter,
    sequencerBus, previewChannel, meter,
    duckSequencer, tailSeconds, dispose,
  };
}
