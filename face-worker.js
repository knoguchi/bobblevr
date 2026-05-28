const STORAGE_KEY = 'face_landmarker_model_v1';
const camVid = document.getElementById('cam');
let faceLandmarker = null;
let running = false;

function send(msg) {
  parent.postMessage({ source: 'bvr-face', ...msg }, '*');
}

window.addEventListener('error', (e) => {
  send({ type: 'error', message: 'window error: ' + e.message });
});
window.addEventListener('unhandledrejection', (e) => {
  send({ type: 'error', message: 'unhandled rejection: ' + (e.reason?.message || e.reason) });
});

window.addEventListener('message', async (e) => {
  if (e.data?.target !== 'bvr-face') return;
  if (e.source !== parent) return;
  if (e.data.cmd === 'init') {
    send({ type: 'status', message: 'loading model...' });
    await initTracker();
  } else if (e.data.cmd === 'stop') {
    running = false;
    const tracks = camVid.srcObject?.getTracks();
    if (tracks) tracks.forEach(t => t.stop());
    camVid.srcObject = null;
  }
});

async function initTracker() {
  try {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    const modelDataUrl = stored[STORAGE_KEY];
    if (!modelDataUrl) {
      send({ type: 'error', message: 'model not found in storage.' });
      return;
    }

    send({ type: 'status', message: 'loading mediapipe...' });
    const mpUrl = chrome.runtime.getURL('lib/mediapipe-vision_bundle.mjs');
    const wasmDir = chrome.runtime.getURL('lib/mediapipe-wasm');
    const vision = await import(mpUrl);
    const { FilesetResolver, FaceLandmarker } = vision;
    const filesetResolver = await FilesetResolver.forVisionTasks(wasmDir);
    send({ type: 'status', message: 'creating face tracker...' });
    faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath: modelDataUrl,
        delegate: 'GPU'
      },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFacialTransformationMatrixes: true
    });
    send({ type: 'status', message: 'getting camera...' });
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 }, audio: false
    });
    camVid.srcObject = stream;
    await camVid.play();
    send({ type: 'ready' });
    running = true;
    loop();
  } catch (err) {
    send({ type: 'error', message: err.message });
  }
}

let lastVideoTime = -1;
function loop() {
  if (!running) return;
  if (faceLandmarker && camVid.readyState >= 2 && camVid.currentTime !== lastVideoTime) {
    lastVideoTime = camVid.currentTime;
    try {
      const r = faceLandmarker.detectForVideo(camVid, performance.now());
      if (r.faceLandmarks?.length > 0 && r.facialTransformationMatrixes?.length > 0) {
        const m = r.facialTransformationMatrixes[0].data;
        const lm = r.faceLandmarks[0];
        const L = lm[33], R = lm[263];
        const ipd = Math.hypot(R.x - L.x, R.y - L.y);
        send({ type: 'frame', matrix: Array.from(m), ipd });
      }
    } catch(e) {
      send({ type: 'error', message: 'detect err: ' + e.message });
    }
  }
  requestAnimationFrame(loop);
}

send({ type: 'loaded' });
