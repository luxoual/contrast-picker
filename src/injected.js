// Functions injected into the page with chrome.scripting.executeScript({ func }).
// Chrome serializes each function's source, so every function here must be fully
// self-contained: no imports, no references to module-level names.

/** Remove a leftover result toast so it doesn't end up in the next screenshot. */
export function clearPickerUi() {
  const toast = document.getElementById('__contrast-picker-toast');
  if (!toast) return true;
  toast.remove();
  // Wait for a repaint so captureVisibleTab doesn't see the toast.
  return new Promise((resolve) => {
    const done = () => resolve(true);
    requestAnimationFrame(() => requestAnimationFrame(done));
    setTimeout(done, 150);
  });
}

/**
 * Show a frozen screenshot of the viewport with a magnifier; resolve with the
 * clicked pixel's hex color, or null if cancelled (Esc).
 */
export function runPicker(dataUrl, slot) {
  const HOST_ID = '__contrast-picker-overlay';
  if (document.getElementById(HOST_ID)) return null;

  return new Promise((resolve) => {
    const img = new Image();
    img.onerror = () => resolve(null);
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      // Screenshot is in device pixels; pointer events are in CSS pixels.
      const sx = w / window.innerWidth;
      const sy = h / window.innerHeight;

      const GRID = 11; // pixels shown across the loupe (odd, so there is a center pixel)
      const CELL = 11; // on-screen size of each magnified pixel
      const SIZE = GRID * CELL;
      const label = slot === 'fg' ? 'foreground' : 'background';

      const host = document.createElement('div');
      host.id = HOST_ID;
      host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;';
      const root = host.attachShadow({ mode: 'closed' });
      root.innerHTML = `
        <style>
          * { box-sizing: border-box; }
          .surface { position: fixed; inset: 0; cursor: crosshair; }
          .shot { position: absolute; inset: 0; width: 100%; height: 100%; display: block; user-select: none; -webkit-user-drag: none; }
          .hint {
            position: fixed; top: 12px; left: 50%; transform: translateX(-50%);
            font: 500 13px/1.3 system-ui, -apple-system, sans-serif; color: #fff;
            background: rgba(20,20,20,.88); padding: 8px 14px; border-radius: 999px;
            pointer-events: none; box-shadow: 0 4px 16px rgba(0,0,0,.3);
          }
          .hint b { font-weight: 700; }
          .loupe {
            position: fixed; left: 0; top: 0; pointer-events: none; display: none;
            background: #111; border-radius: 10px; padding: 4px;
            box-shadow: 0 6px 24px rgba(0,0,0,.45), 0 0 0 1px rgba(255,255,255,.25);
          }
          .loupe canvas { display: block; border-radius: 6px; image-rendering: pixelated; }
          .label {
            display: flex; align-items: center; gap: 6px; padding: 5px 4px 1px;
            font: 600 12px/1 ui-monospace, SFMono-Regular, Menlo, monospace; color: #fff;
          }
          .sw { width: 14px; height: 14px; border-radius: 3px; box-shadow: 0 0 0 1px rgba(255,255,255,.5); }
        </style>
        <div class="surface">
          <img class="shot" alt="" draggable="false">
          <div class="hint">Click to pick <b>${label}</b> · Esc to cancel</div>
          <div class="loupe"><canvas width="${SIZE}" height="${SIZE}"></canvas>
            <div class="label"><span class="sw"></span><span class="hex"></span></div></div>
        </div>`;
      const surface = root.querySelector('.surface');
      const loupe = root.querySelector('.loupe');
      const lctx = root.querySelector('canvas').getContext('2d');
      const swatch = root.querySelector('.sw');
      const hexEl = root.querySelector('.hex');
      root.querySelector('.shot').src = dataUrl;
      (document.body || document.documentElement).appendChild(host);

      let current = null;

      const sample = (clientX, clientY) => {
        const px = Math.min(w - 1, Math.max(0, Math.floor(clientX * sx)));
        const py = Math.min(h - 1, Math.max(0, Math.floor(clientY * sy)));
        const [r, g, b] = ctx.getImageData(px, py, 1, 1).data;
        const hex = '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
        return { px, py, hex };
      };

      const drawLoupe = ({ px, py, hex }, clientX, clientY) => {
        const half = (GRID - 1) / 2;
        lctx.imageSmoothingEnabled = false;
        lctx.fillStyle = '#000';
        lctx.fillRect(0, 0, SIZE, SIZE);
        lctx.drawImage(canvas, px - half, py - half, GRID, GRID, 0, 0, SIZE, SIZE);
        // faint pixel grid
        lctx.strokeStyle = 'rgba(128,128,128,.25)';
        lctx.lineWidth = 1;
        for (let i = 1; i < GRID; i++) {
          lctx.beginPath(); lctx.moveTo(i * CELL + 0.5, 0); lctx.lineTo(i * CELL + 0.5, SIZE); lctx.stroke();
          lctx.beginPath(); lctx.moveTo(0, i * CELL + 0.5); lctx.lineTo(SIZE, i * CELL + 0.5); lctx.stroke();
        }
        // highlight the sampled pixel
        lctx.strokeStyle = '#000';
        lctx.lineWidth = 3;
        lctx.strokeRect(half * CELL, half * CELL, CELL, CELL);
        lctx.strokeStyle = '#fff';
        lctx.lineWidth = 1.5;
        lctx.strokeRect(half * CELL, half * CELL, CELL, CELL);
        swatch.style.background = hex;
        hexEl.textContent = hex.toUpperCase();

        // keep the loupe on screen, flipping to the other side of the cursor near edges
        const lw = loupe.offsetWidth || SIZE + 8;
        const lh = loupe.offsetHeight || SIZE + 30;
        const gap = 18;
        let x = clientX + gap;
        let y = clientY + gap;
        if (x + lw > window.innerWidth) x = clientX - gap - lw;
        if (y + lh > window.innerHeight) y = clientY - gap - lh;
        loupe.style.transform = `translate(${Math.max(0, x)}px, ${Math.max(0, y)}px)`;
      };

      const onMove = (e) => {
        current = sample(e.clientX, e.clientY);
        loupe.style.display = 'block';
        drawLoupe(current, e.clientX, e.clientY);
      };
      const onClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        finish(sample(e.clientX, e.clientY).hex);
      };
      const onKey = (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (e.key === 'Escape') finish(null);
        else if (e.key === 'Enter' && current) finish(current.hex);
      };
      const blockScroll = (e) => e.preventDefault();

      const finish = (hex) => {
        surface.removeEventListener('pointermove', onMove);
        surface.removeEventListener('click', onClick, true);
        surface.removeEventListener('wheel', blockScroll);
        window.removeEventListener('keydown', onKey, true);
        host.remove();
        resolve(hex);
      };

      surface.addEventListener('pointermove', onMove);
      surface.addEventListener('click', onClick, true);
      surface.addEventListener('wheel', blockScroll, { passive: false });
      window.addEventListener('keydown', onKey, true);
    };
    img.src = dataUrl;
  });
}

