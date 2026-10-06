// Detailed characters: the customizable avatar and dogs (shiba / beagle).
// Smooth-shaded, jointed (hips/knees, shoulders/elbows, dog legs) so they
// can walk convincingly, while staying light enough for phones.
import * as THREE from 'three';

const mats = new Map();
function smat(color, rough = 0.6, extra = {}) {
  const key = `${color}|${rough}|${JSON.stringify(extra)}`;
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, ...extra }));
  return mats.get(key);
}
function part(geo, color, rough, extra) {
  const m = new THREE.Mesh(geo, color.isMaterial ? color : smat(color, rough, extra));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
function place(o, x, y, z, rx = 0, ry = 0, rz = 0, s) {
  o.position.set(x, y, z);
  o.rotation.set(rx, ry, rz);
  if (s) o.scale.set(...s);
  return o;
}
const sphere = (r, c, ws = 16, hs = 12, rough) => part(new THREE.SphereGeometry(r, ws, hs), c, rough);
const capsule = (r, len, c, rough) => part(new THREE.CapsuleGeometry(r, len, 4, 10), c, rough);
const group = (...kids) => { const g = new THREE.Group(); kids.forEach((k) => g.add(k)); return g; };

/* ------------------------------------------------------------------ */
/* Avatar                                                               */
/* ------------------------------------------------------------------ */

export const AVATAR_OPTIONS = {
  skin: ['#f3d2b5', '#e0b08a', '#c18a5f', '#8d5b3b', '#f6e0cf'],
  hairStyle: ['ショート', 'ボブ', 'ロング', 'おだんご', 'ツンツン'],
  hairColor: ['#2b2420', '#5a3b22', '#9a6a3a', '#c9c9c9', '#3b4a7a'],
  top: ['Tシャツ', 'パーカー', 'シャツ'],
  topColor: ['#f4f4f4', '#3f6fb5', '#e0a43a', '#4f9a6a', '#c95b6b'],
  bottom: ['パンツ', 'スカート', 'ハーフパンツ'],
  bottomColor: ['#2b2f3a', '#6b7a8f', '#9a6a3a', '#38536b', '#7a4f6b'],
};

export const DEFAULT_LOOK = { skin: 0, hairStyle: 0, hairColor: 0, top: 1, topColor: 1, bottom: 0, bottomColor: 0 };

function shade(hex, k) {
  return new THREE.Color(hex).multiplyScalar(k).getHex();
}

/* Face drawn on a canvas and wrapped onto the front of the head:
   big eyes with highlights, rosy cheeks, small smile. */
const faceCache = new Map();
function faceTexture(hairHex, skinHex) {
  const key = hairHex + '|' + skinHex;
  if (faceCache.has(key)) return faceCache.get(key);
  const W = 640, H = 500; // ≈ phi 1.8 rad × theta 1.41 rad, keeps circles round
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  const brow = '#' + new THREE.Color(hairHex).multiplyScalar(0.8).getHexString();
  const cx = W / 2;
  // cheeks
  for (const s of [-1, 1]) {
    const g = x.createRadialGradient(cx + s * 150, 310, 0, cx + s * 150, 310, 62);
    g.addColorStop(0, 'rgba(255,120,130,0.55)');
    g.addColorStop(1, 'rgba(255,120,130,0)');
    x.fillStyle = g;
    x.beginPath(); x.ellipse(cx + s * 150, 310, 70, 48, 0, 0, Math.PI * 2); x.fill();
  }
  // eyes
  for (const s of [-1, 1]) {
    const ex = cx + s * 112, ey = 236;
    x.fillStyle = '#ffffff';
    x.beginPath(); x.ellipse(ex, ey, 50, 62, 0, 0, Math.PI * 2); x.fill();
    const ir = x.createLinearGradient(0, ey - 56, 0, ey + 58);
    ir.addColorStop(0, '#2a1a12'); ir.addColorStop(0.55, '#5a3420'); ir.addColorStop(1, '#a8703c');
    x.fillStyle = ir;
    x.beginPath(); x.ellipse(ex, ey + 5, 42, 56, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#140c08';
    x.beginPath(); x.ellipse(ex, ey + 8, 19, 27, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#ffffff';
    x.beginPath(); x.ellipse(ex - s * 15 - 2, ey - 18, 14, 17, 0, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.arc(ex + s * 13, ey + 28, 7, 0, Math.PI * 2); x.fill();
    // upper lid + lashes
    x.strokeStyle = '#1c120c'; x.lineCap = 'round';
    x.lineWidth = 9;
    x.beginPath(); x.ellipse(ex, ey + 2, 52, 64, 0, Math.PI * 1.12, Math.PI * 1.88); x.stroke();
    x.lineWidth = 6;
    x.beginPath(); x.moveTo(ex + s * 47, ey - 32); x.lineTo(ex + s * 66, ey - 44); x.stroke();
    // brow
    x.strokeStyle = brow; x.lineWidth = 8;
    x.beginPath(); x.arc(ex, ey - 30, 62, Math.PI * 1.35, Math.PI * 1.65); x.stroke();
  }
  // nose + mouth
  x.fillStyle = 'rgba(160,90,70,0.35)';
  x.beginPath(); x.ellipse(cx, 300, 7, 5, 0, 0, Math.PI * 2); x.fill();
  x.strokeStyle = '#a2463e'; x.lineWidth = 9; x.lineCap = 'round';
  x.beginPath(); x.arc(cx, 330, 26, Math.PI * 0.2, Math.PI * 0.8); x.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  faceCache.set(key, t);
  return t;
}

/** Cute, human-proportioned avatar (~1.45 m, big head), faces +Z. */
export function avatar(look = DEFAULT_LOOK) {
  const O = AVATAR_OPTIONS;
  const skin = new THREE.Color(O.skin[look.skin]).getHex();
  const hair = new THREE.Color(O.hairColor[look.hairColor]).getHex();
  const top = new THREE.Color(O.topColor[look.topColor]).getHex();
  const bottom = new THREE.Color(O.bottomColor[look.bottomColor]).getHex();
  const topDark = shade(top, 0.85);
  // skin with a little warmth so it never looks grey in shadow
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.65, emissive: new THREE.Color(skin).multiplyScalar(0.12) });
  const hairMat = new THREE.MeshStandardMaterial({ color: hair, roughness: 0.4, metalness: 0.05, side: THREE.DoubleSide });

  const root = new THREE.Group();
  const rig = new THREE.Group();
  root.add(rig);
  const HIP = 0.88; // adult-like proportions (~1.65 m, head ≈ 1/6.7 of height)

  /* legs: hip → knee → shoe */
  const legs = [];
  const pants = look.bottom === 0, shorts = look.bottom === 2;
  for (const s of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(s * 0.075, HIP, 0);
    hip.add(place(part(new THREE.CylinderGeometry(0.068, 0.055, 0.4, 16), pants ? bottom : skinMat), 0, -0.2, 0));
    const knee = new THREE.Group();
    knee.position.y = -0.4;
    knee.add(place(sphere(0.055, pants ? bottom : skinMat, 12, 10), 0, 0, 0));
    knee.add(place(part(new THREE.CylinderGeometry(0.052, 0.04, 0.38, 16), pants ? bottom : skinMat), 0, -0.19, 0));
    if (shorts) hip.add(place(part(new THREE.CylinderGeometry(0.08, 0.076, 0.2, 16), bottom), 0, -0.09, 0));
    if (!pants) knee.add(place(part(new THREE.CylinderGeometry(0.043, 0.042, 0.07, 14), 0xf4f4f4), 0, -0.34, 0)); // socks
    const shoe = group(
      place(sphere(0.062, 0xe85a4f, 16, 12, 0.45), 0, 0.01, 0.045, 0, 0, 0, [0.95, 0.75, 1.55]),
      place(part(new THREE.CylinderGeometry(0.064, 0.066, 0.025, 18), 0xffffff, 0.7), 0, -0.035, 0.045, 0, 0, 0, [1, 1, 1.6]),
    );
    knee.add(place(shoe, 0, -0.4, 0));
    hip.add(knee);
    rig.add(hip);
    legs.push({ hip, knee });
  }

  /* hips / skirt */
  rig.add(place(sphere(0.14, bottom, 20, 14), 0, HIP + 0.03, 0, 0, 0, 0, [1, 0.6, 0.8]));
  if (look.bottom === 1) {
    const skirt = part(new THREE.CylinderGeometry(0.135, 0.26, 0.4, 24, 1, true), bottom, 0.7, { side: THREE.DoubleSide });
    rig.add(place(skirt, 0, HIP - 0.13, 0, 0, 0, 0, [1, 1, 0.85]));
  }

  /* torso: soft rounded shape */
  const prof = [[0, 0], [0.125, 0], [0.135, 0.06], [0.13, 0.16], [0.145, 0.27], [0.15, 0.33], [0.12, 0.38], [0.06, 0.405], [0, 0.41]]
    .map(([px, py]) => new THREE.Vector2(px, py));
  const torso = part(new THREE.LatheGeometry(prof, 28), top, 0.8);
  torso.scale.set(1.08, 1.22, 0.78);
  torso.position.y = HIP + 0.02;
  rig.add(torso);
  const SH = HIP + 0.43;
  if (look.top === 0) {
    rig.add(place(part(new THREE.TorusGeometry(0.052, 0.011, 8, 22), topDark), 0, SH + 0.075, 0.0, Math.PI / 2, 0, 0, [1, 0.8, 1]));
  } else if (look.top === 1) {
    rig.add(place(sphere(0.11, topDark, 18, 12), 0, SH + 0.045, -0.085, 0, 0, 0, [1.15, 0.7, 0.75])); // hood
    rig.add(place(part(new THREE.BoxGeometry(0.17, 0.08, 0.02), topDark), 0, HIP + 0.15, 0.11, 0.1, 0, 0)); // pocket
    for (const s of [-1, 1]) {
      rig.add(place(part(new THREE.CylinderGeometry(0.004, 0.004, 0.09, 5), 0xffffff), s * 0.026, SH - 0.02, 0.1));
      rig.add(place(sphere(0.008, 0xffffff, 6, 4), s * 0.026, SH - 0.07, 0.1));
    }
  } else {
    for (const s of [-1, 1]) rig.add(place(part(new THREE.BoxGeometry(0.06, 0.01, 0.055), 0xffffff), s * 0.035, SH + 0.07, 0.05, 0.45, 0, s * 0.5));
    for (let i = 0; i < 3; i++) rig.add(place(sphere(0.007, 0xe8e2d6, 6, 4), 0, SH - 0.02 - i * 0.08, 0.112));
  }

  /* arms: shoulder → elbow → hand (sleeve hides the joints) */
  const arms = [];
  const longSleeve = look.top !== 0;
  for (const s of [-1, 1]) {
    const sh = new THREE.Group();
    sh.position.set(s * 0.172, SH, 0);
    sh.add(place(sphere(0.055, top, 16, 12), 0, -0.01, 0, 0, 0, 0, [1, 1.1, 1]));
    sh.add(place(part(new THREE.CylinderGeometry(longSleeve ? 0.05 : 0.054, longSleeve ? 0.044 : 0.05, longSleeve ? 0.28 : 0.1, 14), top), 0, longSleeve ? -0.14 : -0.05, 0));
    if (!longSleeve) sh.add(place(part(new THREE.CylinderGeometry(0.036, 0.033, 0.2, 14), skinMat), 0, -0.17, 0));
    const el = new THREE.Group();
    el.position.y = -0.28;
    el.add(place(sphere(0.036, longSleeve ? top : skinMat, 10, 8), 0, 0, 0));
    el.add(place(part(new THREE.CylinderGeometry(longSleeve ? 0.042 : 0.035, longSleeve ? 0.04 : 0.03, 0.24, 14), longSleeve ? top : skinMat), 0, -0.12, 0));
    if (longSleeve) el.add(place(part(new THREE.CylinderGeometry(0.043, 0.043, 0.025, 14), topDark), 0, -0.235, 0));
    // mitten hand + thumb
    const hand = group(
      place(sphere(0.038, skinMat, 14, 10), 0, 0, 0, 0, 0, 0, [0.8, 1.15, 0.6]),
      place(sphere(0.016, skinMat, 8, 6), -s * 0.03, 0.01, 0.018),
    );
    el.add(place(hand, 0, -0.29, 0.005));
    sh.add(el);
    rig.add(sh);
    arms.push({ sh, el, s });
  }

  /* neck & head */
  rig.add(place(part(new THREE.CylinderGeometry(0.037, 0.042, 0.1, 14), skinMat), 0, SH + 0.08, 0));
  const head = new THREE.Group();
  head.position.set(0, SH + 0.11, 0.005);
  head.scale.setScalar(0.76); // natural head size; the face stays cute
  const R = 0.155;
  const skull = part(new THREE.SphereGeometry(R, 32, 24), skinMat);
  skull.scale.set(1, 1.02, 0.98);
  skull.position.y = R * 0.95;
  head.add(skull);
  // cheeks give a softer, rounder face
  for (const s of [-1, 1]) head.add(place(sphere(0.07, skinMat, 14, 10), s * 0.075, R * 0.72, 0.075, 0, 0, 0, [1, 0.85, 0.8]));
  // face decal
  const face = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.006, 32, 20, Math.PI / 2 - 1.1, 2.2, Math.PI * 0.25, Math.PI * 0.55), // wider span = bigger features
    new THREE.MeshStandardMaterial({ map: faceTexture(hair, skin), transparent: true, roughness: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
  );
  face.scale.copy(skull.scale);
  face.position.copy(skull.position);
  head.add(face);
  // ears
  for (const s of [-1, 1]) head.add(place(sphere(0.03, skinMat, 10, 8), s * R * 0.98, R * 0.92, 0, 0, 0, 0, [0.5, 1, 0.8]));

  /* hair */
  const style = look.hairStyle;
  const hp = (geo, sx = 1.04, sy = 1.04, sz = 1.05, y = R * 0.97, z = -0.004) => {
    const m = new THREE.Mesh(geo, hairMat);
    m.castShadow = true;
    m.position.set(0, y, z);
    m.scale.set(sx, sy, sz);
    return m;
  };
  const shellBack = (thetaEnd, r = R * 1.06) => new THREE.SphereGeometry(r, 32, 16, Math.PI / 2 + 1.05, Math.PI * 2 - 2.1, 0, thetaEnd);
  head.add(hp(new THREE.SphereGeometry(R * 1.05, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5)));
  if (style !== 4) {
    // bangs: a front shell over the forehead with a soft wavy edge
    const bangs = new THREE.SphereGeometry(R * 1.075, 32, 8, Math.PI / 2 - 0.95, 1.9, Math.PI * 0.12, Math.PI * 0.27);
    const p = bangs.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const vx = p.getX(i), vy = p.getY(i);
      if (vy < R * 0.15) p.setY(i, vy - Math.abs(Math.sin(vx * 60)) * 0.012); // wavy fringe tips
    }
    bangs.computeVertexNormals();
    head.add(hp(bangs, 1.03, 1.0, 1.04, R * 0.97, 0.002));
    head.add(hp(shellBack(Math.PI * (style === 0 ? 0.66 : 0.6))));
  }
  if (style === 1) head.add(hp(shellBack(Math.PI * 0.78, R * 1.1), 1.08, 1.0, 1.06)); // bob
  if (style === 2) {
    head.add(hp(shellBack(Math.PI * 0.86, R * 1.1), 1.08, 1.35, 1.08, R * 0.82)); // long
    head.add(place(new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.16, 6, 14), hairMat), 0, -0.04, -0.08, 0, 0, 0, [1.25, 1, 0.5]));
  }
  if (style === 3) {
    head.add(place(new THREE.Mesh(new THREE.SphereGeometry(0.07, 18, 14), hairMat), 0, R * 2.05, -0.05));
    head.add(place(part(new THREE.TorusGeometry(0.05, 0.012, 8, 20), 0xff6f91, 0.5), 0, R * 1.82, -0.045, Math.PI / 2.3, 0, 0));
  }
  if (style === 4) {
    head.add(hp(shellBack(Math.PI * 0.6)));
    const spikes = [[0, 1.98, 0.02, -0.2], [0.07, 1.92, -0.03, -0.45], [-0.07, 1.92, -0.03, -0.45], [0.05, 1.9, 0.09, 0.35], [-0.05, 1.9, 0.09, 0.35], [0.0, 1.85, -0.12, -1.0], [0.12, 1.7, 0.05, 0.2], [-0.12, 1.7, 0.05, 0.2], [0, 1.82, 0.13, 0.7]];
    for (const [sx, sy, sz, rx] of spikes) {
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.13, 10), hairMat);
      sp.castShadow = true;
      head.add(place(sp, sx, R * sy * 0.6 + 0.06, sz, rx, 0, -sx * 3));
    }
  }
  rig.add(head);

  root.userData = { rig, legs, arms, head, torso, legL: legs[0].hip, legR: legs[1].hip, armL: arms[0].sh, armR: arms[1].sh };
  return root;
}

