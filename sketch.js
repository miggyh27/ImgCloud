/**
 * Point-Cloud Painter — p5.js / WEBGL (1200×800)
 * Rubric mapping:
 *  - Variable: mode, STEP, sceneScale, depthAmp, etc.
 *  - Conditional: if (!pointerOverUI()), if (resetCam), mode==='flat' ? 0 : …
 *  - Loop: nested loops in rebuildPoints(); per-bucket/per-vertex loops in renderCloud()
 *  - Unique function called from draw(): renderCloud(glow, trig)
 */

const CANVAS_W = 1200, CANVAS_H = 800;

let img = null, ready = false, hud;
let buckets = [];
const N_BUCKETS = 27;

let mode = 'depth';
let spin = 0, spinSpeed = 0.0002, pulse = 0;
let STEP = 4; const STEP_MIN = 2, STEP_MAX = 10;

let sceneScale = 0.90;
let depthAmp  = 95;

let gallery = [];
let buttons = [], thumbBoxes = [];
let uploadBox = null;
let resetCam = false;
let pickerDom;

let fpsWindow = [], adjustCooldown = 0;

// --- scrolling state for the preset strip ---
let thumbScroll = 0;        // pixels scrolled to the right
let maxThumbScroll = 0;
let stripRegion = null;     // {x,y,w,h} for mouseWheel hit test

// Remote presets (loaded asynchronously). If a site blocks CORS, use “➕ Try your photo”.
const REMOTE_SOURCES = [
  { name: 'Unsplash • Headphones', url: 'https://images.unsplash.com/photo-1505628346881-b72b27e84530?q=80&w=774&auto=format&fit=crop&ixlib=rb-4.1.0' },
  { name: 'Unsplash • Dog',        url: 'https://images.unsplash.com/photo-1574158622682-e40e69881006?q=80&w=1160&auto=format&fit=crop&ixlib=rb-4.1.0' },
  { name: 'Black Hole',            url: 'https://wallpapercat.com/w/full/1/8/6/72544-1440x2560-iphone-hd-black-hole-background-image.jpg' },
  { name: 'Synthwave Grid',        url: 'https://images6.alphacoders.com/651/651486.png' },
  { name: 'Autumn Forest',         url: 'https://wallpaperbat.com/img/126428310-autumn-season-beautiful-phone-wallpaper.jpg' },
  { name: 'Black Hole',  url: 'https://freeimage.host/i/K32PxAx' },
  { name: 'Synthwave Grid', url: 'https://freeimage.host/i/K32PItV' },
  { name: 'Autumn Forest',  url: 'https://freeimage.host/i/K32PuoB' }
];

function setup() {
  createCanvas(CANVAS_W, CANVAS_H, WEBGL);
  pixelDensity(1);
  noFill();
  hud = createGraphics(width, height);

  // hidden file input; triggered by the HUD tile
  pickerDom = createFileInput(file => { if (file && file.type === 'image') loadPainting(file.data); });
  pickerDom.position(16, height + 96);
  pickerDom.style('display', 'none');

  gallery = buildGallery();
  for (const src of REMOTE_SOURCES) {
    loadImage(src.url, im => gallery.unshift({ name: src.name, img: im }), () => {});
  }
  useImage(gallery[0].img);
}

function draw() {
  background(5);
  if (!ready) { drawHUD('Loading image… (or click ➕ Try your photo below)'); blitHUD(); return; }

  if (!pointerOverUI()) orbitControl(2, 1, 0.1);

  if (resetCam) {
    camera(0, 0, (height/2) / tan(PI/6), 0, 0, 0, 0, 1, 0);
    perspective();
    resetCam = false;
  }

  rotateY(spin * spinSpeed);
  spin++;
  pulse = (sin(frameCount * 0.03) + 1) * 0.5;

  const t1 = frameCount * 0.015, t2 = frameCount * 0.013, t3 = frameCount * 0.02;
  const trig = { c1: cos(t1), s1: sin(t1), c2: cos(t2), s2: sin(t2), c3: cos(t3), s3: sin(t3) };

  const glow = keyIsDown(71);
  renderCloud(glow, trig);

  trackFPS(); autoAdjustQuality();
  drawUI(glow); blitHUD();
}

