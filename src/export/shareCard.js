/**
 * UNIT STUDIO — share-card compositor (spec §C.5).
 * Renders the loop offline, composes a platform-exact PNG on canvas
 * (waveform + BPM/tag stamp + brand mark + BAKED grain/scanlines), then
 * Web Share API with download fallback.
 */
import { renderLoop, audioBufferToWav } from './renderLoop.js';
import { buffers } from '../audio/engine.js';
import { classify } from '../integration/tasteProfile.js';

const FORMATS = {
  ig: { label: 'IG STORY 1080×1920', w: 1080, h: 1920, safe: 250 },
  tiktok: { label: 'TIKTOK 1080×1920', w: 1080, h: 1920, safe: 250 },
  x: { label: 'X 1200×675', w: 1200, h: 675, safe: 64 },
};

export function openShareSheet(app) {
  document.querySelector('.overlay')?.remove();
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `
    <header>
      <span class="stamp fx-fringe" style="color:var(--magenta)">SHARE</span>
      <button class="close" aria-label="close">X</button>
    </header>
    <div style="flex:1;display:flex;flex-direction:column;gap:12px;align-items:center;justify-content:center">
      ${Object.entries(FORMATS).map(([id, f]) => `
        <button data-fmt="${id}" style="width:240px;border-color:var(--magenta)">${f.label}</button>`).join('')}
      <p class="label" id="share-status" style="color:var(--paper-2)"></p>
    </div>`;
  document.body.appendChild(ov);

  ov.querySelector('.close').addEventListener('click', () => ov.remove());
  ov.addEventListener('click', async (e) => {
    const id = e.target.dataset.fmt;
    if (!id) return;
    const status = ov.querySelector('#share-status');
    status.textContent = 'RENDERING…';
    try {
      const buffer = await renderLoop(app.state, buffers, 2);
      const tag = classify(app.state).primaryTag ?? 'tekno';
      const png = await composeCard(buffer, FORMATS[id], app.state.bpm, tag);
      const wav = audioBufferToWav(buffer);
      status.textContent = 'DONE';
      await shareOrDownload(png, wav, `unit-loop-${app.state.bpm}bpm-${tag}`);
      status.style.color = 'var(--green)';
    } catch (err) {
      status.textContent = `FAILED: ${err.message}`.toUpperCase();
    }
  });
}

async function composeCard(audioBuffer, fmt, bpm, tag) {
  const c = document.createElement('canvas');
  c.width = fmt.w; c.height = fmt.h;
  const ctx = c.getContext('2d');
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#00F0FF';

  // 1. base
  ctx.fillStyle = css('--ink'); ctx.fillRect(0, 0, fmt.w, fmt.h);

  // 2. waveform: hard-stepped cyan columns
  const data = audioBuffer.getChannelData(0);
  const cols = 96, colW = fmt.w / cols;
  ctx.fillStyle = css('--cyan');
  const midY = fmt.h / 2, maxH = (fmt.h - fmt.safe * 2) * 0.4;
  for (let i = 0; i < cols; i++) {
    let peak = 0;
    const start = Math.floor(i / cols * data.length), end = Math.floor((i + 1) / cols * data.length);
    for (let j = start; j < end; j += 16) peak = Math.max(peak, Math.abs(data[j]));
    const h = Math.max(4, peak * maxH);
    ctx.fillRect(i * colW + 1, midY - h, colW - 2, h * 2);
  }

  // 3. BPM + tag stamp with chromatic split
  const stamp = `${bpm} BPM · ${tag.toUpperCase()}`;
  const fs = Math.round(fmt.w / 16);
  ctx.font = `bold ${fs}px ui-monospace, monospace`;
  ctx.textAlign = 'center';
  const ty = fmt.safe + fs;
  ctx.fillStyle = css('--fringe-r') || 'rgba(255,43,214,.35)'; ctx.fillText(stamp, fmt.w / 2 - 3, ty);
  ctx.fillStyle = css('--fringe-c') || 'rgba(0,240,255,.35)'; ctx.fillText(stamp, fmt.w / 2 + 3, ty);
  ctx.fillStyle = css('--paper'); ctx.fillText(stamp, fmt.w / 2, ty);

  // 4. brand mark: crate lockup + radiating circles, bottom-right at 8% width
  const bw = fmt.w * 0.08, bx = fmt.w - fmt.safe - bw, by = fmt.h - fmt.safe - bw;
  ctx.strokeStyle = css('--paper'); ctx.lineWidth = 3;
  for (let r = bw * 0.5; r > 4; r -= bw * 0.12) {
    ctx.beginPath(); ctx.arc(bx + bw / 2, by + bw / 2, r, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.fillStyle = css('--ink');
  ctx.fillRect(bx + bw * 0.15, by + bw * 0.35, bw * 0.7, bw * 0.3);
  ctx.fillStyle = css('--paper');
  ctx.font = `bold ${Math.round(bw * 0.24)}px ui-monospace, monospace`;
  ctx.fillText('UNIT', bx + bw / 2, by + bw * 0.58);

  // 5. baked grain (4%) + scanlines every 4px (6%) — survives recompression
  const img = ctx.getImageData(0, 0, fmt.w, fmt.h);
  const px = img.data;
  for (let i = 0; i < px.length; i += 4) {
    const n = (Math.random() - 0.5) * 20; // ±10 ≈ 4% of 255
    px[i] += n; px[i + 1] += n; px[i + 2] += n;
    const y = (i / 4 / fmt.w) | 0;
    if (y % 4 === 0) { px[i] *= 0.94; px[i + 1] *= 0.94; px[i + 2] *= 0.94; }
  }
  ctx.putImageData(img, 0, 0);

  return new Promise((res) => c.toBlob((b) => res(b), 'image/png'));
}

async function shareOrDownload(png, wav, name) {
  const files = [
    new File([png], `${name}.png`, { type: 'image/png' }),
    new File([wav], `${name}.wav`, { type: 'audio/wav' }),
  ];
  if (navigator.canShare?.({ files })) {
    try { await navigator.share({ files, title: name }); return; } catch { /* fall through */ }
  }
  for (const f of files) {
    const url = URL.createObjectURL(f);
    const a = Object.assign(document.createElement('a'), { href: url, download: f.name });
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }
}