/** Walk / idle animation. phase advances with distance, t is time in seconds. */
export function animateAvatar(a, phase, moving, t = 0) {
  const { rig, legs, arms, head, torso } = a.userData;
  const s = Math.sin(phase);
  const k = moving ? 1 : 0;
  legs.forEach(({ hip, knee }, i) => {
    const sg = i === 0 ? 1 : -1;
    hip.rotation.x = -s * sg * 0.6 * k;
    knee.rotation.x = k * Math.max(0, Math.cos(phase + (i ? Math.PI : 0))) * 1.0 + 0.03;
  });
  arms.forEach(({ sh, el, s: side }, i) => {
    const sg = i === 0 ? 1 : -1;
    sh.rotation.x = s * sg * 0.55 * k + (1 - k) * Math.sin(t * 1.6 + i) * 0.04;
    sh.rotation.z = side * (0.12 + (1 - k) * 0.03);
    el.rotation.x = -(k ? 0.55 : 0.18);
  });
  rig.position.y = k ? Math.abs(Math.cos(phase)) * 0.03 : Math.sin(t * 2.2) * 0.004;
  rig.rotation.y = k ? s * 0.07 : 0;
  torso.scale.y = 1 + (1 - k) * Math.sin(t * 2.2) * 0.012;
  head.rotation.y = (1 - k) * Math.sin(t * 0.5) * 0.25;
  head.rotation.z = (1 - k) * Math.sin(t * 0.35) * 0.06; // gentle head tilt
  head.rotation.x = k ? 0.03 : Math.sin(t * 0.7) * 0.04;
}