function renderCloud(glow, T) {
  const weight = glow ? 3.0 : 1.8;
  for (let bi = 0; bi < N_BUCKETS; bi++) {
    const b = buckets[bi];
    if (!b || b.verts.length === 0) continue;
    stroke(b.color[0], b.color[1], b.color[2], b.color[3]);
    strokeWeight(weight);
    beginShape(POINTS);
    const list = b.verts;
    for (let i = 0; i < list.length; i++) {
      const v = list[i];
      const dx = 0.5 * (T.c1 * v.cp - T.s1 * v.sp);
      const dy = 0.5 * (T.s2 * v.cp + T.c2 * v.sp);
      const dz = 6.0 * pulse * (T.s3 * v.cp + T.c3 * v.sp);
      const X = v.x0 * sceneScale + dx;
      const Y = v.y0 * sceneScale + dy;
      const Z = (mode === 'flat' ? 0 : v.z0 * (depthAmp * 2)) + dz;
      vertex(X, Y, Z);
    }
    endShape();
  }
}

function loadPainting(src) { ready = false; loadImage(src, im => useImage(im), () => { ready = true; }); }
function useImage(im) { img = im; rebuildPoints(); ready = true; }

function rebuildPoints() {
  buckets = new Array(N_BUCKETS).fill(0).map(makeBucket);
  img.loadPixels();

  const maxW = width * 0.82, maxH = height * 0.82;
  const fit = min(maxW / img.width, maxH / img.height);

  for (let y = 0; y < img.height; y += STEP) {
    for (let x = 0; x < img.width; x += STEP) {
      const idx = 4 * (y * img.width + x);
      const r = img.pixels[idx], g = img.pixels[idx+1], b = img.pixels[idx+2], a = img.pixels[idx+3];
      if (a < 10) continue;

      const L  = (0.299*r + 0.587*g + 0.114*b) / 255;
      const z0 = 0.5 - L;

      const rb = (r < 85) ? 0 : (r < 170 ? 1 : 2);
      const gb = (g < 85) ? 0 : (g < 170 ? 1 : 2);
      const bb = (b < 85) ? 0 : (b < 170 ? 1 : 2);
      const bi = rb * 9 + gb * 3 + bb;

      const bucket = buckets[bi];
      bucket.count++; bucket.r += r; bucket.g += g; bucket.b += b; bucket.a += 230;

      const phi = random(TWO_PI);
      bucket.verts.push({
        x0: (x - img.width  / 2) * fit,
        y0: (y - img.height / 2) * fit,
        z0,
        cp: cos(phi), sp: sin(phi)
      });
    }
  }
  for (let bi = 0; bi < N_BUCKETS; bi++) {
    const b = buckets[bi];
    b.color = b.count ? [ b.r/b.count, b.g/b.count, b.b/b.count, b.a/b.count ] : [255,255,255,220];
  }
}

// ---------- presets (includes US Flag) ----------

function buildGallery() {
  return [
    { name: 'Galaxy',    img: presetGalaxy(520, 330) },
    { name: 'Mountains', img: presetMountains(520, 330) },
    { name: 'Neon Sun',  img: presetNeonSun(520, 330) },
    { name: 'US Flag',   img: presetUSFlag(520, 330) }
  ];
}

