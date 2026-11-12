import { evaluate, formatRatio, normalizeHex } from '../contrast.js';
import { getColors, setColors } from '../storage.js';

const $ = (sel) => document.querySelector(sel);
const slotEl = (slot) => document.querySelector(`.color[data-slot="${slot}"]`);

let colors = await getColors();

function render() {
  for (const slot of ['fg', 'bg']) {
    const el = slotEl(slot);
    el.querySelector('input[type="color"]').value = colors[slot];
    const hexInput = el.querySelector('input.hex');
    if (document.activeElement !== hexInput) {
      hexInput.value = colors[slot].toUpperCase();
      hexInput.removeAttribute('aria-invalid');
    }
  }

  const preview = $('#preview');
  preview.style.color = colors.fg;
  preview.style.background = colors.bg;

  const { ratio, results } = evaluate(colors.fg, colors.bg);
  $('#ratio').textContent = formatRatio(ratio);
  $('#criteria').replaceChildren(
    ...results.map((r) => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${r.label} <span class="sc">${r.min}:1 · SC ${r.sc}</span></span>`;
      const badge = document.createElement('span');
      badge.className = `badge ${r.pass ? 'pass' : 'fail'}`;
      badge.textContent = r.pass ? 'Pass' : 'Fail';
      li.append(badge);
      return li;
    }),
  );
}

function update(slot, hex) {
  colors = { ...colors, [slot]: hex };
  setColors(colors);
  render();
}

for (const slot of ['fg', 'bg']) {
  const el = slotEl(slot);
  el.querySelector('input[type="color"]').addEventListener('input', (e) => update(slot, e.target.value));

  const hexInput = el.querySelector('input.hex');
  hexInput.addEventListener('input', () => {
    const hex = normalizeHex(hexInput.value);
    hexInput.setAttribute('aria-invalid', String(!hex));
    if (hex) update(slot, hex);
  });
  hexInput.addEventListener('blur', render);

  el.querySelector('.pick').addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'pick', slot });
    window.close();
  });
}

$('#swap').addEventListener('click', () => {
  colors = { fg: colors.bg, bg: colors.fg };
  setColors(colors);
  render();
});

$('#shortcuts').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.colors?.newValue) {
    colors = { ...colors, ...changes.colors.newValue };
    render();
  }
});

render();

const commands = await chrome.commands.getAll();
for (const [name, slot] of [['pick-foreground', 'fg'], ['pick-background', 'bg']]) {
  const shortcut = commands.find((c) => c.name === name)?.shortcut;
  const kbd = slotEl(slot).querySelector('.shortcut');
  kbd.textContent = shortcut || 'No shortcut set';
}
$('#open-shortcut').textContent =
  commands.find((c) => c.name === '_execute_action')?.shortcut || 'Not set';
