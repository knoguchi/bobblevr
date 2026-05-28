# Privacy Policy — BobbleVR

## Data Collection

BobbleVR does **not** collect, store, transmit, or share any personal data.

## Camera Access

BobbleVR requests webcam access solely for real-time face tracking to control the viewing angle. Camera data is:

- Processed entirely on-device using MediaPipe Face Landmarker
- Never recorded, stored, or transmitted
- Discarded immediately after each frame is processed
- Released when the viewer is closed

## Network Requests

BobbleVR makes a one-time download of the MediaPipe face tracking model from Google's public CDN (`storage.googleapis.com`). This model is cached locally in the browser's extension storage. No other network requests are made.

## YouTube Data

BobbleVR reads YouTube's player metadata (video format, projection type) to auto-detect the video format. This data is only used locally and is not transmitted anywhere.

## Third-Party Libraries

- [Three.js](https://threejs.org/) — 3D rendering (bundled, no network requests)
- [MediaPipe](https://developers.google.com/mediapipe) — Face tracking (model downloaded once from Google CDN)

## Contact

For questions about this privacy policy, open an issue at https://github.com/knoguchi/bobblevr