/* ------------------------------------------------------------------ */
/* Dogs                                                                 */
/* ------------------------------------------------------------------ */

const DOGS = {
  shiba: { main: 0xd9843a, light: 0xf7ecdc, dark: 0x7a3f18, legs: 'light' },
  beagle: { main: 0xb8743a, light: 0xf7f2ea, dark: 0x2b2420, legs: 'light' },
};

function tube(points, r, color) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return part(new THREE.TubeGeometry(curve, 20, r, 8, false), color, 0.7);
}

/**
 * Dog, faces +Z, ~0.75 m long.
 * kind: 'shiba' | 'beagle'; lying: resting / sick pose; collar: red collar with ID tag.
 */
export function dog({ kind = 'shiba', lying = false, collar = true } = {}) {
  const C = DOGS[kind] || DOGS.shiba;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  // torso
  const torso = place(capsule(0.15, 0.3, C.main, 0.75), 0, 0.45, -0.02, Math.PI / 2, 0, 0, [1, 1, 1.06]);
  body.add(torso);
  body.add(place(sphere(0.13, C.light), 0, 0.4, 0.13, 0, 0, 0, [0.95, 1.02, 1.15])); // chest
  body.add(place(sphere(0.12, C.light), 0, 0.35, -0.08, 0, 0, 0, [0.9, 0.55, 1.6])); // belly
  if (kind === 'beagle') body.add(place(sphere(0.155, C.dark), 0, 0.53, -0.06, 0, 0, 0, [1.04, 0.55, 1.45])); // saddle
  // neck
  body.add(place(capsule(0.085, 0.12, C.main), 0, 0.6, 0.22, -0.65, 0, 0));
  body.add(place(sphere(0.08, C.light), 0, 0.55, 0.27, 0, 0, 0, [0.9, 1.1, 0.8]));

  // head
  const head = new THREE.Group();
  head.position.set(0, 0.73, 0.31);
  head.add(place(sphere(0.12, C.main, 20, 16), 0, 0, 0, 0, 0, 0, [1, 0.92, 1.05]));
  if (kind === 'shiba') {
    // urajiro: white cheeks + muzzle underside
    for (const s of [-1, 1]) head.add(place(sphere(0.06, C.light), s * 0.06, -0.045, 0.07, 0, 0, 0, [1, 0.8, 1]));
    for (const s of [-1, 1]) head.add(place(sphere(0.013, C.light, 8, 6), s * 0.045, 0.06, 0.098)); // brow dots
  } else {
    head.add(place(sphere(0.05, C.light, 10, 8), 0, 0.03, 0.1, 0, 0, 0, [0.55, 1.3, 0.6])); // white blaze
  }
  const muzzle = part(new THREE.CylinderGeometry(0.045, 0.068, 0.13, 16), kind === 'shiba' ? C.light : C.light, 0.7);
  head.add(place(muzzle, 0, -0.035, 0.145, Math.PI / 2, 0, 0, [1, 1, 0.85]));
  if (kind === 'shiba') head.add(place(sphere(0.046, C.main, 12, 8), 0, -0.012, 0.15, 0, 0, 0, [0.9, 0.45, 1.3])); // muzzle bridge
  head.add(place(sphere(0.024, 0x1a1414, 12, 10, 0.25), 0, -0.02, 0.215, 0, 0, 0, [1.25, 0.85, 1])); // nose
  head.add(place(part(new THREE.TorusGeometry(0.025, 0.004, 6, 10, Math.PI), 0x3a2a24), 0, -0.07, 0.19, 0, 0, Math.PI)); // mouth
  for (const s of [-1, 1]) {
    head.add(place(sphere(0.021, 0x1d1714, 12, 10, 0.15), s * 0.052, 0.025, 0.098));
    head.add(place(sphere(0.006, 0xffffff, 6, 4, 0.1), s * 0.052 + 0.006, 0.033, 0.116));
    if (kind === 'shiba') {
      const ear = new THREE.Group();
      ear.add(place(part(new THREE.ConeGeometry(0.052, 0.11, 3), C.main, 0.7), 0, 0, 0, 0, Math.PI / 6 + Math.PI, 0, [1, 1, 0.55]));
      ear.add(place(part(new THREE.ConeGeometry(0.032, 0.075, 3), 0xf3c9a8, 0.7), 0, -0.01, 0.014, 0, Math.PI / 6 + Math.PI, 0, [1, 1, 0.4]));
      head.add(place(ear, s * 0.07, 0.115, -0.005, 0.15, 0, -s * 0.28));
    } else {
      const ear = place(part(new THREE.CapsuleGeometry(0.045, 0.1, 4, 10), 0x6b3a1c, 0.75), s * 0.118, -0.045, -0.005, 0, 0, s * 0.12, [0.42, 1, 1]);
      head.add(ear);
    }
  }
  if (collar) {
    body.add(place(part(new THREE.TorusGeometry(0.088, 0.016, 8, 24), 0xc8283a, 0.5), 0, 0.6, 0.235, Math.PI / 2 - 0.65, 0, 0));
    body.add(place(part(new THREE.CylinderGeometry(0.022, 0.022, 0.006, 14), 0xe6b422, 0.3, { metalness: 0.7 }), 0, 0.53, 0.305, Math.PI / 2 - 0.3, 0, 0));
  }
  body.add(head);

  // legs: shoulder/hip → lower leg → paw
  const legs = [];
  for (const [x, z, front] of [[-0.085, 0.15, true], [0.085, 0.15, true], [-0.09, -0.2, false], [0.09, -0.2, false]]) {
    const top = new THREE.Group();
    top.position.set(x, 0.43, z);
    top.add(place(capsule(front ? 0.045 : 0.058, 0.12, C.main), 0, -0.08, front ? 0 : -0.01));
    const low = new THREE.Group();
    low.position.y = -0.18;
    low.add(place(capsule(0.036, 0.13, C.light), 0, -0.08, 0));
    low.add(place(sphere(0.044, C.light, 12, 8), 0, -0.2, 0.02, 0, 0, 0, [1, 0.55, 1.3]));
    top.add(low);
    body.add(top);
    legs.push({ top, low, front });
  }

  // tail (pivot at the base)
  const tail = new THREE.Group();
  tail.position.set(0, 0.53, -0.3);
  if (kind === 'shiba') {
    tail.add(tube([[0, 0, 0], [0, 0.09, -0.05], [0, 0.17, -0.01], [0, 0.17, 0.07], [0, 0.11, 0.1]], 0.038, C.main));
    tail.add(place(sphere(0.04, C.light, 10, 8), 0, 0.11, 0.1));
  } else {
    tail.add(tube([[0, 0, 0], [0, 0.11, -0.06], [0, 0.22, -0.08]], 0.025, C.main));
    tail.add(place(sphere(0.03, C.light, 10, 8), 0, 0.23, -0.08, 0, 0, 0, [1, 1.4, 1]));
  }
  body.add(tail);

  if (lying) {
    // resting pose: body on the floor, front legs forward, head on the paws
    body.position.y = -0.24;
    legs.forEach(({ top, low, front }, i) => {
      if (front) { top.rotation.x = -1.45; low.rotation.x = 0.1; top.position.y = 0.43; }
      else { top.rotation.z = (i === 2 ? -1 : 1) * 1.2; top.rotation.x = -0.5; }
    });
    head.position.set(0, 0.58, 0.4);
    head.rotation.x = 0.25;
    tail.rotation.x = 1.4;
  }

  root.userData = { head, tail, legs, body, lying, kind };
  return root;
}

