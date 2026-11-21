const HOME_TITLE_FONT_WAIT_MS = 300;
let homeTitleFont: Promise<boolean> | undefined;

async function loadHomeTitleFont() {
  if (!document.fonts) return false;

  const loadedFont = document.fonts.load('400 1em "Pretendard Home Title"').then(
    (fonts) => fonts.length > 0,
    () => false
  );
  let timeoutId: number | undefined;
  const deadline = new Promise<boolean>((resolve) => {
    timeoutId = window.setTimeout(() => resolve(false), HOME_TITLE_FONT_WAIT_MS);
  });

  const fontReady = await Promise.race([loadedFont, deadline]);
  window.clearTimeout(timeoutId);
  return fontReady;
}

export function prepareHomeTitleFont() {
  homeTitleFont ??= loadHomeTitleFont();
  return homeTitleFont;
}