function presetGalaxy(w, h) {
  const g = createGraphics(w, h);
  g.colorMode(HSB, 360, 100, 100, 100); g.background(0); g.noStroke();
  for (let i = 0; i < 260; i++) {
    const x = random(w), y = random(h), r = random(60, 160), hue = random(200, 300);
    g.fill(hue, random(40,80), random(40,90), random(5,12)); g.ellipse(x, y, r, r);
  }
  g.strokeWeight(1);
  for (let i = 0; i < 2000; i++) {
    const x = random(w), y = random(h), br = random(60, 100);
    g.stroke(0, 0, br, 100); g.point(x, y);
    if (random() < 0.06) { g.stroke(0, 0, 100, 70); g.point(x+1, y); }
  }
  return g;
}
function presetMountains(w, h) {
  const g = createGraphics(w, h);
  g.colorMode(HSB, 360, 100, 100, 100);
  for (let y = 0; y < h; y++) { const c = g.lerpColor(g.color(210,70,30), g.color(30,80,95), y/h); g.stroke(c); g.line(0, y, w, y); }
  g.noStroke(); g.fill(40,90,100,70); g.ellipse(w*0.72, h*0.28, 110, 110);
  const ridge = (yBase,hue,sat,bri,amp,freq,step) => {
    g.noStroke(); g.fill(hue, sat, bri, 95); g.beginShape(); g.vertex(0,h);
    for (let x = 0; x <= w; x += step) {
      const yy = yBase + sin(x*freq + yBase*0.01)*amp + noise(x*0.01, yBase*0.01)*amp*0.6;
      g.vertex(x, yy);
    }
    g.vertex(w, h); g.endShape(CLOSE);
  };
  ridge(h*0.70, 210, 30, 30, 22, 0.035, 4);
  ridge(h*0.78, 220, 25, 24, 28, 0.03, 4);
  ridge(h*0.86, 225, 20, 18, 36, 0.028, 4);
  return g;
}
function presetNeonSun(w, h) {
  const g = createGraphics(w, h);
  g.colorMode(HSB, 360, 100, 100, 100); g.background(240, 30, 5);
  const cx = w*0.35, cy = h*0.45, R = 120;
  for (let i = 0; i < 18; i++) {
    const yy = cy - R + i * (R*2/18), hh = (i % 2 === 0) ? (R*2/18)*0.55 : (R*2/18)*0.25;
    g.noStroke(); g.fill(45, 90, 100, 90); g.ellipse(cx, yy, R*2, hh);
  }
  g.stroke(200, 40, 90, 60);
  for (let x = 0; x < w; x += 16) g.line(x, h*0.55, x, h);
  for (let y = h*0.55; y < h; y += 16) g.line(0, y, w, y);
  return g;
}
// US Flag (50 stars, 13 stripes; approximate spacing)
function presetUSFlag(w, h) {
  const g = createGraphics(w, h);
  g.noStroke();
  const stripeH = h / 13;
  for (let i = 0; i < 13; i++) { g.fill(i % 2 === 0 ? color(191,10,48) : color(255)); g.rect(0, i*stripeH, w, stripeH); }
  const unionW = w * 0.4, unionH = stripeH * 7;
  g.fill(0, 40, 104); g.rect(0, 0, unionW, unionH);
  g.fill(255);
  const rows = 9, cols6 = 6, cols5 = 5, mX = unionW / (cols6 + 1), mY = unionH / (rows + 1);
  for (let r = 0; r < rows; r++) {
    const cols = (r % 2 === 0) ? cols6 : cols5;
    const offsetX = (r % 2 === 0) ? mX : (mX * 1.5);
    for (let c = 0; c < cols; c++) {
      const x = offsetX + c * mX * (cols6 / cols), y = mY + r * mY;
      drawStar(g, x, y, mY * 0.35, mY * 0.15);
    }
  }
  return g;
}
function drawStar(pg, cx, cy, rOuter, rInner) {
  pg.beginShape();
  for (let i = 0; i < 10; i++) {
    const a = -PI/2 + i * PI/5;
    const r = (i % 2 === 0) ? rOuter : rInner;
    pg.vertex(cx + cos(a) * r, cy + sin(a) * r);
  }
  pg.endShape(CLOSE);
}

// ---------- HUD (compact) + scrollable preset strip ----------

