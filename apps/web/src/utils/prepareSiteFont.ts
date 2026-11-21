const FONT_WAIT_LIMIT_MS = 1200;

export async function prepareSiteFont() {
  if (!document.fonts) return;

  const loadedFont = document.fonts.load('400 1em "Pretendard Variable"').then(
    (fonts) => fonts.length > 0,
    () => false
  );
  let timeoutId: number | undefined;
  const deadline = new Promise<boolean>((resolve) => {
    timeoutId = window.setTimeout(() => resolve(false), FONT_WAIT_LIMIT_MS);
  });

  const fontReady = await Promise.race([loadedFont, deadline]);
  window.clearTimeout(timeoutId);
  if (fontReady) document.documentElement.classList.add("site-font-ready");
}
