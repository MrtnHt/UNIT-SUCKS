/**
 * UNIT SEQUENCER — offline loop renderer (Module 3, client side)
 *
 * Re-plays the current pattern in a Tone.Offline context and encodes the
 * result as WAV (PCM16) or MP3 (lamejs, 192 kbps). Nothing is uploaded — the
 * server only gates the download with an export token (see exportGateway.js).
 */
import * as Tone from 'tone';

/**
 * Render the pattern to an AudioBuffer.
 *
 * @param {object} state          sequencerState snapshot (bpm, channels, fx)
 * @param {function} buildRack    (transport-scoped) fn that rebuilds voices +
 *                                sequence inside the offline context; reuse the
 *                                same builder as the live engine so live and
 *                                export stay byte-comparable.
 * @param {number} bars           loop length to render
 */
export async function renderLoop(state, buildRack, bars = 2) {
  const secondsPerBar = (60 / state.bpm) * 4;
  const duration = secondsPerBar * bars + 0.5; // + tail for delay/reverb

  return Tone.Offline(({ transport }) => {
    buildRack(state, transport); // must schedule everything on `transport`
    transport.bpm.value = state.bpm;
    transport.start(0);
  }, duration);
}

// ---------------------------------------------------------------------------
// WAV encode — PCM16, interleaved, no dependencies.
// ---------------------------------------------------------------------------

export function audioBufferToWav(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const frames = buffer.length;
  const bytesPerSample = 2;
  const dataSize = frames * numChannels * bytesPerSample;
  const out = new DataView(new ArrayBuffer(44 + dataSize));

  const writeStr = (offset, s) => [...s].forEach((c, i) => out.setUint8(offset + i, c.charCodeAt(0)));
  writeStr(0, 'RIFF');
  out.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  out.setUint32(16, 16, true);
  out.setUint16(20, 1, true); // PCM
  out.setUint16(22, numChannels, true);
  out.setUint32(24, sampleRate, true);
  out.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  out.setUint16(32, numChannels * bytesPerSample, true);
  out.setUint16(34, 16, true);
  writeStr(36, 'data');
  out.setUint32(40, dataSize, true);

  const channels = Array.from({ length: numChannels }, (_, c) => buffer.getChannelData(c));
  let offset = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < numChannels; c++) {
      const clamped = Math.max(-1, Math.min(1, channels[c][i]));
      out.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([out], { type: 'audio/wav' });
}

// ---------------------------------------------------------------------------
// Gate + download orchestration
// ---------------------------------------------------------------------------

/**
 * Full export flow: init (e-mail gate) → render → confirm → download.
 * `getEmailConsent()` opens the modal and resolves
 * { email, consentNewsletter, consentTextVersion } or throws on cancel.
 */
export async function exportFlow({ state, buildRack, tastePayload, getEmailConsent, format = 'wav' }) {
  const consent = await getEmailConsent();

  const initRes = await fetch('/api/export/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...consent, tasteProfile: tastePayload }),
  });
  if (!initRes.ok && initRes.status !== 409) {
    throw new Error(`export gate refused: ${initRes.status}`);
  }
  const { exportToken } = await initRes.json();

  const audioBuffer = await renderLoop(state, buildRack);
  const blob = format === 'mp3'
    ? await encodeMp3InWorker(audioBuffer) // lamejs worker, see docs 3.1 [3]
    : audioBufferToWav(audioBuffer);

  await fetch('/api/export/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ exportToken }),
  });

  const tag = tastePayload?.profile?.primaryTag ?? 'tekno';
  triggerDownload(blob, `unit-loop-${state.bpm}bpm-${tag}.${format}`);
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** MP3 via lamejs in a Web Worker so the UI thread never blocks. */
async function encodeMp3InWorker(audioBuffer) {
  const worker = new Worker(new URL('./mp3Worker.js', import.meta.url), { type: 'module' });
  const channels = Array.from(
    { length: audioBuffer.numberOfChannels },
    (_, c) => audioBuffer.getChannelData(c),
  );
  return new Promise((resolve, reject) => {
    worker.onmessage = (e) => { resolve(new Blob([e.data], { type: 'audio/mpeg' })); worker.terminate(); };
    worker.onerror = (e) => { reject(e); worker.terminate(); };
    worker.postMessage(
      { sampleRate: audioBuffer.sampleRate, channels, kbps: 192 },
      channels.map((c) => c.buffer),
    );
  });
}