function drawUI(glow) {
  hud.clear();

  const PANEL_W = 540, PANEL_H = 230;
  drawPanel(12, 12, PANEL_W, PANEL_H);

  hud.fill(255); hud.noStroke(); hud.textSize(18);
  hud.text('Point-Cloud Painter', 24, 36);

  hud.textSize(12); hud.fill(230);
  hud.text(`Mode: ${mode}`, 24, 56);
  hud.text(`STEP: ${STEP}   FPS: ${nf(avgFPS(),2,0)}   Points: ${formatInt(totalPoints())}`, 24, 74);
  hud.text(`Zoom: ${nf(sceneScale,1,2)}   Depth: ${depthAmp}   Glow: ${glow ? 'ON' : 'OFF'} (hold G)`, 24, 92);
  hud.fill(210);
  hud.text(`Drag to orbit • Keys: 1=flat, 2=depth, [ / ] quality • Presets or ➕ Try your photo`, 24, 110);

  buttons = [];
  let x = 24, y = 126, w = 90, h = 28, gap = 8;

  btn(x, y, w, h, 'Flat',   () => mode = 'flat',  mode === 'flat');   x += w + gap;
  btn(x, y, w, h, 'Depth',  () => mode = 'depth', mode === 'depth');  x += w + gap;
  btn(x, y, 120, h, 'Reset View', () => { resetCam = true; }, false);

  x = 24; y += h + gap;
  btn(x, y, 62, h, 'STEP–', () => { STEP = constrain(STEP + 1, STEP_MIN, STEP_MAX); rebuildPoints(); }, false); x += 66;
  btn(x, y, 62, h, 'STEP+', () => { STEP = constrain(STEP - 1, STEP_MIN, STEP_MAX); rebuildPoints(); }, false); x += 74;
  btn(x, y, 66, h, 'Zoom–', () => { sceneScale = max(0.40, sceneScale - 0.05); }, false); x += 70;
  btn(x, y, 66, h, 'Zoom+', () => { sceneScale = min(2.00, sceneScale + 0.05); }, false); x += 78;
  btn(x, y, 74, h, 'Depth–', () => { depthAmp = max(40, depthAmp - 10); }, false); x += 78;
  btn(x, y, 74, h, 'Depth+', () => { depthAmp = min(260, depthAmp + 10); }, false);

  x = 24; y += h + gap;
  btn(x, y, 40, h, '◄', () => { spinSpeed = max(0, spinSpeed - 0.0001); }, false); x += 46;
  btn(x, y, 40, h, '■',  () => { spinSpeed = 0; }, false);               x += 46;
  btn(x, y, 40, h, '►', () => { spinSpeed = min(0.003, spinSpeed + 0.0001); }, false);

  // --- bottom strip (scrollable) ---
  const STRIP_H = 160;
  const stripX = 12, stripY = height - STRIP_H - 12, stripW = width - 24;
  drawPanel(stripX, stripY, stripW, STRIP_H);
  hud.fill(230); hud.textSize(13);
  hud.text('Click a preset image:', stripX + 12, stripY + 24);

  stripRegion = { x: stripX, y: stripY, w: stripW, h: STRIP_H };

  thumbBoxes = []; uploadBox = null;

  // layout metrics
  const PADDING = 12, TOP = stripY + 42;
  const GAP = 16, TW = 180, TH = 104;
  const VISIBLE_LEFT = PADDING + stripX;
  const VISIBLE_RIGHT = stripX + stripW - PADDING;

  // compute total content width (upload tile + gallery)
  const contentWidth = (TW + GAP) + gallery.length * (TW + GAP);
  const visibleWidth = VISIBLE_RIGHT - VISIBLE_LEFT;
  maxThumbScroll = max(0, contentWidth - visibleWidth);
  thumbScroll = constrain(thumbScroll, 0, maxThumbScroll);

  // LEFT/RIGHT scroll buttons
  const navY = stripY + 10, navW = 36, navH = 24;
  btn(stripX + stripW - navW * 2 - 8, navY, navW, navH, '‹', () => {
    thumbScroll = constrain(thumbScroll - (TW + GAP), 0, maxThumbScroll);
  }, false);
  btn(stripX + stripW - navW - 8, navY, navW, navH, '›', () => {
    thumbScroll = constrain(thumbScroll + (TW + GAP), 0, maxThumbScroll);
  }, false);

  // upload tile (first), scrolled by thumbScroll
  let tx = VISIBLE_LEFT - thumbScroll;
  drawUploadTile(tx, TOP, TW, TH);
  uploadBox = { x: tx, y: TOP, w: TW, h: TH };
  tx += TW + GAP;

  // visible gallery thumbnails (skip drawing far off-screen)
  for (let i = 0; i < gallery.length; i++) {
    const g = gallery[i];
    if (tx + TW < VISIBLE_LEFT - 200) { tx += TW + GAP; continue; }
    if (tx > VISIBLE_RIGHT + 200) break;

    drawThumbCover(hud, g.img, tx, TOP, TW, TH);
    hud.noFill(); hud.stroke(255, 200); hud.rect(tx - 1, TOP - 1, TW + 2, TH + 2, 10);
    hud.noStroke(); hud.fill(230); hud.text(g.name, tx, TOP + TH + 14);
    thumbBoxes.push({ x: tx, y: TOP, w: TW, h: TH, idx: i });
    tx += TW + GAP;
  }
}

function drawPanel(x, y, w, h) {
  hud.noStroke(); hud.fill(10, 200); hud.rect(x + 3, y + 4, w, h, 14);
  hud.fill(22, 230); hud.rect(x, y, w, h, 14);
}

function btn(x, y, w, h, label, onClick, active) {
  const hovered = isInside(mouseX, mouseY, { x, y, w, h });
  hud.noStroke();
  hud.fill(active ? color(80, 200, 255, 240)
                  : hovered ? color(255, 255, 255, 40)
                            : color(255, 255, 255, 22));
  hud.rect(x, y, w, h, 8);
  hud.fill(255); hud.textSize(12);
  hud.textAlign(CENTER, CENTER); hud.text(label, x + w/2, y + h/2 + 1);
  hud.textAlign(LEFT, BASELINE);
  buttons.push({ x, y, w, h, onClick });
}

function drawUploadTile(x, y, w, h) {
  hud.noStroke(); hud.fill(255, 255, 255, 22); hud.rect(x, y, w, h, 12);
  hud.fill(255, 255, 255, 40); hud.rect(x+2, y+2, w-4, h-4, 10);
  hud.fill(255); hud.textAlign(CENTER, CENTER); hud.textSize(36); hud.text('➕', x + w/2, y + h/2 - 8);
  hud.textSize(12); hud.fill(230); hud.text('Try your photo', x + w/2, y + h/2 + 24);
  hud.textAlign(LEFT, BASELINE);
}