/** Trot cycle for a standing dog. */
export function animateDog(d, t, moving, phase = t * 8) {
  const { legs, body, head, tail, lying } = d.userData;
  if (lying) {
    body.scale.y = 1 + Math.sin(t * 1.6) * 0.02; // breathing
    return;
  }
  const k = moving ? 1 : 0;
  legs.forEach(({ top, low }, i) => {
    const diag = i === 0 || i === 3 ? 1 : -1; // diagonal pairs move together
    const s = Math.sin(phase) * diag;
    top.rotation.x = s * 0.55 * k;
    low.rotation.x = k * Math.max(0, -s) * 0.7 * (i < 2 ? -1 : 1);
  });
  body.position.y = k * Math.abs(Math.sin(phase)) * 0.02;
  head.rotation.x = k ? Math.sin(phase * 2) * 0.04 : Math.sin(t * 0.8) * 0.05;
  head.rotation.y = k ? 0 : Math.sin(t * 0.45) * 0.35;
  tail.rotation.z = Math.sin(t * (moving ? 12 : 7)) * 0.35;
}

/* ------------------------------------------------------------------ */
/* Cat & fox (cute, big-headed)                                         */
/* ------------------------------------------------------------------ */

/** Big shiny eye: iris + pupil (slit for cats) + highlights. */
function eye(r, iris, slit = false) {
  const g = new THREE.Group();
  g.add(place(sphere(r, iris, 14, 12, 0.2), 0, 0, 0, 0, 0, 0, [1, 1.1, 0.6]));
  g.add(place(sphere(r * 0.62, 0x120c0a, 12, 10, 0.15), 0, 0, r * 0.32, 0, 0, 0, slit ? [0.38, 1.2, 0.5] : [1, 1.1, 0.5]));
  g.add(place(sphere(r * 0.3, 0xffffff, 8, 6, 0.1), r * 0.3, r * 0.38, r * 0.5));
  g.add(place(sphere(r * 0.13, 0xffffff, 6, 4, 0.1), -r * 0.3, -r * 0.35, r * 0.55));
  return g;
}

