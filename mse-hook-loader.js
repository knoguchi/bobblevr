(() => {
  try {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('mse-hook.js');
    script.onload = () => script.remove();
    (document.head || document.documentElement).prepend(script);
  } catch (e) {
    console.error('[BobbleVR] mse-hook load error:', e);
  }
})();
