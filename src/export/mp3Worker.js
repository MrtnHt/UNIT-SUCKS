/**
 * UNIT SEQUENCER — MP3 encode worker (Module 3, client side)
 *
 * Module worker invoked by renderLoop.js's `encodeMp3InWorker()`. Keeps
 * lamejs off the UI thread. Receives the rendered AudioBuffer's raw channel
 * data, encodes to MP3, and posts the result back as a transferable
 * ArrayBuffer.
 *
 * postMessage in:  { sampleRate, channels: Float32Array[], kbps }
 * postMessage out: ArrayBuffer (MP3 bytes), transferred
 */
import { Mp3Encoder } from 'lamejs';

const SAMPLES_PER_FRAME = 1152; // lamejs encode block size

function floatTo16BitPCM(float32) {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const clamped = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  return int16;
}

self.onmessage = (e) => {
  const { sampleRate, channels, kbps } = e.data;
  const numChannels = channels.length;
  const encoder = new Mp3Encoder(numChannels, sampleRate, kbps);

  const pcm = channels.map((ch) => floatTo16BitPCM(ch));
  const length = pcm[0]?.length ?? 0;
  const chunks = [];

  for (let i = 0; i < length; i += SAMPLES_PER_FRAME) {
    const left = pcm[0].subarray(i, i + SAMPLES_PER_FRAME);
    const right = numChannels > 1 ? pcm[1].subarray(i, i + SAMPLES_PER_FRAME) : undefined;
    const mp3buf = numChannels > 1
      ? encoder.encodeBuffer(left, right)
      : encoder.encodeBuffer(left);
    if (mp3buf.length > 0) chunks.push(mp3buf);
  }

  const tail = encoder.flush();
  if (tail.length > 0) chunks.push(tail);

  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  self.postMessage(merged.buffer, [merged.buffer]);
};