/** Small in-page toast summarizing the current pair. */
export function showToast(info) {
  const HOST_ID = '__contrast-picker-toast';
  document.getElementById(HOST_ID)?.remove();
  const { slot, fg, bg, ratio, results } = info;

  const host = document.createElement('div');
  host.id = HOST_ID;
  host.style.cssText = 'all:initial;position:fixed;right:16px;bottom:16px;z-index:2147483647;';
  const root = host.attachShadow({ mode: 'closed' });
  const badges = results
    .map((r) => `<span class="b ${r.pass ? 'pass' : 'fail'}">${r.pass ? '✓' : '✗'} ${r.short}</span>`)
    .join('');
  const chip = (name, hex, active) =>
    `<span class="chip${active ? ' active' : ''}"><span class="sw" style="background:${hex}"></span>${name} ${hex.toUpperCase()}</span>`;
  root.innerHTML = `
    <style>
      .toast {
        display: flex; gap: 12px; align-items: stretch; max-width: 360px;
        font: 13px/1.35 system-ui, -apple-system, sans-serif; color: #f4f4f5;
        background: rgba(24,24,27,.96); border-radius: 12px; padding: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,.35), 0 0 0 1px rgba(255,255,255,.08);
        cursor: pointer; animation: in .18s ease-out;
      }
      @keyframes in { from { opacity: 0; transform: translateY(8px); } }
      .preview {
        flex: none; width: 64px; border-radius: 8px; display: grid; place-items: center;
        font: 700 26px/1 system-ui, sans-serif; box-shadow: inset 0 0 0 1px rgba(255,255,255,.15);
      }
      .ratio { font: 700 22px/1.1 system-ui, sans-serif; letter-spacing: -.01em; }
      .chips { display: flex; flex-wrap: wrap; gap: 4px 10px; margin: 4px 0 8px; color: #a1a1aa;
               font: 12px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; }
      .chip { display: inline-flex; align-items: center; gap: 5px; }
      .chip.active { color: #fafafa; }
      .sw { width: 11px; height: 11px; border-radius: 3px; box-shadow: 0 0 0 1px rgba(255,255,255,.4); }
      .badges { display: flex; flex-wrap: wrap; gap: 4px; }
      .b { font-size: 11px; font-weight: 600; padding: 2px 7px; border-radius: 999px; }
      .pass { background: #14532d; color: #bbf7d0; }
      .fail { background: #7f1d1d; color: #fecaca; }
    </style>
    <div class="toast" role="status" title="Click to dismiss">
      <div class="preview" style="color:${fg};background:${bg}">Aa</div>
      <div>
        <div class="ratio">${ratio}</div>
        <div class="chips">${chip('FG', fg, slot === 'fg')}${chip('BG', bg, slot === 'bg')}</div>
        <div class="badges">${badges}</div>
      </div>
    </div>`;
  root.querySelector('.toast').addEventListener('click', () => host.remove());
  (document.body || document.documentElement).appendChild(host);
  setTimeout(() => host.remove(), 8000);
  return true;
}
