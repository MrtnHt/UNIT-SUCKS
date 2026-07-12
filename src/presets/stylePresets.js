/**
 * UNIT — curated style presets (8). Hand-programmed, not random: each is a
 * working, club-ready starter pattern. Break channel is INACTIVE everywhere
 * except JUNGLE/BREAKCORE (beginner safety).
 *
 * Pattern shorthand: 16-step arrays, 1 = hit. `open` marks open-hat steps.
 * `slices` remaps break steps to slice indices (identity = straight loop).
 */

const K4 = [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0]; // 4-on-floor
const OFF = [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0]; // offbeat
const NONE = Array(16).fill(0);
const ALL = Array(16).fill(1);
const IDENT = [...Array(16).keys()];

export const PRESETS = {
  'pilot-175': {
    name: 'PILOT-175', bpm: 175,
    channels: {
      kick:  { active: true,  steps: K4 },
      clap:  { active: true,  steps: [0,0,0,0,1,0,0,0, 0,0,0,0,1,0,0,0],
               fx: { distortion: { drive: 0.25, tone: 0.7, mix: 1 } } },
      hat:   { active: true,  steps: OFF, open: NONE },
      acid:  { active: false, steps: [1,0,0,1,0,1,0,0, 1,0,0,1,0,0,1,0] },
      break: { active: false, steps: ALL, slices: IDENT },
    },
  },
  'hardcore-195': {
    name: 'HARDCORE-195', bpm: 195,
    channels: {
      kick:  { active: true,  steps: K4, fx: { distortion: { drive: 0.8, tone: 0.6, mix: 1 } } },
      clap:  { active: true,  steps: [0,0,1,0,0,0,1,0, 0,0,1,0,0,0,1,1], fx: { distortion: { drive: 0.7, tone: 0.7, mix: 1 } } },
      hat:   { active: true,  steps: OFF, open: NONE },
      acid:  { active: false, steps: [0,0,0,0,0,1,0,0, 0,0,0,1,0,0,0,0] },
      break: { active: false, steps: ALL, slices: IDENT },
    },
  },
  'acid-175': {
    name: 'ACID HYPNOSIS-175', bpm: 175,
    channels: {
      kick:  { active: true,  steps: K4 },
      clap:  { active: true,  steps: [0,0,1,0,0,0,0,0, 0,0,1,0,0,0,0,0] },
      hat:   { active: true,  steps: [0,1,0,1,0,1,0,1, 0,1,0,1,0,1,0,1], open: NONE },
      acid:  { active: true,  steps: [1,0,0,1,0,1,0,0, 1,0,0,1,0,0,1,0],
               fx: { delay: { time: '8n', feedback: 0.35, wet: 0.3 } } },
      break: { active: false, steps: ALL, slices: IDENT },
    },
  },
  'rave-165': {
    name: 'EARLY RAVE-165', bpm: 165,
    channels: {
      kick:  { active: true,  steps: [1,0,1,0,1,0,1,0, 1,0,1,0,1,0,1,0] },
      clap:  { active: true,  steps: OFF, fx: { reverb: { decay: 1.8, preDelay: 0.01, wet: 0.25 } } },
      hat:   { active: true,  steps: ALL, open: [0,0,0,0,0,0,0,1, 0,0,0,0,0,0,0,1] },
      acid:  { active: false, steps: NONE },
      break: { active: false, steps: ALL, slices: IDENT },
    },
  },
  'gabber-200': {
    name: 'MENTAL GABBER-200', bpm: 200,
    channels: {
      kick:  { active: true,  steps: ALL, fx: { distortion: { drive: 0.95, tone: 0.55, mix: 1 } } },
      clap:  { active: true,  steps: [0,0,1,1,0,0,1,1, 0,0,1,1,0,0,1,1], fx: { distortion: { drive: 0.9, tone: 0.7, mix: 1 } } },
      hat:   { active: true,  steps: OFF, open: NONE },
      acid:  { active: true,  steps: [1,0,0,0,1,0,0,1, 0,1,0,0,0,0,1,0] },
      break: { active: false, steps: ALL, slices: IDENT },
    },
  },
  'hypno-130': {
    name: 'HYPNOTIC ACID-130', bpm: 130,
    channels: {
      kick:  { active: true,  steps: K4 },
      clap:  { active: true,  steps: [0,0,0,0,0,0,1,0, 0,0,0,0,0,0,1,0], fx: { reverb: { decay: 3.5, preDelay: 0.02, wet: 0.4 } } },
      hat:   { active: true,  steps: [0,0,1,0,0,0,1,0, 0,0,1,0,0,0,1,0], open: NONE },
      acid:  { active: true,  steps: [1,0,0,0,1,0,0,1, 1,0,1,0,0,1,0,1],
               fx: { delay: { time: '8t', feedback: 0.5, wet: 0.45 } } },
      break: { active: false, steps: ALL, slices: IDENT },
    },
  },
  'jungle-172': {
    name: 'JUNGLE-172', bpm: 172,
    channels: {
      kick:  { active: true,  steps: [1,0,0,0,0,0,0,0, 0,0,1,0,0,0,0,0] }, // sparse sub-kick
      clap:  { active: false, steps: NONE },
      hat:   { active: false, steps: NONE, open: NONE },
      acid:  { active: false, steps: NONE },
      break: { active: true,  steps: ALL,
               // classic re-chop: straight run, doubled snare slice, backspin feel at the turn
               slices: [0,1,2,3, 4,5,6,4, 8,9,10,11, 6,6,14,15],
               fx: { filter: { type: 'highpass', frequency: 60, Q: 0.7 } } },
    },
  },
  'breakcore-200': {
    name: 'BREAKCORE-200', bpm: 200,
    channels: {
      kick:  { active: true,  steps: [1,0,0,1,0,0,1,0, 1,0,0,1,0,0,1,1], fx: { distortion: { drive: 0.9, tone: 0.6, mix: 1 } } },
      clap:  { active: false, steps: NONE },
      hat:   { active: false, steps: NONE, open: NONE },
      acid:  { active: true,  steps: [0,0,0,0,0,0,0,1, 0,0,0,0,0,1,0,0] },
      break: { active: true,  steps: ALL,
               // stutter chops: repeated micro-slices, snare rushes
               slices: [0,0,2,2, 4,4,4,4, 8,6,6,6, 12,13,6,6],
               fx: { distortion: { drive: 0.5, tone: 0.8, mix: 1 } } },
    },
  },
};

export function loadPreset(id) {
  const p = PRESETS[id];
  if (!p) throw new Error(`unknown preset: ${id}`);
  // deep clone so live edits never mutate the preset library
  return structuredClone(p);
}

export const PRESET_IDS = Object.keys(PRESETS);