function lum(hex) {
  const c = new THREE.Color(hex);
  return 0.3 * c.r + 0.59 * c.g + 0.11 * c.b;
}

/** Cat, ~0.45 m long, faces +Z. color: coat, belly: chest/paws. */
export function cat({ color = 0xc08a55, belly = 0xfaf3ea } = {}) {
  const root = new THREE.Group();
  const stripe = shade(color, 0.62);
  const tabby = lum(color) > 0.18 && lum(color) < 0.75;

  root.add(place(capsule(0.095, 0.14, color, 0.8), 0, 0.2, -0.02, Math.PI / 2, 0, 0, [1, 0.95, 1]));
  root.add(place(sphere(0.085, belly, 14, 10), 0, 0.18, 0.07, 0, 0, 0, [0.9, 0.9, 1]));
  if (tabby) for (let i = 0; i < 3; i++) {
    root.add(place(part(new THREE.TorusGeometry(0.097, 0.012, 6, 16, Math.PI), stripe), 0, 0.2, -0.08 + i * 0.065, 0, Math.PI / 2, 0));
  }
  // legs with white paws
  for (const [x, z] of [[-0.05, 0.08], [0.05, 0.08], [-0.055, -0.1], [0.055, -0.1]]) {
    root.add(place(capsule(0.03, 0.08, color), x, 0.1, z));
    root.add(place(sphere(0.034, belly, 10, 8), x, 0.03, z + 0.012, 0, 0, 0, [1, 0.6, 1.25]));
  }
  // head
  const head = new THREE.Group();
  head.position.set(0, 0.34, 0.14);
  head.add(place(sphere(0.115, color, 22, 18), 0, 0, 0, 0, 0, 0, [1.12, 0.96, 1]));
  for (const s of [-1, 1]) head.add(place(sphere(0.05, belly, 12, 10), s * 0.035, -0.045, 0.075, 0, 0, 0, [1, 0.8, 0.9])); // muzzle puffs
  head.add(place(sphere(0.016, 0xf08a9a, 10, 8, 0.3), 0, -0.02, 0.112, 0, 0, 0, [1.2, 0.8, 1])); // nose
  // ω mouth
  for (const s of [-1, 1]) head.add(place(part(new THREE.TorusGeometry(0.012, 0.0035, 6, 10, Math.PI), 0x6b3a32), s * 0.012, -0.045, 0.118, 0, 0, Math.PI));
  for (const s of [-1, 1]) {
    head.add(place(eye(0.034, 0x9ccf5a, true), s * 0.055, 0.02, 0.085, 0, s * 0.25, 0));
    // ears with pink inside
    const ear = new THREE.Group();
    ear.add(part(new THREE.ConeGeometry(0.052, 0.085, 14), color, 0.7));
    ear.add(place(part(new THREE.ConeGeometry(0.032, 0.06, 12), 0xf6b8c0, 0.6), 0, -0.008, 0.02, 0, 0, 0, [1, 1, 0.5]));
    head.add(place(ear, s * 0.068, 0.09, -0.005, 0.1, 0, -s * 0.32));
    // whiskers
    for (const k of [-1, 1]) {
      head.add(place(part(new THREE.CylinderGeometry(0.0015, 0.0015, 0.09, 4), 0xffffff, 0.4), s * 0.085, -0.03 + k * 0.012, 0.09, 0, 0, Math.PI / 2 + s * k * 0.15));
    }
  }
  if (tabby) for (let i = -1; i <= 1; i++) head.add(place(part(new THREE.BoxGeometry(0.008, 0.035, 0.01), stripe), i * 0.022, 0.07, 0.092, -0.5, 0, i * 0.2));
  root.add(head);
  // tail: soft S-curve, pivot at the base
  const tail = new THREE.Group();
  tail.position.set(0, 0.22, -0.15);
  tail.add(tube([[0, 0, 0], [0, 0.06, -0.08], [0, 0.17, -0.1], [0, 0.25, -0.05]], 0.022, color));
  tail.add(place(sphere(0.024, tabby ? stripe : color, 8, 6), 0, 0.25, -0.05));
  root.add(tail);
  root.userData = { head, tail };
  return root;
}

