/**
 * UNIT — synthesized drum voices (Module 1, ESX-style groovebox core).
 *
 * Context-agnostic factories. Each voice is a Tone-node-like wrapper that is
 * INTERCHANGEABLE with a Tone.Player in rack.js: it exposes `.outputNode` (the
 * real Tone node to connect into the FX chain) plus trigger/param methods.
 *
 * These let the studio make sound with NO sample assets — samples, when
 * present, override the matching voice (see rack.js `voiceFor`). Every voice
 * also honors a `voice` config block on its channel for live tweaking:
 *   state.channels.<id>.voice = { tune?, decay?, tone?, ... }
 *
 * Requires Tone.js >= 14.x
 */
import * as Tone from 'tone';

const clamp01 = (v) => Math.min(1, Math.max(0, v));

/** 909-style kick: pitch-swept sine drum. tune = base freq, decay = body length. */
export function createKickVoice(cfg = {}) {
  const out = new Tone.Gain(1);
  const synth = new Tone.MembraneSynth({
    pitchDecay: cfg.pitchDecay ?? 0.045,
    octaves: cfg.octaves ?? 8,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: cfg.decay ?? 0.4, sustain: 0, release: 0.03 },
  }).connect(out);
  let tune = cfg.tune ?? 41; // Hz (~E1)
  return {
    outputNode: out,
    start: (time) => synth.triggerAttackRelease(tune, '8n', time),
    stop: () => {},
    set: (key, v) => {
      if (key === 'decay') synth.envelope.decay = 0.08 + clamp01(v) * 0.6;
      if (key === 'pitch') tune = 30 + clamp01(v) * 60;
    },
    dispose: () => { synth.dispose(); out.dispose(); },
  };
}

/** 909-style clap: filtered white-noise burst. tone shifts the band, decay its length. */
export function createClapVoice(cfg = {}) {
  const out = new Tone.Gain(1);
  const band = new Tone.Filter({
    type: 'bandpass',
    frequency: cfg.tone != null ? 800 + clamp01(cfg.tone) * 2400 : 1200,
    Q: 1.4,
  }).connect(out);
  const noise = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: cfg.decay ?? 0.12, sustain: 0, release: 0.02 },
  }).connect(band);
  return {
    outputNode: out,
    start: (time) => noise.triggerAttackRelease('16n', time),
    stop: () => {},
    set: (key, v) => {
      if (key === 'decay') noise.envelope.decay = 0.03 + clamp01(v) * 0.25;
      if (key === 'tone') band.frequency.rampTo(800 + clamp01(v) * 2400, 0.02);
    },
    dispose: () => { noise.dispose(); band.dispose(); out.dispose(); },
  };
}

/**
 * 909-style hi-hat: two high-passed noise voices (closed + open) with a choke.
 * Exposes `.trigger(time, open)` and `.stop(time)` so it drops into rack's hat
 * slot exactly like the sample-backed pair.
 */
export function createHatVoice(cfg = {}) {
  const out = new Tone.Gain(1);
  const hp = new Tone.Filter({ type: 'highpass', frequency: 7000, Q: 0.8 }).connect(out);
  const mk = (decay) => new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay, sustain: 0, release: 0.01 },
  }).connect(hp);
  const closed = mk(cfg.closedDecay ?? 0.03);
  const open = mk(cfg.openDecay ?? 0.3);
  return {
    outputNode: out,
    trigger: (time, isOpen) => {
      closed.triggerRelease(time);
      open.triggerRelease(time);
      (isOpen ? open : closed).triggerAttackRelease(isOpen ? '8n' : '32n', time);
    },
    stop: (time) => { closed.triggerRelease(time); open.triggerRelease(time); },
    set: (key, v) => {
      if (key === 'decay') open.envelope.decay = 0.1 + clamp01(v) * 0.5;
      if (key === 'tone') hp.frequency.rampTo(5000 + clamp01(v) * 6000, 0.02);
    },
    dispose: () => { closed.dispose(); open.dispose(); hp.dispose(); out.dispose(); },
  };
}

/**
 * Synthesized breakbeat: no sample to slice, so instead each of the 16 slice
 * indices maps to a small kick/snare/hat combo — a classic amen-style hit
 * layout (kick-hat / hat / snare / hat / kick / hat / snare-hat / hat / ...).
 * `triggerSlice(time, idx)` mirrors the sample-Player's slice interface
 * (see rack.js), so re-chopping (`ch.break.slices`) glitches the pattern the
 * same way in both modes. Built from `createKickVoice` — one less voice to
 * duplicate, and it keeps the same tune/decay controls.
 */
const AMEN_SLICE_PATTERN = [
  ['kick', 'hat'], ['hat'],          ['snare'],        ['hat'],
  ['kick'],        ['hat'],          ['snare', 'hat'], ['hat'],
  ['kick', 'snare'], ['hat'],        ['snare'],        ['kick', 'hat'],
  ['kick'],        ['hat'],          ['snare'],        ['hat'],
];

export function createBreakVoice(cfg = {}) {
  const out = new Tone.Gain(1);
  const kick = createKickVoice({ decay: cfg.kickDecay ?? 0.18, tune: cfg.tune ?? 45 });
  kick.outputNode.connect(out);

  const snareBand = new Tone.Filter({ type: 'bandpass', frequency: 1800, Q: 1 }).connect(out);
  const snare = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: cfg.snareDecay ?? 0.09, sustain: 0, release: 0.02 },
  }).connect(snareBand);

  const hatHp = new Tone.Filter({ type: 'highpass', frequency: 8000 }).connect(out);
  const hat = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.02, sustain: 0, release: 0.01 },
  }).connect(hatHp);

  return {
    outputNode: out,
    triggerSlice(time, idx) {
      const hits = AMEN_SLICE_PATTERN[((idx % 16) + 16) % 16];
      if (hits.includes('kick')) kick.start(time);
      if (hits.includes('snare')) snare.triggerAttackRelease('16n', time);
      if (hits.includes('hat')) hat.triggerAttackRelease('32n', time);
    },
    set: (key, v) => { if (key === 'tune' || key === 'decay') kick.set(key === 'tune' ? 'pitch' : 'decay', v); },
    dispose: () => { kick.dispose(); snare.dispose(); snareBand.dispose(); hat.dispose(); hatHp.dispose(); out.dispose(); },
  };
}
