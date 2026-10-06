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

/** Stylised avatar (~1.6 m), faces +Z. */
export function avatar(look = DEFAULT_LOOK) {
  const O = AVATAR_OPTIONS;
  const skin = new THREE.Color(O.skin[look.skin]).getHex();
  const hair = new THREE.Color(O.hairColor[look.hairColor]).getHex();
  const top = new THREE.Color(O.topColor[look.topColor]).getHex();
  const bottom = new THREE.Color(O.bottomColor[look.bottomColor]).getHex();
  const topDark = shade(top, 0.82);

  const root = new THREE.Group();
  const rig = new THREE.Group(); // bobs while walking
  root.add(rig);

  /* legs (hip → knee → foot) */
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(s * 0.085, 0.86, 0);
    const pants = look.bottom === 0;
    const shorts = look.bottom === 2;
    hip.add(place(capsule(0.072, 0.26, pants ? bottom : skin), 0, -0.19, 0));
    if (shorts) hip.add(place(capsule(0.083, 0.12, bottom), 0, -0.1, 0));
    const knee = new THREE.Group();
    knee.position.y = -0.4;
    knee.add(place(capsule(0.06, 0.26, pants ? bottom : skin), 0, -0.18, 0));
    if (pants) knee.add(place(part(new THREE.CylinderGeometry(0.068, 0.066, 0.05, 14), shade(bottom, 0.85)), 0, -0.34, 0));
    // shoe with a white sole
    const shoe = group(
      place(part(new THREE.CapsuleGeometry(0.058, 0.12, 4, 10), 0x2b3440, 0.5), 0, 0, 0, Math.PI / 2, 0, 0, [1, 1, 0.75]),
      place(part(new THREE.BoxGeometry(0.11, 0.025, 0.24), 0xf4f4f4, 0.7), 0, -0.04, 0.0),
    );
    knee.add(place(shoe, 0, -0.4, 0.035));
    hip.add(knee);
    rig.add(hip);
    legs.push({ hip, knee });
  }

  /* pelvis / skirt */
  rig.add(place(sphere(0.15, bottom), 0, 0.9, 0, 0, 0, 0, [1, 0.62, 0.78]));
  if (look.bottom === 1) {
    const skirt = part(new THREE.CylinderGeometry(0.15, 0.29, 0.42, 20, 1, true), bottom, 0.7, { side: THREE.DoubleSide });
    rig.add(place(skirt, 0, 0.71, 0, 0, 0, 0, [1, 1, 0.82]));
  }

  /* torso (lathe profile, flattened front-to-back) */
  const prof = [[0.0, 0], [0.135, 0], [0.15, 0.08], [0.163, 0.2], [0.172, 0.32], [0.16, 0.4], [0.11, 0.46], [0.05, 0.49], [0, 0.49]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const torso = part(new THREE.LatheGeometry(prof, 24), top, 0.75);
  torso.scale.set(1, 1, 0.74);
  torso.position.y = 0.9;
  rig.add(torso);
  // details per top
  if (look.top === 0) {
    rig.add(place(part(new THREE.TorusGeometry(0.06, 0.012, 8, 20), topDark), 0, 1.385, 0.0, Math.PI / 2, 0, 0, [1, 0.75, 1]));
  } else if (look.top === 1) {
    // hoodie: hood behind the neck, pouch pocket, drawstrings
    rig.add(place(sphere(0.12, topDark, 16, 10), 0, 1.36, -0.09, 0, 0, 0, [1.1, 0.75, 0.75]));
    rig.add(place(part(new THREE.BoxGeometry(0.2, 0.09, 0.03), topDark), 0, 1.02, 0.12));
    for (const s of [-1, 1]) rig.add(place(part(new THREE.CylinderGeometry(0.005, 0.005, 0.11, 5), 0xf4f4f4), s * 0.03, 1.28, 0.12));
  } else {
    // shirt: collar wings + buttons
    for (const s of [-1, 1]) rig.add(place(part(new THREE.BoxGeometry(0.07, 0.012, 0.06), 0xffffff), s * 0.04, 1.375, 0.06, 0.4, 0, s * 0.5));
    for (let i = 0; i < 4; i++) rig.add(place(sphere(0.008, 0xe8e2d6, 6, 4), 0, 1.3 - i * 0.09, 0.123));
  }

  /* arms (shoulder → elbow → hand) */
  const arms = [];
  const longSleeve = look.top !== 0;
  for (const s of [-1, 1]) {
    const sh = new THREE.Group();
    sh.position.set(s * 0.2, 1.31, 0);
    sh.rotation.z = s * 0.1;
    sh.add(place(sphere(0.062, top), 0, 0, 0));
    sh.add(place(capsule(0.05, 0.16, longSleeve ? top : skin), 0, -0.14, 0));
    if (!longSleeve) sh.add(place(capsule(0.06, 0.06, top), 0, -0.06, 0));
    const el = new THREE.Group();
    el.position.y = -0.28;
    el.add(place(capsule(0.043, 0.15, longSleeve ? top : skin), 0, -0.11, 0));
    if (longSleeve) el.add(place(part(new THREE.CylinderGeometry(0.048, 0.048, 0.03, 12), topDark), 0, -0.2, 0));
    el.add(place(sphere(0.047, skin, 12, 10), 0, -0.26, 0.005, 0, 0, 0, [0.8, 1.1, 0.65]));
    sh.add(el);
    rig.add(sh);
    arms.push({ sh, el, s });
  }

  /* neck & head */
  rig.add(place(part(new THREE.CylinderGeometry(0.045, 0.05, 0.1, 12), skin), 0, 1.41, 0));
  const head = new THREE.Group();
  head.position.set(0, 1.44, 0.005);
  head.scale.setScalar(1.14);
  head.add(place(sphere(0.125, skin, 24, 18, 0.55), 0, 0.13, 0, 0, 0, 0, [1, 1.08, 1.02]));
  // ears
  for (const s of [-1, 1]) head.add(place(sphere(0.026, skin, 10, 8), s * 0.124, 0.12, 0, 0, 0, 0, [0.5, 1, 0.8]));
  // eyes: white, iris, highlight
  for (const s of [-1, 1]) {
    head.add(place(sphere(0.021, 0xffffff, 12, 10, 0.3), s * 0.045, 0.135, 0.108, 0, 0, 0, [1, 1.15, 0.55]));
    head.add(place(sphere(0.0135, 0x2a1f1a, 12, 10, 0.2), s * 0.045, 0.133, 0.118));
    head.add(place(sphere(0.0045, 0xffffff, 6, 4, 0.1), s * 0.045 + 0.004, 0.139, 0.13));
    head.add(place(part(new THREE.BoxGeometry(0.042, 0.008, 0.01), hair), s * 0.046, 0.172, 0.115, 0, 0, -s * 0.12));
  }
  head.add(place(sphere(0.011, shade(skin, 0.92), 8, 6), 0, 0.105, 0.128, 0, 0, 0, [1, 0.9, 1]));
  const smile = part(new THREE.TorusGeometry(0.02, 0.0045, 6, 12, Math.PI * 0.8), 0xb5534d, 0.5);
  head.add(place(smile, 0, 0.083, 0.118, 0, 0, Math.PI + Math.PI * 0.1));

  /* hair */
  const capGeo = new THREE.SphereGeometry(0.135, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.52);
  const style = look.hairStyle;
  head.add(place(part(capGeo, hair, 0.45), 0, 0.14, -0.006, 0, 0, 0, [1.02, style === 4 ? 0.95 : 1.12, 1.06]));
  // back/side coverage (open at the face): phi measured around Y, front is phi = π/2
  const shell = (thetaStart, thetaLen, r = 0.14, sy = 1) => place(part(
    new THREE.SphereGeometry(r, 24, 12, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9, thetaStart, thetaLen), hair, 0.45, { side: THREE.DoubleSide },
  ), 0, 0.14, -0.005, 0, 0, 0, [1.02, sy, 1.04]);
  if (style !== 4) {
    // fringe
    for (const [x, rz, w] of [[-0.06, 0.5, 1.2], [0.0, 0.25, 1.35], [0.065, -0.15, 1.15]]) {
      head.add(place(sphere(0.05, hair, 16, 10, 0.45), x, 0.205, 0.085, -0.35, 0, rz, [w, 0.55, 0.55]));
    }
    head.add(shell(Math.PI * 0.45, Math.PI * 0.2));
  }
  if (style === 1) head.add(shell(Math.PI * 0.5, Math.PI * 0.3, 0.15)); // bob
  if (style === 2) {
    head.add(shell(Math.PI * 0.5, Math.PI * 0.42, 0.15, 1.5)); // long
    head.add(place(part(new THREE.CapsuleGeometry(0.1, 0.18, 4, 10), hair, 0.45), 0, -0.04, -0.07, 0, 0, 0, [1.3, 1, 0.45]));
  }
  if (style === 3) {
    head.add(place(sphere(0.065, hair, 14, 10, 0.45), 0, 0.3, -0.06));
    head.add(place(part(new THREE.TorusGeometry(0.045, 0.01, 6, 16), 0xe0506a), 0, 0.27, -0.05, Math.PI / 2.4, 0, 0));
  }
  if (style === 4) {
    // spiky
    const spikes = [[0, 0.29, 0, -0.3], [0.07, 0.27, -0.02, -0.4], [-0.07, 0.27, -0.02, -0.4], [0.04, 0.26, 0.07, 0.3], [-0.04, 0.26, 0.07, 0.3], [0, 0.25, -0.1, -0.9], [0.1, 0.22, 0.04, 0.1], [-0.1, 0.22, 0.04, 0.1]];
    for (const [x, y, z, rx] of spikes) {
      head.add(place(part(new THREE.ConeGeometry(0.04, 0.12, 6), hair, 0.45), x, y, z, rx, 0, -x * 3));
    }
    head.add(shell(Math.PI * 0.45, Math.PI * 0.14));
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
    const swing = s * sg;
    hip.rotation.x = -swing * 0.55 * k;
    knee.rotation.x = k * Math.max(0, Math.cos(phase + (i ? Math.PI : 0))) * 0.9 + 0.02;
  });
  arms.forEach(({ sh, el, s: side }, i) => {
    const sg = i === 0 ? 1 : -1;
    sh.rotation.x = s * sg * 0.5 * k + (1 - k) * Math.sin(t * 1.6 + i) * 0.03;
    sh.rotation.z = side * (0.1 + (1 - k) * 0.02);
    el.rotation.x = -(k ? 0.45 : 0.12);
  });
  rig.position.y = k ? Math.abs(Math.cos(phase)) * 0.035 : 0;
  rig.rotation.y = k ? s * 0.06 : 0;
  torso.scale.y = 1 + (1 - k) * Math.sin(t * 2.2) * 0.012;
  head.rotation.y = (1 - k) * Math.sin(t * 0.5) * 0.25;
  head.rotation.x = k ? 0.04 : Math.sin(t * 0.7) * 0.04;
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
