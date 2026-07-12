/**
 * UNIT — clap distortion pedal.
 * Kept as a thin alias of the generic distortion pedal (distortion.js) so the
 * original Module 1.3 docs/imports still resolve. New code should import
 * createDistortion directly.
 */
export { createDistortion as createClapDistortion } from './distortion.js';
