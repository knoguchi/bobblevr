(() => {
  if (window.__bvrMseHookInstalled) return;
  window.__bvrMseHookInstalled = true;

  const collected = { metadata: null };
  window.__bvrMeta = collected;

  function readUint32(view, o) { return view.getUint32(o); }
  function readFourCC(view, o) {
    return String.fromCharCode(view.getUint8(o), view.getUint8(o+1),
                                view.getUint8(o+2), view.getUint8(o+3));
  }

  const CONTAINER_BOXES = ['moov', 'trak', 'mdia', 'minf', 'stbl', 'stsd',
                           'avc1', 'hev1', 'hvc1', 'vp08', 'vp09', 'av01',
                           'mp4a', 'edts', 'udta', 'meta',
                           'sv3d', 'proj', 'st3d'];
  const VISUAL_ENTRIES = ['avc1', 'hev1', 'hvc1', 'vp08', 'vp09', 'av01'];

  function findBox(buffer, name, startOffset, endOffset) {
    const view = new DataView(buffer, 0);
    let offset = startOffset || 0;
    const end = endOffset !== undefined ? endOffset : buffer.byteLength;
    while (offset + 8 <= end) {
      const size = readUint32(view, offset);
      const type = readFourCC(view, offset + 4);
      if (size < 8 || offset + size > end) return null;
      if (type === name) {
        return { offset, size, dataOffset: offset + 8 };
      }
      if (CONTAINER_BOXES.includes(type)) {
        let recurseStart = offset + 8;
        if (type === 'stsd') recurseStart = offset + 8 + 8;
        if (VISUAL_ENTRIES.includes(type)) recurseStart = offset + 8 + 78;
        const found = findBox(buffer, name, recurseStart, offset + size);
        if (found) return found;
      }
      offset += size;
    }
    return null;
  }

  function parseSphericalMetadata(buffer) {
    const result = {};
    const view = new DataView(buffer);

    const sv3d = findBox(buffer, 'sv3d');
    if (sv3d) {
      result.foundSv3d = true;
      const proj = findBox(buffer, 'proj', sv3d.dataOffset, sv3d.offset + sv3d.size);
      if (proj) {
        const prhd = findBox(buffer, 'prhd', proj.dataOffset, proj.offset + proj.size);
        if (prhd) {
          const o = prhd.dataOffset + 4;
          result.poseYaw = view.getInt32(o) / 65536;
          result.posePitch = view.getInt32(o + 4) / 65536;
          result.poseRoll = view.getInt32(o + 8) / 65536;
        }
        const equi = findBox(buffer, 'equi', proj.dataOffset, proj.offset + proj.size);
        if (equi) {
          result.projection = 'equirectangular';
          const o = equi.dataOffset + 4;
          result.boundsTop = view.getUint32(o) / 4294967296;
          result.boundsBottom = view.getUint32(o + 4) / 4294967296;
          result.boundsLeft = view.getUint32(o + 8) / 4294967296;
          result.boundsRight = view.getUint32(o + 12) / 4294967296;
        }
        const cbmp = findBox(buffer, 'cbmp', proj.dataOffset, proj.offset + proj.size);
        if (cbmp) result.projection = 'cubemap';
        const mshp = findBox(buffer, 'mshp', proj.dataOffset, proj.offset + proj.size);
        if (mshp) result.projection = 'mesh';
      }
    }

    const st3d = findBox(buffer, 'st3d');
    if (st3d) {
      const mode = view.getUint8(st3d.dataOffset + 4);
      result.stereoMode = ['mono', 'top-bottom', 'left-right', 'stereo-custom'][mode] || 'unknown';
    }

    return Object.keys(result).length > 0 ? result : null;
  }

  function tryParse(buffer, source) {
    try {
      const meta = parseSphericalMetadata(buffer);
      if (meta) {
        collected.metadata = meta;
        document.documentElement.dataset.bvrSphericalMeta = JSON.stringify(meta);
      }
    } catch (e) {}
  }

  if (typeof MediaSource === 'undefined') return;

  const origAddSourceBuffer = MediaSource.prototype.addSourceBuffer;
  MediaSource.prototype.addSourceBuffer = function(...args) {
    const sb = origAddSourceBuffer.apply(this, args);
    const mimeType = args[0] || '';
    if (mimeType.includes('video') || mimeType.includes('mp4')) {
      let appendCount = 0;
      const origAppend = sb.appendBuffer;
      sb.appendBuffer = function(data) {
        try {
          if (!collected.metadata && appendCount < 5) {
            appendCount++;
            const buffer = data.buffer
              ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
              : data.slice(0);
            if (buffer.byteLength < 1024 * 1024) {
              tryParse(buffer, 'appendBuffer#' + appendCount);
            }
          }
        } catch (e) {}
        return origAppend.call(this, data);
      };
    }
    return sb;
  };

  // Reset metadata on YouTube SPA navigation
  function resetMeta() {
    collected.metadata = null;
    delete document.documentElement.dataset.bvrSphericalMeta;
  }
  const pushState = history.pushState;
  history.pushState = function() { resetMeta(); return pushState.apply(this, arguments); };
  const replaceState = history.replaceState;
  history.replaceState = function() { resetMeta(); return replaceState.apply(this, arguments); };
  window.addEventListener('popstate', resetMeta);
})();
