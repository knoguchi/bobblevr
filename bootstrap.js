(async () => {
  const ds = document.documentElement.dataset;
  const overlayUrl = ds.bvrOverlayUrl;
  if (!overlayUrl) return;
  if (window.__bvrMainLoaded) return;
  window.__bvrMainLoaded = true;
  try {
    await import(overlayUrl);
  } catch (err) {
    console.error('[BobbleVR] overlay import failed:', err);
  }
})();
