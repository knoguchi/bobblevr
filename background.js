const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const STORAGE_KEY = 'face_landmarker_model_v1';

async function ensureModelCached() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  if (stored[STORAGE_KEY]) return 'cached';

  const response = await fetch(MODEL_URL);
  if (!response.ok) throw new Error('fetch failed: ' + response.status);
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 4096;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  const dataUrl = 'data:application/octet-stream;base64,' + btoa(binary);
  await chrome.storage.local.set({ [STORAGE_KEY]: dataUrl });
  return 'fetched';
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;

  let modelStatus;
  try {
    modelStatus = await ensureModelCached();
  } catch (e) {
    modelStatus = 'error: ' + e.message;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (status) => {
        document.documentElement.dataset.bvrModelStatus = status;
      },
      args: [modelStatus]
    });

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      files: ['bootstrap.js']
    });
  } catch (err) {
    console.error('[BobbleVR] inject failed:', err);
  }
});
