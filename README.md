# BobbleVR

Watch YouTube 360° and VR180 videos with webcam head tracking. Move your head to look around, lean in to zoom.

## Features

- Head tracking via webcam (MediaPipe Face Landmarker)
- Auto-detects YouTube video format (EAC 360°, equirectangular, VR180 SBS/TB/mono)
- Scroll wheel zoom
- Lean-in zoom with stabilized view (sensitivity scales with zoom level)
- Supports: EAC 360°, equirectangular 360°, VR180 SBS/TB/mono, flat video

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

- **SHIFT**: Recenter view
- **B**: Toggle bezel overlay
- **H**: Hide/show UI
- **ESC**: Close viewer
- **P / K**: Play/pause video
- **←/→**: Seek 5 seconds
- **Scroll wheel**: Zoom in/out

## How It Works

1. Finds the playing `<video>` element on the page
2. Maps the video texture onto a sphere (equirectangular/hemisphere) or cubemap (EAC)
3. Runs MediaPipe Face Landmarker in an extension iframe for head tracking
4. Updates the Three.js camera based on face rotation and distance

## Supported Formats

| Format | Detection |
|--------|-----------|
| EAC 360° | YouTube `projectionType: MESH` |
| Equirectangular 360° | YouTube `projectionType: EQUIRECTANGULAR` |
| VR180 (mono/SBS/TB) | YouTube `vrConfig.partialSpherical: true` |
| Flat video | Manual selection |

## License

MIT