/** Red fox, ~0.7 m long, faces +Z. thin: starving variant. */
export function fox({ thin = false } = {}) {
  const orange = 0xe2722e, white = 0xfbf4ea, dark = 0x2e221c;
  const root = new THREE.Group();
  const bw = thin ? 0.72 : 1;
  root.add(place(capsule(0.12, 0.28, orange, 0.8), 0, 0.38, -0.02, Math.PI / 2, 0, 0, [bw, thin ? 0.85 : 1, 1]));
  root.add(place(sphere(0.1, white, 14, 10), 0, 0.36, 0.15, 0, 0, 0, [0.9 * bw, 1.05, 1.1]));
  for (const [x, z] of [[-0.065, 0.13], [0.065, 0.13], [-0.07, -0.17], [0.07, -0.17]]) {
    root.add(place(capsule(0.035, 0.12, orange), x * bw, 0.27, z));
    root.add(place(capsule(0.03, 0.12, dark), x * bw, 0.1, z)); // black "stockings"
    root.add(place(sphere(0.034, dark, 10, 8), x * bw, 0.025, z + 0.015, 0, 0, 0, [1, 0.6, 1.3]));
  }
  // head
  const head = new THREE.Group();
  head.position.set(0, 0.56, 0.27);
  head.add(place(sphere(0.115, orange, 22, 18), 0, 0, 0, 0, 0, 0, [1.12, 0.95, 1]));
  for (const s of [-1, 1]) head.add(place(sphere(0.06, white, 12, 10), s * 0.07, -0.05, 0.03, 0, 0, s * 0.4, [1.3, 0.75, 0.9])); // cheek fluff
  head.add(place(sphere(0.05, white, 16, 12), 0, -0.04, 0.1, 0, 0, 0, [0.95, 0.75, 1.35])); // rounded muzzle
  head.add(place(sphere(0.04, orange, 14, 10), 0, -0.012, 0.095, 0, 0, 0, [0.85, 0.55, 1.35])); // muzzle bridge
  head.add(place(sphere(0.018, 0x161010, 10, 8, 0.25), 0, -0.028, 0.163, 0, 0, 0, [1.2, 0.85, 1]));
  for (const s of [-1, 1]) head.add(place(part(new THREE.TorusGeometry(0.01, 0.003, 6, 10, Math.PI), 0x4a3028), s * 0.01, -0.06, 0.155, 0, 0, Math.PI)); // smile
  for (const s of [-1, 1]) {
    head.add(place(eye(0.036, thin ? 0x8a5a2a : 0xc8902a), s * 0.052, 0.022, 0.085, 0, s * 0.3, 0));
    const ear = new THREE.Group();
    ear.add(part(new THREE.ConeGeometry(0.06, 0.13, 14), orange, 0.7));
    ear.add(place(part(new THREE.ConeGeometry(0.038, 0.09, 12), white, 0.7), 0, -0.01, 0.022, 0, 0, 0, [1, 1, 0.45]));
    ear.add(place(part(new THREE.ConeGeometry(0.018, 0.03, 12), dark, 0.7), 0, 0.052, 0));
    head.add(place(ear, s * 0.07, 0.11, -0.01, 0.05, 0, -s * 0.28));
  }
  if (thin) head.rotation.x = 0.12; // droops a little when hungry
  root.add(head);
  // big fluffy tail with a white tip, pivot at the base
  const tail = new THREE.Group();
  tail.position.set(0, 0.42, -0.2);
  // held low and back, like a real fox
  tail.add(place(capsule(0.085, 0.2, orange, 0.85), 0, -0.1, -0.15, -2.1, 0, 0, [thin ? 0.75 : 1, 1, 1]));
  tail.add(place(sphere(0.072, white, 12, 10), 0, -0.24, -0.27, 0, 0, 0, [thin ? 0.75 : 1, 1.2, 1]));
  root.add(tail);
  root.userData = { head, tail };
  return root;
}

