// Procedural canvas textures for the VDWC gallery.
// Everything is generated at runtime so the project has no binary assets.
import * as THREE from 'three';
import { Q } from './quality.js';

export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(c, { repeat, srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

const FONT = '"Helvetica Neue", "Segoe UI", "Hiragino Sans", "Noto Sans JP", Arial, sans-serif';

/* ------------------------------------------------------------------ */
/* City scenes (panel images + panorama backdrop)                      */
/* ------------------------------------------------------------------ */

function drawSky(ctx, w, h, top = '#6fa8dc', bottom = '#e8f1f8') {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function drawMountains(ctx, w, baseY, maxH, color, r, roughness = 1) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, baseY);
  let y = baseY - maxH * (0.4 + r() * 0.4);
  const step = w / 60;
  for (let x = 0; x <= w + step; x += step) {
    y += (r() - 0.5) * maxH * 0.35 * roughness;
    y = Math.min(baseY - maxH * 0.15, Math.max(baseY - maxH, y));
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, baseY);
  ctx.closePath();
  ctx.fill();
}

function drawBuilding(ctx, x, baseY, bw, bh, r, tint) {
  const shade = 150 + Math.floor(r() * 80);
  const blue = Math.min(255, shade + 25);
  ctx.fillStyle = tint || `rgb(${shade - 20},${shade},${blue})`;
  ctx.fillRect(x, baseY - bh, bw, bh);
  // sunlit edge
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(x, baseY - bh, bw * 0.35, bh);
  // windows
  if (bw > 6) {
    ctx.fillStyle = 'rgba(40,70,110,0.35)';
    const rows = Math.floor(bh / 5);
    for (let i = 1; i < rows; i++) {
      ctx.fillRect(x + 1, baseY - bh + i * 5, bw - 2, 1.2);
    }
  }
  // crown
  if (r() < 0.25) {
    ctx.fillStyle = `rgb(${shade + 20},${shade + 30},${blue + 20})`;
    ctx.fillRect(x + bw * 0.3, baseY - bh - bh * 0.08, bw * 0.4, bh * 0.08);
  }
}

function drawTreeBlob(ctx, x, y, s, r) {
  const greens = ['#3f7d3a', '#4f8f45', '#2f6a35', '#5d9c4f'];
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = greens[Math.floor(r() * greens.length)];
    ctx.beginPath();
    ctx.arc(x + (r() - 0.5) * s, y - r() * s * 0.6, s * (0.4 + r() * 0.4), 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A small illustrated "design proposal" image: city, water, parks. */
export function drawCityScene(ctx, w, h, seed, variant = 0) {
  const r = rng(seed * 7919 + 13);
  drawSky(ctx, w, h * 0.62, variant % 2 ? '#8bb8e0' : '#5f9bd3', '#eef4f8');
  // clouds
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  for (let i = 0; i < 6; i++) {
    const cx = r() * w, cy = r() * h * 0.25;
    for (let j = 0; j < 4; j++) {
      ctx.beginPath();
      ctx.ellipse(cx + j * w * 0.02, cy + (r() - 0.5) * 6, w * 0.03, h * 0.02, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const horizon = h * (0.55 + r() * 0.08);
  drawMountains(ctx, w, horizon, h * 0.25, '#9fb6c9', r);
  drawMountains(ctx, w, horizon, h * 0.14, '#7f9db3', r);
  // skyline
  let x = -10;
  while (x < w) {
    const bw = w * (0.02 + r() * 0.04);
    const centre = 1 - Math.abs(x / w - 0.5) * 1.3;
    const bh = h * (0.08 + r() * 0.3 * Math.max(0.2, centre));
    drawBuilding(ctx, x, horizon, bw, bh, r);
    x += bw + r() * w * 0.01;
  }
  // water or green ground
  const water = variant % 3 !== 2;
  const g = ctx.createLinearGradient(0, horizon, 0, h);
  if (water) {
    g.addColorStop(0, '#6f9fc4');
    g.addColorStop(1, '#2f6f9f');
  } else {
    g.addColorStop(0, '#8fb776');
    g.addColorStop(1, '#4f8a45');
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, horizon, w, h - horizon);
  if (water) {
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    for (let i = 0; i < 40; i++) {
      ctx.fillRect(r() * w, horizon + r() * (h - horizon), w * 0.03 * r(), 1.5);
    }
  }
  // feature: bridge / ring / greenway depending on variant
  ctx.strokeStyle = '#f4f4f4';
  ctx.lineWidth = Math.max(2, h * 0.012);
  if (variant % 4 === 0) {
    ctx.beginPath();
    ctx.moveTo(0, horizon + h * 0.12);
    ctx.quadraticCurveTo(w * 0.5, horizon - h * 0.02, w, horizon + h * 0.1);
    ctx.stroke();
    ctx.lineWidth = 1;
    for (let i = 1; i < 12; i++) {
      const px = (w / 12) * i;
      ctx.beginPath();
      ctx.moveTo(px, horizon + h * 0.02 + Math.abs(i - 6) * h * 0.012);
      ctx.lineTo(px, horizon + h * 0.2);
      ctx.stroke();
    }
  } else if (variant % 4 === 1) {
    ctx.beginPath();
    ctx.ellipse(w * 0.5, horizon + h * 0.2, w * 0.28, h * 0.07, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (variant % 4 === 3) {
    ctx.fillStyle = '#d9e4ea';
    ctx.beginPath();
    ctx.moveTo(w * 0.1, h);
    ctx.lineTo(w * 0.45, horizon + 4);
    ctx.lineTo(w * 0.55, horizon + 4);
    ctx.lineTo(w * 0.9, h);
    ctx.fill();
  }
  // foreground trees
  for (let i = 0; i < 14; i++) {
    drawTreeBlob(ctx, r() * w, h - r() * h * 0.08, h * (0.05 + r() * 0.06), r);
  }
}

export function panoramaTexture(seed = 3) {
  const W = 4096, H = 1024;
  const [c, ctx] = canvas(W * Q.panoScale, H * Q.panoScale);
  ctx.scale(Q.panoScale, Q.panoScale);
  const r = rng(seed);
  ctx.clearRect(0, 0, W, H);
  const horizon = H * 0.9;
  // far mountains (hazy)
  drawMountains(ctx, W, horizon, H * 0.42, 'rgba(160,184,204,1)', r, 1.2);
  drawMountains(ctx, W, horizon, H * 0.3, 'rgba(126,156,182,1)', r, 1.1);
  drawMountains(ctx, W, horizon, H * 0.16, 'rgba(96,130,108,1)', r, 0.8);
  // skyline clusters
  const clusters = [0.12, 0.36, 0.62, 0.85];
  for (const cx of clusters) {
    const spread = W * (0.07 + r() * 0.05);
    let x = cx * W - spread;
    while (x < cx * W + spread) {
      const bw = 14 + r() * 38;
      const d = 1 - Math.abs(x - cx * W) / spread;
      const bh = H * (0.05 + r() * 0.5 * d * d + 0.05 * d);
      drawBuilding(ctx, x, horizon, bw, bh, r);
      x += bw + r() * 8;
    }
  }
  // low-rise city in between
  for (let x = 0; x < W; x += 10 + r() * 20) {
    drawBuilding(ctx, x, horizon, 10 + r() * 24, H * (0.02 + r() * 0.05), r);
  }
  // waterfront trees
  for (let i = 0; i < 260; i++) drawTreeBlob(ctx, r() * W, horizon + 2, 6 + r() * 10, r);
  // water band
  const g = ctx.createLinearGradient(0, horizon, 0, H);
  g.addColorStop(0, '#7fa9c8');
  g.addColorStop(1, '#4f86b0');
  ctx.fillStyle = g;
  ctx.fillRect(0, horizon, W, H - horizon);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  for (let i = 0; i < 300; i++) ctx.fillRect(r() * W, horizon + r() * (H - horizon), 20 * r(), 1.5);
  const t = toTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(2, 1);
  return t;
}

export function skyTexture() {
  const [c, ctx] = canvas(16, 512);
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#3f7fc4');
  g.addColorStop(0.35, '#79aee0');
  g.addColorStop(0.5, '#dbe9f5');
  g.addColorStop(1, '#dbe9f5');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 16, 512);
  return toTexture(c);
}

/* ------------------------------------------------------------------ */
/* Exhibition panel face                                               */
/* ------------------------------------------------------------------ */

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y);
      line = w;
      y += lh;
    } else line = test;
  }
  ctx.fillText(line, x, y);
}

function button(ctx, x, y, w, h, label) {
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#1f3a5f';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#1f3a5f';
  ctx.font = `600 ${h * 0.45}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2 + 1);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

/** 3.0 m x 2.4 m panel -> 1500 x 1200 px */
export function panelTexture(entry) {
  const W = 1500, H = 1200;
  const [c, ctx] = canvas(Math.round(W * Q.texScale), Math.round(H * Q.texScale));
  ctx.scale(Q.texScale, Q.texScale);
  ctx.fillStyle = '#fbfbf9';
  ctx.fillRect(0, 0, W, H);

  // number
  ctx.fillStyle = '#16233a';
  ctx.font = `700 150px ${FONT}`;
  ctx.fillText(entry.no, 70, 190);
  ctx.fillStyle = '#b8955a';
  ctx.fillRect(74, 215, 120, 6);

  // main image
  const ix = 300, iy = 60, iw = 1130, ih = 700;
  ctx.save();
  ctx.beginPath();
  ctx.rect(ix, iy, iw, ih);
  ctx.clip();
  ctx.translate(ix, iy);
  drawCityScene(ctx, iw, ih, entry.seed, entry.seed);
  ctx.restore();
  ctx.strokeStyle = '#d8d8d4';
  ctx.lineWidth = 2;
  ctx.strokeRect(ix, iy, iw, ih);

  // left column meta
  ctx.fillStyle = '#6b7686';
  ctx.font = `500 30px ${FONT}`;
  ctx.fillText('TEAM', 74, 300);
  ctx.fillStyle = '#16233a';
  ctx.font = `600 34px ${FONT}`;
  wrapText(ctx, entry.team, 74, 344, 200, 40);
  ctx.fillStyle = '#6b7686';
  ctx.font = `500 30px ${FONT}`;
  ctx.fillText('COUNTRY', 74, 470);
  ctx.fillStyle = '#16233a';
  ctx.font = `600 34px ${FONT}`;
  ctx.fillText(entry.country, 74, 514);

  // title + summary
  ctx.fillStyle = '#16233a';
  ctx.font = `700 64px ${FONT}`;
  ctx.fillText(entry.title, 70, 860);
  ctx.fillStyle = '#4a5566';
  ctx.font = `400 34px ${FONT}`;
  wrapText(ctx, entry.summary, 72, 920, 900, 46);

  // thumbnail strip
  for (let k = 0; k < 2; k++) {
    const tx = 1030 + k * 205, ty = 800, tw = 190, th = 120;
    ctx.save();
    ctx.beginPath();
    ctx.rect(tx, ty, tw, th);
    ctx.clip();
    ctx.translate(tx, ty);
    drawCityScene(ctx, tw, th, entry.seed + 100 + k, entry.seed + k + 1);
    ctx.restore();
  }

  // buttons
  button(ctx, 1030, 960, 395, 56, '▶ PLAY MOVIE');
  button(ctx, 1030, 1030, 395, 56, 'VIEW DETAILS');
  button(ctx, 1030, 1100, 395, 56, '3D VIEW');

  return toTexture(c);
}

/* ------------------------------------------------------------------ */
/* Materials                                                           */
/* ------------------------------------------------------------------ */

export function stoneTexture(repeat = [1, 1], seed = 11, tile = true) {
  const S = 1024;
  const [c, ctx] = canvas(S, S);
  const r = rng(seed);
  ctx.fillStyle = '#e9e4da';
  ctx.fillRect(0, 0, S, S);
  // speckle
  const img = ctx.getImageData(0, 0, S, S);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (r() - 0.5) * 14;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  // soft veins
  ctx.strokeStyle = 'rgba(150,140,125,0.10)';
  for (let v = 0; v < 18; v++) {
    ctx.lineWidth = 1 + r() * 3;
    ctx.beginPath();
    let x = r() * S, y = r() * S;
    ctx.moveTo(x, y);
    for (let k = 0; k < 20; k++) {
      x += (r() - 0.3) * 60;
      y += (r() - 0.5) * 60;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  if (tile) {
    ctx.strokeStyle = 'rgba(120,110,95,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, S, S);
    ctx.beginPath();
    ctx.moveTo(S / 2, 0); ctx.lineTo(S / 2, S);
    ctx.moveTo(0, S / 2); ctx.lineTo(S, S / 2);
    ctx.stroke();
  }
  return toTexture(c, { repeat });
}

export function woodTexture(repeat = [1, 1]) {
  const W = 512, H = 128;
  const [c, ctx] = canvas(W, H);
  const r = rng(5);
  ctx.fillStyle = '#b98a58';
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 90; i++) {
    ctx.strokeStyle = `rgba(${90 + r() * 40},${55 + r() * 30},${25 + r() * 20},${0.15 + r() * 0.25})`;
    ctx.lineWidth = 0.5 + r() * 2;
    ctx.beginPath();
    const y = r() * H;
    ctx.moveTo(0, y);
    for (let x = 0; x <= W; x += 32) ctx.lineTo(x, y + Math.sin(x * 0.02 + i) * 3 + (r() - 0.5) * 2);
    ctx.stroke();
  }
  return toTexture(c, { repeat });
}

export function mosaicTexture(repeat = [1, 1]) {
  const S = 512;
  const [c, ctx] = canvas(S, S);
  const r = rng(21);
  const n = 16, s = S / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const l = 45 + r() * 18;
      ctx.fillStyle = `hsl(${198 + r() * 12},65%,${l}%)`;
      ctx.fillRect(i * s + 1, j * s + 1, s - 2, s - 2);
    }
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.strokeRect(0, 0, S, S);
  return toTexture(c, { repeat });
}

export function waterNormalTexture() {
  const S = 256;
  const [c, ctx] = canvas(S, S);
  const img = ctx.createImageData(S, S);
  const waves = [];
  const r = rng(42);
  for (let i = 0; i < 7; i++) {
    const a = r() * Math.PI * 2;
    const f = (1 + Math.floor(r() * 5)) * 2 * Math.PI / S;
    waves.push([Math.cos(a) * f, Math.sin(a) * f, r() * 6.28, 0.3 + r()]);
  }
  // integer frequencies keep the tile seamless
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let dx = 0, dy = 0;
      for (const [kx, ky, p, amp] of waves) {
        const kxi = Math.round(kx * S / (2 * Math.PI)) * 2 * Math.PI / S;
        const kyi = Math.round(ky * S / (2 * Math.PI)) * 2 * Math.PI / S;
        const cph = Math.cos(kxi * x + kyi * y + p) * amp;
        dx += cph * kxi * 12;
        dy += cph * kyi * 12;
      }
      const i = (y * S + x) * 4;
      img.data[i] = 128 + dx * 127;
      img.data[i + 1] = 128 + dy * 127;
      img.data[i + 2] = 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(c, { repeat: [4, 4], srgb: false });
}

/** Equirectangular earth-like pattern: glowing continents + graticule. */
export function globeTexture() {
  const W = 1024, H = 512;
  const [c, ctx] = canvas(W, H);
  ctx.clearRect(0, 0, W, H);
  // Rough continent silhouettes (lon, lat pairs in degrees)
  const continents = [
    [[-165, 65], [-140, 70], [-95, 72], [-60, 60], [-55, 48], [-80, 25], [-97, 17], [-83, 9], [-105, 22], [-118, 33], [-125, 48], [-150, 58]],
    [[-80, 10], [-60, 8], [-35, -7], [-40, -22], [-58, -38], [-70, -54], [-75, -40], [-72, -18], [-81, -4]],
    [[-10, 36], [10, 37], [32, 31], [43, 12], [51, 11], [40, -15], [32, -30], [20, -35], [12, -18], [9, 4], [-8, 5], [-17, 15]],
    [[-10, 44], [0, 50], [10, 58], [25, 70], [60, 70], [100, 76], [140, 72], [175, 66], [160, 58], [140, 50], [122, 38], [120, 22], [106, 10], [98, 16], [80, 8], [72, 20], [58, 24], [48, 30], [35, 36], [26, 40], [12, 44], [-2, 36]],
    [[113, -22], [122, -18], [136, -12], [146, -18], [153, -28], [146, -39], [131, -32], [115, -34]],
    [[-50, 60], [-25, 70], [-20, 80], [-60, 82], [-72, 76]],
    [[130, 32], [140, 36], [142, 42], [138, 34]],
  ];
  const px = (lon, lat) => [((lon + 180) / 360) * W, ((90 - lat) / 180) * H];
  ctx.fillStyle = 'rgba(210,235,255,0.85)';
  ctx.strokeStyle = 'rgba(255,255,255,1)';
  ctx.lineWidth = 2;
  for (const poly of continents) {
    ctx.beginPath();
    poly.forEach(([lo, la], i) => {
      const [x, y] = px(lo, la);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // graticule
  ctx.strokeStyle = 'rgba(200,225,255,0.45)';
  ctx.lineWidth = 1.2;
  for (let lon = -180; lon <= 180; lon += 20) {
    const [x] = px(lon, 0);
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let lat = -80; lat <= 80; lat += 20) {
    const [, y] = px(0, lat);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  return toTexture(c);
}

/* ------------------------------------------------------------------ */
/* Text / signage                                                      */
/* ------------------------------------------------------------------ */

/**
 * lines: [{ text, size, weight, color, font, spacing, gap }]
 * Returns a texture with transparent (or `bg`) background.
 */
export function textTexture(lines, { w = 1024, h = 512, bg = null, align = 'center', pad = 40, valign = 'middle' } = {}) {
  const [c, ctx] = canvas(w, h);
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
  }
  const total = lines.reduce((s, l) => s + l.size * (l.lh || 1.2) + (l.gap || 0), 0);
  let y = valign === 'top' ? pad : (h - total) / 2;
  ctx.textBaseline = 'top';
  for (const l of lines) {
    y += l.gap || 0;
    ctx.fillStyle = l.color || '#fff';
    ctx.font = `${l.italic ? 'italic ' : ''}${l.weight || 400} ${l.size}px ${l.font || FONT}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${l.spacing || 0}px`;
    ctx.textAlign = align;
    const x = align === 'center' ? w / 2 : align === 'left' ? pad : w - pad;
    ctx.fillText(l.text, x, y);
    y += l.size * (l.lh || 1.2);
  }
  return toTexture(c);
}

export function trophyVoteTexture() {
  const W = 1024, H = 640;
  const [c, ctx] = canvas(W, H);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1b2c4d');
  g.addColorStop(1, '#101c33');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // trophy
  ctx.fillStyle = '#e7edf5';
  const cx = W / 2;
  ctx.beginPath();
  ctx.moveTo(cx - 70, 80);
  ctx.lineTo(cx + 70, 80);
  ctx.quadraticCurveTo(cx + 70, 200, cx, 220);
  ctx.quadraticCurveTo(cx - 70, 200, cx - 70, 80);
  ctx.fill();
  ctx.lineWidth = 12;
  ctx.strokeStyle = '#e7edf5';
  ctx.beginPath(); ctx.arc(cx - 78, 125, 32, Math.PI * 0.5, Math.PI * 1.5); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx + 78, 125, 32, -Math.PI * 0.5, Math.PI * 0.5); ctx.stroke();
  ctx.fillRect(cx - 12, 215, 24, 40);
  ctx.fillRect(cx - 55, 255, 110, 22);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 150px ${FONT}`;
  ctx.fillText('VOTE', cx, 310);
  ctx.font = `400 52px ${FONT}`;
  ctx.fillText('for a Better Tomorrow.', cx, 480);
  return toTexture(c);
}

export function screenTexture(i) {
  const W = 512, H = 320;
  const [c, ctx] = canvas(W, H);
  ctx.fillStyle = '#0d2a4a';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#e8f2ff';
  ctx.font = `700 34px ${FONT}`;
  ctx.fillText(['SELECT YOUR FAVOURITE', 'CAST YOUR VOTE', 'RESULTS'][i % 3], 24, 50);
  for (let k = 0; k < 5; k++) {
    const y = 90 + k * 42;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(24, y, W - 48, 32);
    ctx.fillStyle = '#4fb3ff';
    ctx.fillRect(24, y, (W - 48) * (0.3 + ((k * 37 + i * 13) % 60) / 100), 32);
    ctx.fillStyle = '#fff';
    ctx.font = `600 20px ${FONT}`;
    ctx.fillText(String(k * 2 + 1 + (i % 2)).padStart(2, '0'), 34, y + 23);
  }
  return toTexture(c);
}
