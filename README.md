# BobbleVR

Watch YouTube 360° and VR180 videos with webcam head tracking. Move your head to look around, lean in to zoom.

## Features

- Head tracking via webcam (MediaPipe Face Landmarker)
- Auto-detects YouTube video format (EAC 360°, stereo EAC 3D, equirectangular, VR180)
- Number keys 1-0 for quick format switching when auto-detect fails
- Scroll wheel zoom
- Lean-in zoom with stabilized view (sensitivity scales with zoom level)

## Install (Developer Mode)

1. Clone or download this folder
2. Open `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked**
5. Select this folder
6. The BobbleVR icon appears in the toolbar

## Usage

1. Navigate to a YouTube 360° or VR180 video
2. Play the video
3. Click the BobbleVR icon
4. Allow camera access (for face tracking)
5. Move your head to look around

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| SHIFT | Recenter view |
| H | Hide/show UI |
| ESC | Close viewer |
| Left/Right | Seek 5 seconds |
| Scroll | Zoom in/out |
| **1** | EAC 360° (YouTube mono) |
| **2** | EAC 360° 3D SBS |
| **3** | EAC 360° 3D TB |
| **4** | 360° equirectangular |
| **5** | 360° SBS |
| **6** | 360° TB |
| **7** | VR180 SBS |
| **8** | VR180 TB |
| **9** | VR180 mono |
| **-** | Flat video |
| **=** | Auto-detect |

## Supported Formats

| Format | Projection | Stereo | Detection |
|--------|-----------|--------|-----------|
| EAC 360° | Cubemap (3x2) | Mono | YouTube `MESH` / MSE metadata |
| EAC 360° 3D | Cubemap (2x3 per eye) | SBS / TB | YouTube `MESH` + stereo layout |
| Equirectangular 360° | Sphere | Mono / SBS / TB | YouTube `EQUIRECTANGULAR` / MSE metadata |
| VR180 | Hemisphere | Mono / SBS / TB | YouTube `vrConfig.partialSpherical` |
| Flat | Plane | Mono | Manual / fallback |

## Troubleshooting: Identifying the Video Format

If auto-detection fails and the video looks strange, press **-** (flat mode) to inspect the raw video frame. Then use the visual clues below to pick the right format:

**4 vertical columns (LLRR pattern):**
This is stereo EAC 3D. The left two columns are the left eye, the right two are the right eye. Each column has 3 stacked cubemap faces with their top edge pointing left. Press **2** (EAC 3D SBS).

**3 columns x 2 rows (6 tiles):**
Standard YouTube EAC 360°. The top row has 3 cubemap faces, the bottom row has 3 more, all rotated 90°. Press **1** (EAC 360°).

**Wide panoramic image (2:1 aspect ratio):**
Equirectangular 360°. The image looks like a world map projection. Press **4** (360°).

**Top/bottom split, both halves show the same scene:**
Stereo 3D. If each half is a panoramic image, try **6** (360° TB). If each half shows roughly 180° of content, try **8** (VR180 TB).

**Left/right split, both halves show the same scene:**
Stereo 3D side-by-side. If each half is a full panorama, try **5** (360° SBS). If each half shows roughly 180°, try **7** (VR180 SBS).

**Top/bottom split with different orientations:**
If the bottom half appears rotated 90° relative to the top, this is likely EAC 360° arranged vertically. Try **1** (EAC 360°) or **3** (EAC 3D TB).

**Normal-looking video:**
Flat video, not 360°. Press **-** (Flat) or **0** to stay in flat mode.

Press **=** to retry auto-detection at any time.

## How It Works

1. Finds the playing `<video>` element on the page
2. Maps the video texture onto a sphere/hemisphere (equirectangular) or cubemap (EAC) using Three.js
3. Runs MediaPipe Face Landmarker in an extension iframe for head tracking
4. Updates the Three.js camera based on face rotation and distance
5. Auto-detects format from YouTube player data, MP4 spherical metadata (sv3d/proj boxes), and aspect ratio heuristics

## Build

```sh
git tag v1.0.0   # set version
./build.sh       # creates bobblevr-1.0.0.zip
```

The zip is ready for upload to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).

## License

MIT