/** Cute Holstein calf-style cow, ~1.7 m long, faces +Z. */
export function cow() {
  const white = 0xfbf8f2, black = 0x2a2626, pink = 0xf4b6b4;
  const root = new THREE.Group();
  // body
  root.add(place(capsule(0.36, 0.75, white, 0.85), 0, 0.92, 0, Math.PI / 2, 0, 0, [1.05, 0.95, 1]));
  // black patches hugging the body
  for (const [x, y, z, sx, sy, sz] of [[0.3, 1.05, 0.25, 0.12, 0.22, 0.3], [-0.32, 0.95, -0.3, 0.1, 0.25, 0.32], [0.18, 1.22, -0.35, 0.22, 0.08, 0.24], [-0.25, 1.15, 0.4, 0.14, 0.15, 0.18], [0.33, 0.85, -0.45, 0.08, 0.16, 0.14]]) {
    root.add(place(sphere(1, black, 14, 10), x, y, z, 0, 0, 0, [sx, sy, sz]));
  }
  // legs with hooves
  for (const [x, z] of [[-0.2, 0.42], [0.2, 0.42], [-0.2, -0.42], [0.2, -0.42]]) {
    root.add(place(capsule(0.085, 0.42, white), x, 0.4, z));
    root.add(place(part(new THREE.CylinderGeometry(0.085, 0.09, 0.09, 14), 0x6b5a4a, 0.6), x, 0.045, z));
  }
  root.add(place(sphere(0.12, pink, 12, 10), 0, 0.6, -0.3, 0, 0, 0, [1.1, 0.7, 1])); // udder
  // collar + bell
  root.add(place(part(new THREE.TorusGeometry(0.2, 0.025, 8, 24), 0xd23a3a, 0.5), 0, 1.0, 0.62, Math.PI / 2 - 0.5, 0, 0));
  root.add(place(sphere(0.06, 0xf2c23a, 14, 10, 0.25), 0, 0.82, 0.74));
  // head: big, round, with a wide pink muzzle
  const head = new THREE.Group();
  head.position.set(0, 1.28, 0.78);
  head.add(place(sphere(0.27, white, 24, 18), 0, 0, 0, 0, 0, 0, [1.05, 1, 0.95]));
  head.add(place(sphere(0.12, black, 14, 10), 0.13, 0.1, 0.12, 0, 0, 0, [1, 1.1, 0.9])); // eye patch
  head.add(place(sphere(0.2, pink, 20, 14, 0.5), 0, -0.13, 0.17, 0, 0, 0, [1.05, 0.72, 0.85]));
  for (const s of [-1, 1]) {
    head.add(place(sphere(0.026, 0x8a4a4a, 10, 8), s * 0.07, -0.1, 0.33, 0, 0, 0, [1, 0.7, 0.5])); // nostrils
    head.add(place(eye(0.05, 0x3a2418), s * 0.11, 0.06, 0.22, 0, s * 0.35, 0));
    // floppy ears + little horns
    head.add(place(capsule(0.06, 0.1, white), s * 0.3, 0.08, -0.02, 0, 0, s * 1.2, [1, 1, 0.5]));
    head.add(place(sphere(0.045, pink, 10, 8), s * 0.31, 0.07, 0.01, 0, 0, s * 1.2, [0.7, 1.2, 0.35]));
    head.add(place(part(new THREE.ConeGeometry(0.035, 0.1, 10), 0xf1e6c8, 0.5), s * 0.15, 0.25, -0.04, 0, 0, -s * 0.5));
  }
  // smile + blush
  head.add(place(part(new THREE.TorusGeometry(0.05, 0.007, 6, 16, Math.PI), 0x8a4a4a), 0, -0.17, 0.3, 0, 0, Math.PI));
  for (const s of [-1, 1]) head.add(place(sphere(0.035, 0xff9aa2, 10, 8, 0.6), s * 0.2, -0.02, 0.19, 0, 0, 0, [1, 0.6, 0.4]));
  root.add(head);
  // tail with tuft
  const tail = new THREE.Group();
  tail.position.set(0, 1.12, -0.72);
  tail.add(tube([[0, 0, 0], [0, -0.15, -0.06], [0, -0.4, -0.05]], 0.022, white));
  tail.add(place(sphere(0.05, black, 10, 8), 0, -0.43, -0.05, 0, 0, 0, [1, 1.4, 1]));
  root.add(tail);
  root.userData = { head, tail };
  return root;
}
