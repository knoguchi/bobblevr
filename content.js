(() => {
  if (window.__bvrActive) {
    document.dispatchEvent(new CustomEvent('bvr:requestClose'));
    return;
  }
  window.__bvrActive = true;

  function findBestVideo() {
    const videos = Array.from(document.querySelectorAll('video'));
    if (videos.length === 0) return null;
    const playing = videos.filter(v => !v.paused && v.readyState >= 2 && v.videoWidth > 0);
    const pool = playing.length > 0 ? playing : videos.filter(v => v.videoWidth > 0);
    if (pool.length === 0) return null;
    pool.sort((a, b) => (b.videoWidth * b.videoHeight) - (a.videoWidth * a.videoHeight));
    return pool[0];
  }

  const video = findBestVideo();
  if (!video) {
    alert('BobbleVR: No video found on this page.\nPlay a video first, then click the extension icon.');
    window.__bvrActive = false;
    return;
  }

  const tag = 'bvr-src-' + Date.now();
  video.setAttribute('data-bvr-id', tag);

  document.documentElement.dataset.bvrTag = tag;
  document.documentElement.dataset.bvrThreeUrl = chrome.runtime.getURL('lib/three.module.js');
  document.documentElement.dataset.bvrOverlayUrl = chrome.runtime.getURL('overlay.js') + '?t=' + Date.now();
  document.documentElement.dataset.bvrWorkerUrl = chrome.runtime.getURL('face-worker.html') + '?t=' + Date.now();

  const host = document.createElement('div');
  host.id = '__bvr_root';
  host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#000;color:#eee;font-family:sans-serif;';
  document.documentElement.appendChild(host);

  const cssLink = document.createElement('link');
  cssLink.rel = 'stylesheet';
  cssLink.href = chrome.runtime.getURL('overlay.css');
  host.appendChild(cssLink);

  const inner = document.createElement('div');
  inner.innerHTML = `
    <div id="bvr_info">
      <div><b>BobbleVR</b></div>
      <div id="bvr_status">Starting...</div>
      <div style="margin-top:4px">
        Format:
        <select id="bvr_fmt">
          <option value="auto">Auto</option>
          <optgroup label="VR180">
            <option value="sbs180">VR180 SBS</option>
            <option value="tb180">VR180 TB</option>
            <option value="mono180">Mono 180°</option>
          </optgroup>
          <optgroup label="360°">
            <option value="eac360">EAC 360° (YouTube)</option>
            <option value="mono360">Mono 360° (equirectangular)</option>
            <option value="sbs360">360° SBS</option>
            <option value="tb360">360° TB</option>
          </optgroup>
          <optgroup label="Flat">
            <option value="flat">Flat video</option>
          </optgroup>
        </select>
      </div>
      <div style="margin-top:4px">
        <button id="bvr_recenter">Recenter</button>
        <button id="bvr_hide">Hide UI</button>
        <button id="bvr_close" style="background:#a33;border-color:#c55">Close (ESC)</button>
      </div>
      <div style="margin-top:6px;font-size:11px;color:#aaa">
        SHIFT recenter / H hide UI / ESC close / scroll zoom<br>
        Yaw: <select id="bvr_yawSign">
          <option value="-1" selected>head right → see right</option>
          <option value="1">reverse</option>
        </select><br>
        Pitch: <select id="bvr_pitchSign">
          <option value="1" selected>+</option>
          <option value="-1">-</option>
        </select>
        Roll: <select id="bvr_rollSign">
          <option value="1" selected>+</option>
          <option value="-1">-</option>
        </select><br>
        Sensitivity: <input id="bvr_sens" type="number" value="2.5" step="0.1" min="0.5" max="10"><br>
        Zoom: <input id="bvr_zoom" type="number" value="2.5" step="0.1" min="0" max="6"><br>
        FOV: <input id="bvr_fov" type="number" value="75" step="1" min="20" max="120">
      </div>
    </div>
    <button id="bvr_cornerClose" title="Close (ESC)">×</button>
    <canvas id="bvr_canvas"></canvas>
  `;
  while (inner.firstChild) host.appendChild(inner.firstChild);

  function cleanup() {
    const root = document.getElementById('__bvr_root');
    if (root) root.remove();
    video.removeAttribute('data-bvr-id');
    const ds = document.documentElement.dataset;
    Object.keys(ds).filter(k => k.startsWith('bvr')).forEach(k => delete ds[k]);
    window.__bvrActive = false;
  }
  document.addEventListener('bvr:closed', cleanup, { once: true });
})();
