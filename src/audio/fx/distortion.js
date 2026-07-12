/**
 * UNIT — distortion pedal (generic, per-track).
 * voice → Distortion(4x) → tone LPF → trim → channel
 * Loudness-compensated: drive changes character, not volume.
 */
import * as Tone from 'tone';

const knobToDrive = (v) => { v = Math.min(1, Math.max(0, v)); return v * v * 0.9 + v * 0.1; };
const driveToTrimDb = (drive) => -9 * drive;

export function createDistortion({ drive = 0, tone = 0.7, mix = 1 } = {}) {
  const dist = new Tone.Distortion({ distortion: 0, oversample: '4x', wet: mix });
  const toneFilter = new Tone.Filter({ type: 'lowpass', frequency: 9000, rolloff: -12 });
  const trim = new Tone.Gain(1);

  const pedal = {
    id: 'distortion',
    inserts: [dist, toneFilter, trim],
    setDrive(v) {
      const d = knobToDrive(v);
      dist.distortion = d;
      trim.gain.rampTo(Tone.dbToGain(driveToTrimDb(d)), 0.02);
    },
    setTone(v) { toneFilter.frequency.rampTo(2000 * Math.pow(8, Math.min(1, Math.max(0, v))), 0.02); },
    setMix(v) { dist.wet.rampTo(Math.min(1, Math.max(0, v)), 0.02); },
    dispose() { [dist, toneFilter, trim].forEach((n) => n.dispose()); },
  };
  pedal.setDrive(drive);
  pedal.setTone(tone);
  return pedal;
}
