const ds = document.documentElement.dataset;
const threeUrl = ds.bvrThreeUrl;
const sourceTag = ds.bvrTag;

if (!threeUrl) {
  console.error('[BobbleVR] three.js URL missing');
} else {
  const sourceVideo = sourceTag ? document.querySelector(`video[data-bvr-id="${sourceTag}"]`) : null;
  if (!sourceVideo) {
    console.error('[BobbleVR] source video not found');
  } else {
    const THREE = await import(threeUrl);
    run(THREE, sourceVideo);
  }
}

function run(THREE, sourceVideo) {
  const canvas = document.getElementById('bvr_canvas');
  const status = document.getElementById('bvr_status');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
  const vrContainer = new THREE.Group();
  scene.add(vrContainer);

  const videoTex = new THREE.VideoTexture(sourceVideo);
  videoTex.colorSpace = THREE.SRGBColorSpace;
  videoTex.minFilter = THREE.LinearFilter;
  videoTex.wrapS = THREE.ClampToEdgeWrapping;
  videoTex.wrapT = THREE.ClampToEdgeWrapping;

  let mesh = null;
  const FORMAT_PRESETS = {
    'flat':    { uMin: 0,   uMax: 1,   vMin: 0,   vMax: 1,   projection: 'flat' },
    'sbs180':  { uMin: 0,   uMax: 0.5, vMin: 0,   vMax: 1,   projection: 'hemisphere180' },
    'tb180':   { uMin: 0,   uMax: 1,   vMin: 0.5, vMax: 1,   projection: 'hemisphere180' },
    'mono180': { uMin: 0,   uMax: 1,   vMin: 0,   vMax: 1,   projection: 'hemisphere180' },
    'mono360': { uMin: 0,   uMax: 1,   vMin: 0,   vMax: 1,   projection: 'sphere360' },
    'sbs360':  { uMin: 0,   uMax: 0.5, vMin: 0,   vMax: 1,   projection: 'sphere360' },
    'tb360':   { uMin: 0,   uMax: 1,   vMin: 0.5, vMax: 1,   projection: 'sphere360' },
    'eac360':    { projection: 'eac360', stereo: 'mono' },
    'eac360sbs': { projection: 'eac360', stereo: 'sbs' },
    'eac360tb':  { projection: 'eac360', stereo: 'tb' },
  };

  function recommendedSensitivity(projection) {
    if (projection === 'flat') return 1.5;
    if (projection === 'hemisphere180') return 2.5;
    if (projection === 'sphere360' || projection === 'eac360') return 4.5;
    return 2.5;
  }

  function buildMesh(format) {
    if (mesh) {
      vrContainer.remove(mesh);
      if (mesh.isGroup) {
        mesh.children.forEach(c => { c.geometry.dispose(); c.material.dispose(); });
      } else {
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
    }
    const R = 100;
    const preset = FORMAT_PRESETS[format] || FORMAT_PRESETS['flat'];
    const { uMin, uMax, vMin, vMax, projection } = preset;
    const uRange = uMax - uMin;
    const vRange = vMax - vMin;

    let geo;
    if (projection === 'flat') {
      const fullW = sourceVideo.videoWidth || 1920;
      const fullH = sourceVideo.videoHeight || 1080;
      const cropW = fullW * uRange;
      const cropH = fullH * vRange;
      const cropAR = cropW / cropH;
      const dist = R * 0.5;
      const fovRad = camera.fov * Math.PI / 180;
      const visibleH = 2 * Math.tan(fovRad / 2) * dist;
      const screenAR = window.innerWidth / window.innerHeight;
      let planeH, planeW;
      if (cropAR > screenAR) {
        planeW = 2 * Math.tan(fovRad / 2) * dist * screenAR * 0.95;
        planeH = planeW / cropAR;
      } else {
        planeH = visibleH * 0.95;
        planeW = planeH * cropAR;
      }
      geo = new THREE.PlaneGeometry(planeW, planeH);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) {
        const u = uv.getX(i), v = uv.getY(i);
        uv.setXY(i, uMin + u * uRange, vMin + v * vRange);
      }
      uv.needsUpdate = true;
      geo.translate(0, 0, -dist);
      mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: videoTex, side: THREE.DoubleSide }));
      vrContainer.add(mesh);
      const sensInput = document.getElementById('bvr_sens');
      if (sensInput && !sensInput.dataset.userModified) sensInput.value = recommendedSensitivity(projection);
      return;
    }

    if (projection === 'eac360') {
      const stereo = preset.stereo || 'mono';
      const vidW = sourceVideo.videoWidth || 3840;
      const vidH = sourceVideo.videoHeight || 2160;
      console.log('[BobbleVR] EAC mode:', stereo, 'video:', vidW, 'x', vidH);
      geo = new THREE.SphereGeometry(R, 96, 64);
      let mat;

      if (stereo === 'mono') {
        // Mono EAC: 3 cols × 2 rows
        // Top row:    Left(-X) | Front(-Z) | Right(+X)
        // Bottom row: Down(-Y) | Back(+Z)  | Up(+Y)
        mat = new THREE.ShaderMaterial({
          uniforms: {
            map: { value: videoTex },
            texSize: { value: new THREE.Vector2(vidW, vidH) }
          },
          vertexShader: `
            varying vec3 vPos;
            void main() {
              vPos = position;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            uniform sampler2D map;
            uniform vec2 texSize;
            varying vec3 vPos;
            const float PI = 3.14159265359;
            const float CONT = 2.0;

            void main() {
              vec3 d = normalize(vPos);
              vec3 a = abs(d);
              float col, row;
              vec2 fuv;

              if (a.x >= a.y && a.x >= a.z) {
                if (d.x > 0.0) {
                  col = 2.0; row = 1.0;
                  fuv = vec2(d.z, d.y) / a.x;
                } else {
                  col = 0.0; row = 1.0;
                  fuv = vec2(-d.z, d.y) / a.x;
                }
              } else if (a.y >= a.x && a.y >= a.z) {
                if (d.y < 0.0) {
                  col = 0.0; row = 0.0;
                  fuv = vec2(d.z, d.x) / a.y;
                } else {
                  col = 2.0; row = 0.0;
                  fuv = vec2(-d.z, d.x) / a.y;
                }
              } else {
                if (d.z < 0.0) {
                  col = 1.0; row = 1.0;
                  fuv = vec2(d.x, d.y) / a.z;
                } else {
                  col = 1.0; row = 0.0;
                  fuv = vec2(d.y, d.x) / a.z;
                }
              }

              vec2 eac = 2.0 / PI * atan(fuv) + 0.5;
              float faceW = 1.0 / 3.0;
              float faceH = 0.5;
              float cx = CONT / texSize.x;
              float cy = CONT / texSize.y;
              float u = col * faceW + cx + eac.x * (faceW - 2.0 * cx);
              float v = row * faceH + cy + eac.y * (faceH - 2.0 * cy);
              gl_FragColor = texture2D(map, vec2(u, v));
            }
          `,
          side: THREE.BackSide
        });
      } else {
        // Stereo EAC: 2 cols × 3 rows per eye
        // SBS: left eye = left half, right eye = right half (4 cols × 3 rows total)
        // TB:  left eye = top half, right eye = bottom half (2 cols × 6 rows total)
        //
        // Per-eye layout (from bottom):
        //   Col 0        | Col 1
        //   Right(+X)    | Top(+Y)      row 2
        //   Front(-Z)    | Back(+Z)     row 1
        //   Left(-X)     | Bottom(-Y)   row 0
        const regionU = stereo === 'sbs' ? 0.0 : 0.0;
        const regionV = stereo === 'tb' ? 0.5 : 0.0;
        const regionW = stereo === 'sbs' ? 0.5 : 1.0;
        const regionH = stereo === 'tb' ? 0.5 : 1.0;
        mat = new THREE.ShaderMaterial({
          uniforms: {
            map: { value: videoTex },
            texSize: { value: new THREE.Vector2(vidW, vidH) },
            region: { value: new THREE.Vector4(regionU, regionV, regionW, regionH) }
          },
          vertexShader: `
            varying vec3 vPos;
            void main() {
              vPos = position;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            uniform sampler2D map;
            uniform vec2 texSize;
            uniform vec4 region;
            varying vec3 vPos;
            const float PI = 3.14159265359;
            const float CONT = 2.0;

            void main() {
              vec3 d = normalize(vPos);
              vec3 a = abs(d);
              float col, row;
              vec2 fuv;

              // 2 cols × 3 rows per eye
              // Col 0       | Col 1
              // Right(+X)   | Top(+Y)     row 2
              // Front(-Z)   | Back(+Z)    row 1
              // Left(-X)    | Bottom(-Y)  row 0

              // Verified face UV mappings for YouTube stereo EAC (2x3 per eye)
              if (a.x >= a.y && a.x >= a.z) {
                if (d.x > 0.0) {
                  col = 0.0; row = 2.0;   // Right(+X)
                  fuv = vec2(-d.y, d.z) / a.x;
                } else {
                  col = 0.0; row = 0.0;   // Left(-X)
                  fuv = vec2(-d.y, -d.z) / a.x;
                }
              } else if (a.y >= a.x && a.y >= a.z) {
                if (d.y < 0.0) {
                  col = 1.0; row = 0.0;   // Bottom(-Y): 90°CCW from mono
                  fuv = vec2(-d.x, d.z) / a.y;
                } else {
                  col = 1.0; row = 2.0;   // Top(+Y): 90°CCW from mono
                  fuv = vec2(-d.x, -d.z) / a.y;
                }
              } else {
                if (d.z < 0.0) {
                  col = 0.0; row = 1.0;   // Front(-Z)
                  fuv = vec2(-d.y, d.x) / a.z;
                } else {
                  col = 1.0; row = 1.0;   // Back(+Z)
                  fuv = vec2(-d.x, d.y) / a.z;
                }
              }

              vec2 eac = 2.0 / PI * atan(fuv) + 0.5;
              float faceW = 0.5;
              float faceH = 1.0 / 3.0;
              float rW = region.z * texSize.x;
              float rH = region.w * texSize.y;
              float cx = CONT / rW;
              float cy = CONT / rH;
              float u = col * faceW + cx + eac.x * (faceW - 2.0 * cx);
              float v = row * faceH + cy + eac.y * (faceH - 2.0 * cy);
              u = region.x + u * region.z;
              v = region.y + v * region.w;
              gl_FragColor = texture2D(map, vec2(u, v));
            }
          `,
          side: THREE.BackSide
        });
      }

      mesh = new THREE.Mesh(geo, mat);
      vrContainer.add(mesh);
      const sensInput = document.getElementById('bvr_sens');
      if (sensInput && !sensInput.dataset.userModified) sensInput.value = recommendedSensitivity('eac360');
      return;
    }

    // sphere360 or hemisphere180
    geo = new THREE.SphereGeometry(R, 96, 64);
    const pos = geo.attributes.position;
    const uvAttr = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const r = Math.hypot(x, y, z);
      let baseU, baseV;
      if (projection === 'sphere360') {
        const lon = Math.atan2(x, -z);
        const lat = Math.asin(y / r);
        baseU = (lon + Math.PI) / (2 * Math.PI);
        baseV = 0.5 + lat / Math.PI;
      } else {
        const lon = Math.atan2(x, -z);
        const lat = Math.asin(y / r);
        baseU = (lon + Math.PI / 2) / Math.PI;
        baseV = 0.5 + lat / Math.PI;
      }
      const u = uMin + baseU * uRange;
      const v = vMin + baseV * vRange;
      uvAttr.setXY(i, u, v);
    }
    uvAttr.needsUpdate = true;
    mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: videoTex, side: THREE.BackSide }));
    vrContainer.add(mesh);
    const sensInput = document.getElementById('bvr_sens');
    if (sensInput && !sensInput.dataset.userModified) sensInput.value = recommendedSensitivity(projection);
  }

  let currentFormat = 'eac360';

  // Detect format from YouTube's player API + MSE metadata fallback
  function detectYouTubeFormat() {
    // Try YouTube player data
    try {
      const currentVideoId = new URLSearchParams(location.search).get('v');
      let pr = null;
      for (const src of [
        () => document.querySelector('ytd-watch-flexy')?.playerData_,
        () => window.ytInitialPlayerResponse,
        () => document.querySelector('#movie_player')?.getPlayerResponse?.(),
        () => {
          // Try ytcfg embedded data
          const cfg = window.ytcfg?.get?.('PLAYER_VARS');
          return cfg?.embedded_player_response ? JSON.parse(cfg.embedded_player_response) : null;
        },
      ]) {
        try {
          const candidate = src();
          if (candidate?.videoDetails?.videoId === currentVideoId) { pr = candidate; break; }
        } catch(_) {}
      }

      if (pr) {
        const is180 = pr.playerConfig?.vrConfig?.partialSpherical === true;
        const formats = pr.streamingData?.adaptiveFormats || [];
        const vFmt = formats.find(f => f.projectionType && f.projectionType !== 'RECTANGULAR');
        const proj = vFmt?.projectionType || '';
        const stereo = vFmt?.stereoLayout || '';
        const isSBS = stereo.includes('LEFT_RIGHT');
        const isTB = stereo.includes('TOP_BOTTOM');

        console.log('[BobbleVR] player detected:', { is180, proj, stereo });

        if (is180) {
          if (isSBS) return 'sbs180';
          if (isTB) return 'tb180';
          return 'mono180';
        }
        if (proj === 'MESH') {
          if (isSBS) return 'eac360sbs';
          if (isTB) return 'eac360tb';
          return 'eac360';
        }
        if (proj === 'EQUIRECTANGULAR') {
          if (isSBS) return 'sbs360';
          if (isTB) return 'tb360';
          return 'mono360';
        }
      } else {
        console.log('[BobbleVR] no player response found');
      }
    } catch (e) {
      console.warn('[BobbleVR] player detection error:', e);
    }

    // Fallback: MSE metadata from mse-hook.js (sv3d/proj MP4 boxes)
    try {
      const metaStr = document.documentElement.dataset.bvrSphericalMeta;
      const meta = metaStr ? JSON.parse(metaStr) : window.__bvrMeta?.metadata;
      if (meta) {
        console.log('[BobbleVR] MSE metadata:', meta);
        const stereoMode = meta.stereoMode || 'mono';
        const isSBS = stereoMode === 'left-right';
        const isTB = stereoMode === 'top-bottom';

        if (meta.projection === 'mesh') {
          if (isSBS) return 'eac360sbs';
          if (isTB) return 'eac360tb';
          return 'eac360';
        }
        if (meta.projection === 'equirectangular') {
          if (isSBS) return 'sbs360';
          if (isTB) return 'tb360';
          return 'mono360';
        }
        if (meta.projection === 'cubemap') {
          return 'eac360';
        }
        if (meta.foundSv3d) {
          return 'mono360';
        }
      } else {
        console.log('[BobbleVR] no MSE metadata found');
      }
    } catch (e) {
      console.warn('[BobbleVR] MSE metadata fallback error:', e);
    }

    // Fallback: aspect ratio heuristic
    if (sourceVideo.videoWidth && sourceVideo.videoHeight) {
      const ratio = sourceVideo.videoWidth / sourceVideo.videoHeight;
      // 3:2 is typical mono EAC, 4:3 is typical stereo EAC SBS
      if (Math.abs(ratio - 4/3) < 0.05) return 'eac360sbs';
      if (Math.abs(ratio - 3/2) < 0.05) return 'eac360';
      if (Math.abs(ratio - 2) < 0.05) return 'mono360';
      if (Math.abs(ratio - 1) < 0.05) return 'tb360';
    }

    return null;
  }

  function autoDetect() {
    if (!sourceVideo.videoWidth) return;
    const w = sourceVideo.videoWidth, h = sourceVideo.videoHeight;

    const detected = detectYouTubeFormat();
    if (detected) {
      currentFormat = detected;
      document.getElementById('bvr_fmt').value = detected;
      buildMesh(detected);
      status.textContent = `${w}x${h} → ${detected}`;
      return;
    }

    const fallback = 'flat';
    currentFormat = fallback;
    document.getElementById('bvr_fmt').value = fallback;
    buildMesh(fallback);
    status.textContent = `${w}x${h} → ${fallback} [select format manually]`;
  }

  // Auto-detect with retry — player data may not be available immediately
  let detectAttempts = 0;
  function autoDetectWithRetry() {
    autoDetect();
    detectAttempts++;
    if (currentFormat === 'flat' && detectAttempts < 5) {
      setTimeout(autoDetectWithRetry, 500);
    }
  }

  if (sourceVideo.videoWidth > 0) {
    autoDetectWithRetry();
  } else {
    buildMesh('eac360');
    sourceVideo.addEventListener('loadedmetadata', autoDetectWithRetry, { once: true });
  }

  let faceLandmarker = null;
  let faceIframe = null;
  let messageHandler = null;
  const smoothedRot = { yaw: 0, pitch: 0, roll: 0 };
  const smoothedDist = { ipd: 0 };
  const SMOOTH_ROT = 0.2;
  const SMOOTH_DIST = 0.15;
  let yawCal = 0, pitchCal = 0, rollCal = 0, ipdCal = 0;
  let firstFaceFrame = true;

  function initFaceTracker() {
    const workerUrl = ds.bvrWorkerUrl;
    const modelStatus = ds.bvrModelStatus;
    if (!workerUrl) { status.textContent = 'Face tracker: worker not found'; return; }
    if (modelStatus?.startsWith('error')) { status.textContent = 'Face tracker: model error'; return; }

    messageHandler = (e) => {
      if (e.data?.source !== 'bvr-face') return;
      if (faceIframe && e.source !== faceIframe.contentWindow) return;
      if (e.data.type === 'loaded') {
        faceIframe?.contentWindow?.postMessage({ target: 'bvr-face', cmd: 'init' }, '*');
      } else if (e.data.type === 'ready') {
        faceLandmarker = { active: true };
        status.textContent = 'Tracking active';
      } else if (e.data.type === 'error') {
        status.textContent = 'Tracker error: ' + e.data.message;
      } else if (e.data.type === 'status') {
        status.textContent = e.data.message;
      } else if (e.data.type === 'frame') {
        handleFrame(e.data.matrix, e.data.ipd);
      }
    };
    window.addEventListener('message', messageHandler);

    const iframe = document.createElement('iframe');
    faceIframe = iframe;
    iframe.allow = 'camera';
    iframe.style.cssText = 'position:fixed;width:1px;height:1px;bottom:0;right:0;border:none;opacity:0;pointer-events:none;';
    iframe.src = workerUrl;
    document.getElementById('__bvr_root').appendChild(iframe);
  }

  function handleFrame(matrixData, ipd) {
    const mat = new THREE.Matrix4().fromArray(matrixData);
    const e = new THREE.Euler().setFromRotationMatrix(mat, 'YXZ');
    const yaw = e.y, pitch = e.x, roll = e.z;
    if (firstFaceFrame) {
      Object.assign(smoothedRot, { yaw, pitch, roll });
      smoothedDist.ipd = ipd;
      yawCal = yaw; pitchCal = pitch; rollCal = roll; ipdCal = ipd;
      firstFaceFrame = false;
    } else {
      smoothedRot.yaw += (yaw - smoothedRot.yaw) * SMOOTH_ROT;
      smoothedRot.pitch += (pitch - smoothedRot.pitch) * SMOOTH_ROT;
      smoothedRot.roll += (roll - smoothedRot.roll) * SMOOTH_ROT;
      smoothedDist.ipd += (ipd - smoothedDist.ipd) * SMOOTH_DIST;
    }
  }

  let stopAnimation = false;
  function animate() {
    if (stopAnimation) return;
    const sens = +document.getElementById('bvr_sens').value;
    const yawSign = +document.getElementById('bvr_yawSign').value;
    const pitchSign = +document.getElementById('bvr_pitchSign').value;
    const rollSign = +document.getElementById('bvr_rollSign').value;
    const zoomGain = +document.getElementById('bvr_zoom').value;
    const baseFov = +document.getElementById('bvr_fov').value;

    const rawYaw = smoothedRot.yaw - yawCal;
    const rawPitch = smoothedRot.pitch - pitchCal;
    const rawRoll = smoothedRot.roll - rollCal;

    let currentFov = baseFov;
    if (ipdCal > 0 && smoothedDist.ipd > 0) {
      const ratio = smoothedDist.ipd / ipdCal;
      currentFov = Math.max(20, Math.min(120, baseFov / (1 + zoomGain * (ratio - 1))));
    }

    const fovScale = currentFov / baseFov;
    const effectiveYaw = yawSign * rawYaw * sens * fovScale;
    const pitchFlip = Math.cos(effectiveYaw) >= 0 ? 1 : -1;
    vrContainer.rotation.set(
      pitchFlip * pitchSign * rawPitch * sens * fovScale,
      effectiveYaw,
      0, 'YXZ'
    );
    camera.rotation.z = -(rollSign * rawRoll);

    if (Math.abs(camera.fov - currentFov) > 0.1) {
      camera.fov = currentFov;
      camera.updateProjectionMatrix();
    }

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  let resizeTimer = 0;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth/window.innerHeight;
      camera.updateProjectionMatrix();
      if (currentFormat === 'flat') buildMesh('flat');
    }, 100);
  }
  window.addEventListener('resize', onResize);

  function recenter() {
    yawCal = smoothedRot.yaw;
    pitchCal = smoothedRot.pitch;
    rollCal = smoothedRot.roll;
    ipdCal = smoothedDist.ipd;
  }

  // Format quick-switch: keys 1 through 0, -, =
  const FORMAT_KEYS = {
    '1': 'eac360',
    '2': 'eac360sbs',
    '3': 'eac360tb',
    '4': 'mono360',
    '5': 'sbs360',
    '6': 'tb360',
    '7': 'sbs180',
    '8': 'tb180',
    '9': 'mono180',
    '-': 'flat',
    '=': 'auto',
  };

  function switchFormat(fmt) {
    currentFormat = fmt;
    document.getElementById('bvr_fmt').value = fmt;
    buildMesh(fmt);
    const w = sourceVideo.videoWidth, h = sourceVideo.videoHeight;
    status.textContent = `${w}x${h} → ${fmt}`;
  }

  function onKey(e) {
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { e.preventDefault(); recenter(); }
    else if (e.code === 'KeyH') document.getElementById('bvr_info').classList.toggle('bvr_hide');
    else if (e.code === 'Escape') doClose();
    else if (e.code === 'ArrowLeft') sourceVideo.currentTime = Math.max(0, sourceVideo.currentTime - 5);
    else if (e.code === 'ArrowRight') sourceVideo.currentTime = sourceVideo.currentTime + 5;
    else if (FORMAT_KEYS[e.key] !== undefined) {
      e.preventDefault();
      const fmt = FORMAT_KEYS[e.key];
      if (fmt === 'auto') { detectAttempts = 0; autoDetectWithRetry(); }
      else switchFormat(fmt);
    }
  }
  document.addEventListener('keydown', onKey);

  function onWheel(e) {
    e.preventDefault();
    const fovInput = document.getElementById('bvr_fov');
    const step = e.deltaY > 0 ? 2 : -2;
    fovInput.value = Math.max(20, Math.min(120, +fovInput.value + step));
  }
  canvas.addEventListener('wheel', onWheel, { passive: false });

  function doClose() {
    if (stopAnimation) return;
    stopAnimation = true;
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', onResize);
    canvas.removeEventListener('wheel', onWheel);
    document.removeEventListener('bvr:requestClose', doClose);
    if (messageHandler) window.removeEventListener('message', messageHandler);

    if (faceIframe?.contentWindow) {
      faceIframe.contentWindow.postMessage({ target: 'bvr-face', cmd: 'stop' }, '*');
    }

    if (mesh) {
      if (mesh.isGroup) {
        mesh.children.forEach(c => { c.geometry.dispose(); c.material.dispose(); });
      } else {
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
    }
    videoTex.dispose();
    renderer.dispose();

    const root = document.getElementById('__bvr_root');
    if (root) root.remove();
    window.__bvrMainLoaded = false;
    document.dispatchEvent(new CustomEvent('bvr:closed'));
  }
  window.__bvrCleanup = doClose;
  document.addEventListener('bvr:requestClose', doClose);

  document.getElementById('bvr_sens').addEventListener('input', (e) => {
    e.target.dataset.userModified = '1';
  });
  document.getElementById('bvr_recenter').onclick = recenter;
  document.getElementById('bvr_hide').onclick = () => document.getElementById('bvr_info').classList.toggle('bvr_hide');
  document.getElementById('bvr_close').onclick = doClose;
  const cornerClose = document.getElementById('bvr_cornerClose');
  if (cornerClose) cornerClose.onclick = doClose;
  document.getElementById('bvr_fmt').onchange = (e) => {
    const v = e.target.value;
    if (v === 'auto') autoDetect();
    else {
      currentFormat = v;
      buildMesh(v);
      const w = sourceVideo.videoWidth, h = sourceVideo.videoHeight;
      status.textContent = `${w}x${h} → ${v}`;
    }
  };

  initFaceTracker();
  animate();
  status.textContent = 'Running';
}