// correct order: image(img, dx, dy, dW, dH, sx, sy, sW, sH)
function drawThumbCover(pg, imgRef, dx, dy, dw, dh) {
  if (!imgRef || !imgRef.width || !imgRef.height) { pg.noStroke(); pg.fill(40); pg.rect(dx, dy, dw, dh, 10); return; }
  const sw = imgRef.width, sh = imgRef.height;
  const targetAR = dw / dh, sourceAR = sw / sh;
  let sx = 0, sy = 0, sW = sw, sH = sh;
  if (sourceAR > targetAR) { sH = sh; sW = sh * targetAR; sx = (sw - sW) / 2; }
  else { sW = sw; sH = sw / targetAR; sy = (sh - sH) / 2; }
  pg.image(imgRef, dx, dy, dw, dh, sx, sy, sW, sH);
}

function drawHUD(msg) { hud.clear(); drawPanel(12, 12, 560, 86); hud.fill(255); hud.textSize(15); hud.text(msg, 24, 62); }

function blitHUD() {
  push();
  resetMatrix();
  camera(0, 0, (height/2) / tan(PI/6), 0, 0, 0, 0, 1, 0);
  ortho(-width/2, width/2, -height/2, height/2, 0, 1000);
  drawingContext.disable(drawingContext.DEPTH_TEST);
  image(hud, -width/2, -height/2);
  drawingContext.enable(drawingContext.DEPTH_TEST);
  pop();
}

// ---------- input / hit-testing ----------

function mousePressed() {
  const mx = mouseX, my = mouseY;

  // upload
  if (uploadBox && isInside(mx, my, uploadBox)) { pickerDom?.elt?.click?.(); return; }

  // buttons (includes scroll chevrons)
  for (const b of buttons) if (isInside(mx, my, b)) { b.onClick(); return; }

  // thumbs (account for scroll—boxes already positioned with scroll applied)
  for (const t of thumbBoxes)
    if (mx >= t.x && mx <= t.x + t.w && my >= t.y && my <= t.y + t.h) { useImage(gallery[t.idx].img); return; }
}

function mouseWheel(e) {
  if (stripRegion && isInside(mouseX, mouseY, stripRegion)) {
    thumbScroll = constrain(thumbScroll + e.delta, 0, maxThumbScroll);
    return false; // prevent page scroll
  }
}

function keyPressed() {
  if (key === '1') mode = 'flat';
  if (key === '2') mode = 'depth';
  if (key === '[') { STEP = constrain(STEP + 1, STEP_MIN, STEP_MAX); rebuildPoints(); }
  if (key === ']') { STEP = constrain(STEP - 1, STEP_MIN, STEP_MAX); rebuildPoints(); }
}

function isInside(mx, my, r) { return mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h; }
function pointerOverUI() {
  for (const b of buttons) if (isInside(mouseX, mouseY, b)) return true;
  if (uploadBox && isInside(mouseX, mouseY, uploadBox)) return true;
  if (stripRegion && isInside(mouseX, mouseY, stripRegion)) return true;
  for (const t of thumbBoxes)
    if (mouseX >= t.x && mouseX <= t.x + t.w && mouseY >= t.y && mouseY <= t.y + t.h) return true;
  return false;
}

// ---------- perf helpers ----------
function trackFPS() { fpsWindow.push(frameRate()); if (fpsWindow.length > 30) fpsWindow.shift(); if (adjustCooldown > 0) adjustCooldown--; }
function avgFPS() { if (fpsWindow.length === 0) return 60; let s = 0; for (let i=0;i<fpsWindow.length;i++) s += fpsWindow[i]; return s / fpsWindow.length; }
function autoAdjustQuality() {
  if (adjustCooldown > 0) return;
  const fps = avgFPS();
  if (fps < 40 && STEP < STEP_MAX) { STEP++; rebuildPoints(); adjustCooldown = 45; }
  else if (fps > 58 && STEP > STEP_MIN) { STEP--; rebuildPoints(); adjustCooldown = 45; }
}
function totalPoints() { let n = 0; for (let i = 0; i < buckets.length; i++) if (buckets[i]) n += buckets[i].verts.length; return n; }
function formatInt(n) { return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function makeBucket() { return { count:0, r:0, g:0, b:0, a:0, color:null, verts:[] }; }
