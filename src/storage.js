export const DEFAULT_COLORS = { fg: '#000000', bg: '#ffffff' };

export async function getColors() {
  const { colors } = await chrome.storage.local.get('colors');
  return { ...DEFAULT_COLORS, ...colors };
}

export function setColors(colors) {
  return chrome.storage.local.set({ colors: { fg: colors.fg, bg: colors.bg } });
}
