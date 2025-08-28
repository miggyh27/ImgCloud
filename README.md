# 🌟 ImgCloud

A tiny p5.js (WEBGL) playground that turns any image into a shimmering 3D point-cloud. Drag to orbit, toggle "depth," and swap presets—or click ➕ **Try your photo** to generate a cloud from your own image.

![ImgCloud Demo](https://img.shields.io/badge/Status-Active-brightgreen) ![p5.js](https://img.shields.io/badge/p5.js-WEBGL-blue) ![License](https://img.shields.io/badge/License-MIT-yellow)

---

## ✨ Features

- **Point-cloud renderer** with batched POINTS for smooth performance
- **Depth from luminance** (flat ↔ depth modes)
- **Live controls**: quality (STEP), zoom, depth amplitude, spin
- **Preset gallery** + upload tile (center-cropped thumbnails, no stretching)
- **Adaptive quality** to keep FPS stable

---

## 🔧 How it works

1. **Image → pixels** (`loadPixels`) → points binned into 27 color buckets
2. Each point stores base `(x0, y0, z0)` + a random phase for subtle motion
3. A single `renderCloud(glow, trig)` function draws the cloud every frame

---

## 🚀 Run it

### p5 Web Editor (easiest)
1. Create a new sketch and paste `sketch.js`
2. In Sketch Files, add an `assets/` folder and drop any images (e.g., `cat.jpg`)
3. Press ▶ **Run**. Use presets or ➕ **Try your photo**

### Local Development
```bash
# any simple server; prevents CORS issues
python3 -m http.server 8080
# open http://localhost:8080
```

---

## 🎮 Controls

| Action | Control |
|--------|---------|
| **Orbit** | Drag |
| **Glow** | G |
| **Flat/Depth** | 1/2 |
| **Quality** | [ / ] |
| **UI Controls** | STEP ±, Zoom ±, Depth ±, spin ◄ ■ ►, Reset View |
| **Presets** | Scroll wheel or ‹/› buttons; click to load |

---

## 📁 Add presets

Place images in `assets/` and register them (no CORS problems):

```javascript
const ASSET_SOURCES = [
  { name: 'My Photo', path: 'assets/my-photo.jpg' }
];

// in setup() after buildGallery():
for (const s of ASSET_SOURCES) 
  loadImage(s.path, im => gallery.unshift({ name: s.name, img: im }));
```

---

## 📋 Rubric (explicit)

### Variables
- `mode`, `STEP`, `sceneScale`, `depthAmp`, etc.

### Conditionals
- `if (!pointerOverUI())`, `if (resetCam)`, `mode==='flat' ? 0 : …`

### Loops
- Nested pixel loops in `rebuildPoints()`
- Per-bucket/per-vertex loops in `renderCloud()`

### Unique function (called in draw)
- `renderCloud(glow, trig)`

---

## 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| **"Problem loading image"** | Remote hosts often block CORS; upload the file to `assets/` or run locally |
| **Low FPS** | The sketch auto-tunes STEP; you can also click STEP+ to reduce density |

---

## 📦 Project Structure

```
ImgCloud/
├── sketch.js                    # Main p5.js sketch
├── assets/                      # Image assets
│   ├── 126428310-autumn-season-beautiful-phone-wallpaper.jpg
│   ├── 651486.png
│   └── 72544-1440x2560-iphone-hd-black-hole-background-image.jpg
└── README.md                    # This file
```

---

## 🤝 Contributing

Feel free to submit issues and enhancement requests!

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Made with ❤️ using p5.js**

[![p5.js](https://p5js.org/assets/img/p5js.svg)](https://p5js.org/)

</div>
