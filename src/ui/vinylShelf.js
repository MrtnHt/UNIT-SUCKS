/**
 * UNIT STUDIO — vinyl shelf "PRESSED ON WAX" (spec §B).
 * Permanently visible; 4 data tiers render identically; empty state
 * unreachable. Previews duck the loop via previewPlayer.
 */
import { getShelfRecords } from '../shop/shelfStore.js';
import { createTasteReporter, buildPayload, classify } from '../integration/tasteProfile.js';
import { playPreview, stopPreview } from '../audio/previewPlayer.js';

let currentPreviewId = null;

export function mountShelf(el, app) {
  el.innerHTML = `
    <div style="display:flex;align-items:center;height:20px;padding:0 8px;gap:8px">
      <span class="label" style="color:var(--cyan)">PRESSED ON WAX</span>
      <span class="label" id="shelf-badge" style="color:var(--paper-2)"></span>
    </div>
    <div id="shelf-row" style="display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x mandatory;padding:4px 8px"></div>`;

  renderSkeletons(el.querySelector('#shelf-row'));
  refresh(el, app);

  // taste reporter: refresh shelf on every classified change; errors degrade tiers
  const reporter = createTasteReporter({
    onProducts: (data) => data?.products?.length >= 2
      ? renderRecords(el, data.products, 'MATCHED TO YOUR LOOP')
      : refresh(el, app),
    onError: () => refresh(el, app),
  });
  document.addEventListener('sequencer:step', throttle(() => reporter.notify(app.state), 2000));

  // preview UI state
  document.addEventListener('preview:ended', () => {
    currentPreviewId = null;
    el.querySelectorAll('[data-preview]').forEach((b) => { b.textContent = '▶'; });
    el.querySelectorAll('.prog').forEach((p) => p.remove());
  });
}

async function refresh(el, app) {
  const profile = classify(app.state);
  const { tier, records } = await getShelfRecords(profile);
  renderRecords(el, records, tier === 'MATCHED' || tier === 'LAST_GOOD'
    ? 'MATCHED TO YOUR LOOP' : 'FROM THE CRATES');
}

function renderRecords(el, records, badgeText) {
  const badge = el.querySelector('#shelf-badge');
  const row = el.querySelector('#shelf-row');
  if (!badge || !row) return;
  badge.textContent = badgeText;
  badge.style.color = badgeText.startsWith('MATCHED') ? 'var(--cyan)' : 'var(--paper)';

  row.innerHTML = records.map((r, i) => `
    <div class="card" data-id="${r.id}" style="scroll-snap-align:start;flex:0 0 128px;height:136px;position:relative">
      <div style="width:96px;height:96px;border:1px solid var(--line);position:relative;background:var(--ink-2)">
        ${sleeve(r)}
        ${r.previewUrl ? `<button data-preview="${i}" aria-label="preview"
          style="position:absolute;left:0;bottom:0;background:rgba(0,0,0,.7);border:none;box-shadow:none">▶</button>` : ''}
      </div>
      <div style="font-size:var(--t-micro);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.name)}</div>
      <div style="font-size:var(--t-body);color:var(--cyan);font-weight:bold">€${esc(r.price)}</div>
      <button data-cart="${i}" style="width:100%;min-height:32px;background:var(--cyan);color:var(--ink);border:none">+ CRATE</button>
    </div>`).join('');

  row.onclick = async (e) => {
    const t = e.target;
    if (t.dataset.cart != null) {
      const r = records[+t.dataset.cart];
      t.style.background = 'var(--green)';
      setTimeout(() => { t.style.background = 'var(--cyan)'; }, 150);
      window.open(`${r.permalink}${r.permalink.includes('?') ? '&' : '?'}add-to-cart=${r.id}`, '_blank', 'noopener');
      return;
    }
    if (t.dataset.preview != null) {
      const r = records[+t.dataset.preview];
      if (currentPreviewId === r.id) { stopPreview(); currentPreviewId = null; t.textContent = '▶'; return; }
      currentPreviewId = r.id;
      row.querySelectorAll('[data-preview]').forEach((b) => { b.textContent = '▶'; });
      t.textContent = '■';
      const card = t.closest('.card');
      const prog = document.createElement('div');
      prog.className = 'prog';
      prog.style.cssText = 'position:absolute;left:0;bottom:40px;height:2px;background:var(--cyan);width:0%';
      card.appendChild(prog);
      const dur = Math.min(30, r.previewDuration ?? 30);
      prog.animate([{ width: '0%' }, { width: '96px' }], { duration: dur * 1000, easing: 'steps(30)' });
      try { await playPreview(r.previewUrl, { duration: dur }); }
      catch { currentPreviewId = null; t.textContent = '▶'; prog.remove(); }
    }
  };
}

/** Cover with generated-sleeve fallback: black + radiating circles + stamped title. */
function sleeve(r) {
  const fallback = `
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
      background:repeating-radial-gradient(circle at 50% 50%, var(--ink) 0 6px, var(--ink-2) 6px 9px)">
      <span class="label" style="background:var(--ink);padding:2px 4px">${esc(r.name.slice(0, 14))}</span>
    </div>`;
  return r.image
    ? `<img src="${esc(r.image)}" alt="" style="width:100%;height:100%;object-fit:cover"
        onerror="this.outerHTML=this.nextElementSibling?'':''; this.remove()">${fallback.replace('position:absolute', 'position:absolute;z-index:-1')}`
    : fallback;
}

function renderSkeletons(row) {
  row.innerHTML = Array(3).fill(`
    <div class="fx-flicker" style="flex:0 0 128px;height:136px;background:var(--ink-2);border:1px solid var(--line);position:relative">
      <div style="position:absolute;left:8px;top:0;bottom:0;width:1px;background:var(--paper-2);opacity:.3"></div>
    </div>`).join('');
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function throttle(fn, ms) {
  let last = 0;
  return (...a) => { const n = Date.now(); if (n - last > ms) { last = n; fn(...a); } };
}
