/**
 * UNIT SEQUENCER — clap distortion pedal (Module 1.3)
 *
 * Adjustable stompbox for the Clap track:
 *
 *   clap voice → Tone.Distortion (4x oversample) → tone LPF → output trim → channel
 *
 * Design constraints:
 *  - Drive changes CHARACTER, not loudness: the output trim compensates gain so
 *    A/B at any drive setting is level-matched (±2 dB). Without this, taste
 *    profiling (Module 2) would just learn "louder = preferred".
 *  - 4x oversampling on the waveshaper keeps aliasing out of the 8–12 kHz band
 *    where the 909 clap lives.
 */
import * as Tone from 'tone';

/** Perceptual knob curve: linear knob → exponential drive feel. */
function knobToDrive(value01) {
  const v = Math.min(1, Math.max(0, value01));
  return v * v * 0.9 + v * 0.1; // gentle start, aggressive top end
}

/** Loudness compensation, tuned by ear against the 909 clap sample. */
function driveToTrimDb(drive) {
  return -9 * drive; // full drive adds ~9 dB RMS; pull it back out
}

export function createClapDistortion() {
  const distortion = new Tone.Distortion({
    distortion: 0,      // 0..1 drive
    oversample: '4x',   // anti-aliasing on the waveshaper
    wet: 1,             // dry/wet handled here, not by bypassing the node
  });

  const toneFilter = new Tone.Filter({
    type: 'lowpass',
    frequency: 9000,    // "tone" knob: 2k (dark) .. 16k (open)
    rolloff: -12,
  });

  const trim = new Tone.Gain(1);

  const pedal = {
    /** insert chain for engine.registerTrack('clap', voice, pedal.inserts) */
    inserts: [distortion, toneFilter, trim],

    /** UI knob 0..1. Mirror into sequencerState.fx.clapDistortion. */
    setDrive(value01) {
      const drive = knobToDrive(value01);
      distortion.distortion = drive;
      trim.gain.rampTo(Tone.dbToGain(driveToTrimDb(drive)), 0.02);
    },

    /** UI knob 0..1 → tone filter 2 kHz..16 kHz (log sweep). */
    setTone(value01) {
      const v = Math.min(1, Math.max(0, value01));
      toneFilter.frequency.rampTo(2000 * Math.pow(8, v), 0.02);
    },

    /** Dry/wet 0..1 (0 = clean clap through the same chain). */
    setMix(value01) {
      distortion.wet.rampTo(Math.min(1, Math.max(0, value01)), 0.02);
    },

    dispose() {
      distortion.dispose();
      toneFilter.dispose();
      trim.dispose();
    },
  };

  return pedal;
}
