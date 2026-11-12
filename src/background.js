import { evaluate, formatRatio, normalizeHex } from './contrast.js';
import { clearPickerUi, runPicker, showToast } from './injected.js';
import { getColors, setColors } from './storage.js';

const COMMAND_SLOTS = { 'pick-foreground': 'fg', 'pick-background': 'bg' };

async function pick(slot, tab) {
  if (!tab?.id) [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) return;
  const target = { tabId: tab.id };

  // If the popup is open it holds focus, and the first click on the page would only
  // dismiss it. Ask it to close itself; this rejects when no popup is open, which is fine.
  await chrome.runtime.sendMessage({ type: 'close-popup' }).catch(() => {});

  // Fails on pages extensions can't touch (chrome://, Web Store, PDF viewer, etc.).
  await chrome.scripting.executeScript({ target, func: clearPickerUi });
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
  const [{ result } = {}] = await chrome.scripting.executeScript({
    target,
    func: runPicker,
    args: [dataUrl, slot],
  });
  const hex = normalizeHex(result);
  if (!hex) return; // cancelled

  const colors = { ...(await getColors()), [slot]: hex };
  await setColors(colors);

  const { ratio, results } = evaluate(colors.fg, colors.bg);
  await chrome.scripting.executeScript({
    target,
    func: showToast,
    args: [{
      slot,
      fg: colors.fg,
      bg: colors.bg,
      ratio: formatRatio(ratio),
      results: results.map(({ short, pass }) => ({ short, pass })),
    }],
  });
}

function run(slot, tab) {
  pick(slot, tab).catch((err) => console.warn('[Contrast Picker]', err?.message ?? err));
}

chrome.commands.onCommand.addListener((command, tab) => {
  const slot = COMMAND_SLOTS[command];
  if (slot) run(slot, tab);
});

// "Pick" buttons in the popup.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'pick' && (msg.slot === 'fg' || msg.slot === 'bg')) {
    sendResponse({ ok: true });
    run(msg.slot);
  }
});
