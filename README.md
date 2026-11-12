# Contrast Picker

A Chrome extension for checking WCAG contrast between two colors picked from any page.
Press one hotkey to pick the foreground (color A), another to pick the background (color B),
and you get the contrast ratio with pass/fail results for each WCAG threshold.

## Hotkeys

| Action | macOS | Windows / Linux / ChromeOS |
| --- | --- | --- |
| Pick foreground (A) | `⌘ Shift 1` | `Alt Shift 1` |
| Pick background (B) | `⌘ Shift 2` | `Alt Shift 2` |
| Open the popup | `⌘ Shift 0` | `Alt Shift 0` |

When you press one, the page freezes and a magnifier follows the cursor.
**Click** (or press **Enter**) to pick the pixel. **Esc** cancels.
A toast in the bottom-right corner shows the ratio and results. The toolbar popup has the
full breakdown, a live preview, hex inputs, a swap button, and **Pick** buttons.

You can change the shortcuts at `chrome://extensions/shortcuts`. If another extension
already uses a key, Chrome won't assign it and the popup shows "No shortcut set".

## WCAG checks

The ratio is `(L1 + 0.05) / (L2 + 0.05)` using WCAG 2.2 relative luminance.

| Criterion | Minimum |
| --- | --- |
| AA, normal text (SC 1.4.3) | 4.5:1 |
| AA, large text (SC 1.4.3), meaning 24px+, or 18.66px+ bold | 3:1 |
| AAA, normal text (SC 1.4.6) | 7:1 |
| AAA, large text (SC 1.4.6) | 4.5:1 |
| AA, UI components and graphics (SC 1.4.11) | 3:1 |

The ratio is never rounded up before it's compared or shown, so 4.499:1 shows as 4.49:1 and fails AA.

## Install (unpacked)

1. Go to `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick this folder.

## How it works

- `chrome.commands` → service worker (`src/background.js`)
- `chrome.tabs.captureVisibleTab` takes a screenshot of the viewport. This uses `activeTab`,
  which the hotkey grants, so the extension doesn't need host permissions.
- `chrome.scripting.executeScript` adds an overlay (`src/injected.js`) that shows the screenshot
  and reads the clicked pixel from a canvas.
- Colors are saved in `chrome.storage.local`.

Picking won't work on pages that Chrome blocks extensions from scripting, such as
`chrome://` pages, the Chrome Web Store, and the built-in PDF viewer.

## Development

```sh
npm test      # unit tests for the contrast math (Node 18+)
npm run zip   # package for the Chrome Web Store
```
