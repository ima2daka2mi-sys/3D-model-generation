// Low-poly procedural models in the proposal's illustration style:
// animals, the customizable avatar, buildings, furniture and props.
import * as THREE from 'three';
export { dog, animateDog, cat, fox, avatar, animateAvatar, AVATAR_OPTIONS, DEFAULT_LOOK } from './characters.js';

const cache = new Map();
/** Flat-shaded material, cached by colour. */
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!cache.has(key)) {
    cache.set(key, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, ...opts }));
  }
  return cache.get(key);
}

export function mesh(geo, color, opts) {
  const m = new THREE.Mesh(geo, typeof color === 'object' && color.isMaterial ? color : mat(color, opts));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

const box = (w, h, d, c) => mesh(new THREE.BoxGeometry(w, h, d), c);
const ball = (r, c, wd = 7, hd = 5) => mesh(new THREE.SphereGeometry(r, wd, hd), c);
const cyl = (rt, rb, h, c, s = 7) => mesh(new THREE.CylinderGeometry(rt, rb, h, s), c);
const cone = (r, h, c, s = 6) => mesh(new THREE.ConeGeometry(r, h, s), c);

function at(o, x, y, z, rx = 0, ry = 0, rz = 0) {
  o.position.set(x, y, z);
  o.rotation.set(rx, ry, rz);
  return o;
}

/* ------------------------------------------------------------------ */
/* Animals                                                              */
/* ------------------------------------------------------------------ */

function legs(g, color, w, l, h, r = 0.05) {
  for (const [x, z] of [[-w, -l], [w, -l], [-w, l], [w, l]]) {
    g.add(at(cyl(r, r * 0.9, h, color, 5), x, h / 2, z));
  }
}

/** Holstein cow, ~2 m long. Faces +Z. */
export function cow() {
  const g = new THREE.Group();
  g.add(at(box(0.8, 0.7, 1.6, 0xf4f2ee), 0, 0.95, 0));
  for (const [x, y, z, s] of [[0.41, 1.0, 0.2, 0.35], [-0.41, 0.9, -0.3, 0.4], [-0.41, 1.05, 0.45, 0.3]]) {
    g.add(at(box(0.02 + (x ? 0 : s), x ? s : 0.02, s, 0x222222), x, y, z));
  }
  legs(g, 0xf4f2ee, 0.3, 0.6, 0.6, 0.08);
  const head = new THREE.Group();
  head.add(box(0.42, 0.42, 0.5, 0x222222));
  head.add(at(box(0.36, 0.22, 0.12, 0xe8b4a8), 0, -0.1, 0.28));
  for (const s of [-1, 1]) {
    head.add(at(cone(0.04, 0.16, 0xe9e1c8, 4), s * 0.2, 0.26, -0.05, 0, 0, -s * 0.6));
    head.add(at(box(0.14, 0.06, 0.08, 0x222222), s * 0.27, 0.12, -0.05));
    head.add(at(ball(0.03, 0xffffff, 4, 3), s * 0.12, 0.06, 0.25));
  }
  g.add(at(head, 0, 1.3, 0.95));
  g.add(at(ball(0.12, 0xe8b4a8, 5, 4), 0, 0.58, -0.4));
  g.userData.head = head;
  return g;
}

/** Spiky germ / virus particle (doc's blue low-poly virus). */
export function germ(r = 0.15) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.IcosahedronGeometry(r, 0), 0x2f7fe0, { emissive: 0x0b2a5a }));
  const ico = new THREE.IcosahedronGeometry(1, 0).attributes.position;
  for (let i = 0; i < ico.count; i += 3) {
    const v = new THREE.Vector3(ico.getX(i), ico.getY(i), ico.getZ(i)).normalize();
    const s = cone(r * 0.18, r * 0.7, 0x1e5fb8, 4);
    s.position.copy(v.clone().multiplyScalar(r * 1.1));
    s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v);
    g.add(s);
  }
  return g;
}

/* ------------------------------------------------------------------ */
/* Avatar                                                               */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Vegetation                                                           */
/* ------------------------------------------------------------------ */

/** Collects tree placements, then builds them as a few instanced meshes. */
export class Forest {
  constructor() {
    this.round = [];
    this.pine = [];
    this.bush = [];
  }
  tree(x, z, s = 1, kind = 'round') {
    (kind === 'pine' ? this.pine : this.round).push([x, z, s]);
  }
  shrub(x, z, s = 1) {
    this.bush.push([x, z, s]);
  }
  build(seed = 1) {
    let r = seed;
    const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    const g = new THREE.Group();
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const greens = [0x4f9a3f, 0x5fae49, 0x3f8a3a, 0x6dbb55].map((c) => new THREE.Color(c));
    const inst = (geo, material, list, fn, colored) => {
      if (!list.length) return;
      const im = new THREE.InstancedMesh(geo, material, list.length);
      list.forEach((it, i) => {
        fn(it, i);
        im.setMatrixAt(i, m4);
        if (colored) im.setColorAt(i, greens[Math.floor(rnd() * greens.length)]);
      });
      im.castShadow = im.receiveShadow = true;
      im.computeBoundingSphere();
      g.add(im);
    };
    const trunkGeo = new THREE.CylinderGeometry(0.12, 0.18, 1, 6).translate(0, 0.5, 0);
    const all = [...this.round, ...this.pine];
    inst(trunkGeo, mat(0x7a5532), all, ([x, z, sc]) => m4.compose(p.set(x, 0, z), q.identity(), s.set(sc, 1.6 * sc, sc)));
    const leaf = mat(0xffffff);
    const roundGeo = new THREE.IcosahedronGeometry(1, 1);
    const blobs = [];
    for (const [x, z, sc] of this.round) {
      blobs.push([x, 2.3 * sc, z, 1.25 * sc]);
      blobs.push([x + 0.55 * sc, 1.9 * sc, z + 0.2 * sc, 0.85 * sc]);
      blobs.push([x - 0.5 * sc, 2.0 * sc, z - 0.3 * sc, 0.9 * sc]);
    }
    inst(roundGeo, leaf, blobs, ([x, y, z, sc]) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6);
      m4.compose(p.set(x, y, z), q, s.set(sc, sc * 0.85, sc));
    }, true);
    const pineGeo = new THREE.ConeGeometry(1, 2.2, 7);
    const tiers = [];
    for (const [x, z, sc] of this.pine) for (let k = 0; k < 3; k++) tiers.push([x, (1.8 + k * 0.9) * sc, z, (1.3 - k * 0.3) * sc]);
    inst(pineGeo, mat(0x2f7a45), tiers, ([x, y, z, sc]) => m4.compose(p.set(x, y, z), q.identity(), s.set(sc, sc, sc)));
    inst(roundGeo, leaf, this.bush, ([x, z, sc]) => m4.compose(p.set(x, 0.3 * sc, z), q.identity(), s.set(0.6 * sc, 0.45 * sc, 0.6 * sc)), true);
    return g;
  }
}

/* ------------------------------------------------------------------ */
/* Buildings & props                                                    */
/* ------------------------------------------------------------------ */

/** Gabled house, footprint w x d, door on +Z. */
export function house({ w = 6, d = 5, h = 3, wall = 0xf2ece0, roof = 0x5a6478 } = {}) {
  const g = new THREE.Group();
  g.add(at(box(w, h, d, wall), 0, h / 2, 0));
  const shape = new THREE.Shape([new THREE.Vector2(-w / 2 - 0.3, 0), new THREE.Vector2(w / 2 + 0.3, 0), new THREE.Vector2(0, h * 0.6)]);
  const roofGeo = new THREE.ExtrudeGeometry(shape, { depth: d + 0.6, bevelEnabled: false });
  roofGeo.translate(0, 0, -(d + 0.6) / 2);
  g.add(at(mesh(roofGeo, roof), 0, h, 0));
  g.add(at(box(1, 2, 0.08, 0x6b4a32), 0, 1, d / 2 + 0.03));
  for (const s of [-1, 1]) {
    g.add(at(box(1.1, 0.9, 0.06, 0xbfe0f2), s * w * 0.3, 1.8, d / 2 + 0.03));
    g.add(at(box(0.06, 0.9, 1.1, 0xbfe0f2), s * (w / 2 + 0.03), 1.8, 0));
  }
  return g;
}

export function barn() {
  const g = new THREE.Group();
  g.add(at(box(7, 4, 6, 0xb83a32), 0, 2, 0));
  const shape = new THREE.Shape([new THREE.Vector2(-3.8, 0), new THREE.Vector2(3.8, 0), new THREE.Vector2(0, 2.4)]);
  const roofGeo = new THREE.ExtrudeGeometry(shape, { depth: 6.6, bevelEnabled: false }).translate(0, 0, -3.3);
  g.add(at(mesh(roofGeo, 0x4a4f5a), 0, 4, 0));
  g.add(at(box(2.6, 3, 0.1, 0xf4efe6), 0, 1.5, 3.02));
  g.add(at(box(2.2, 2.6, 0.12, 0x8a2e28), 0, 1.4, 3.05));
  const silo = new THREE.Group();
  silo.add(at(cyl(1.3, 1.3, 7, 0xd8d2c6, 12), 0, 3.5, 0));
  silo.add(at(mesh(new THREE.SphereGeometry(1.3, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0xb83a32), 0, 7, 0));
  g.add(at(silo, -5, 0, -1));
  return g;
}

export function fence(len, color = 0xb88a5a) {
  const g = new THREE.Group();
  const n = Math.max(2, Math.round(len / 2));
  for (let i = 0; i <= n; i++) g.add(at(box(0.12, 1, 0.12, color), -len / 2 + (len / n) * i, 0.5, 0));
  g.add(at(box(len, 0.08, 0.06, color), 0, 0.75, 0));
  g.add(at(box(len, 0.08, 0.06, color), 0, 0.4, 0));
  return g;
}

export function bench() {
  const g = new THREE.Group();
  g.add(at(box(1.6, 0.08, 0.45, 0xb8865a), 0, 0.45, 0));
  g.add(at(box(1.6, 0.4, 0.06, 0xb8865a), 0, 0.7, -0.2));
  for (const s of [-1, 1]) g.add(at(box(0.08, 0.45, 0.45, 0x3a3f48), s * 0.7, 0.22, 0));
  return g;
}

export function streetLight() {
  const g = new THREE.Group();
  g.add(at(cyl(0.06, 0.08, 3.6, 0x2f3540), 0, 1.8, 0));
  g.add(at(ball(0.2, 0xfff6d8, 6, 4), 0, 3.7, 0));
  return g;
}

export function stump() {
  const g = new THREE.Group();
  g.add(at(cyl(0.35, 0.42, 0.5, 0x8a6038, 8), 0, 0.25, 0));
  g.add(at(cyl(0.33, 0.33, 0.02, 0xd8b98a, 8), 0, 0.51, 0));
  return g;
}

export function trash() {
  const g = new THREE.Group();
  g.add(at(ball(0.35, 0xe8e8e8, 6, 4), 0, 0.3, 0));
  g.add(at(ball(0.28, 0x3a3a3a, 6, 4), 0.55, 0.25, 0.2));
  const tire = mesh(new THREE.TorusGeometry(0.3, 0.11, 5, 10), 0x2a2a2a);
  g.add(at(tire, -0.5, 0.12, 0.3, Math.PI / 2));
  return g;
}

export function slide() {
  const g = new THREE.Group();
  g.add(at(box(0.9, 0.1, 2.6, 0xe85a4f), 0, 0.9, 0.6, -0.55));
  g.add(at(box(0.9, 1.6, 0.9, 0x3f8fd0), 0, 0.8, -0.9));
  g.add(at(cone(0.7, 0.6, 0xf2c94c, 4), 0, 1.9, -0.9, 0, Math.PI / 4));
  return g;
}

export function sofa(color = 0x6f7f96) {
  const g = new THREE.Group();
  g.add(at(box(2, 0.45, 0.85, color), 0, 0.22, 0));
  g.add(at(box(2, 0.5, 0.2, color), 0, 0.65, -0.33));
  for (const s of [-1, 1]) g.add(at(box(0.2, 0.3, 0.85, color), s * 0.9, 0.55, 0));
  return g;
}

export function table(w = 1.2, d = 0.7, h = 0.72, color = 0xb8865a) {
  const g = new THREE.Group();
  g.add(at(box(w, 0.06, d, color), 0, h, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(at(box(0.06, h, 0.06, color), sx * (w / 2 - 0.08), h / 2, sz * (d / 2 - 0.08)));
  return g;
}

export function roundTable(color = 0xb8865a) {
  const g = new THREE.Group();
  g.add(at(cyl(0.45, 0.45, 0.05, color, 12), 0, 0.72, 0));
  g.add(at(cyl(0.05, 0.05, 0.7, 0x3a3f48, 6), 0, 0.36, 0));
  g.add(at(cyl(0.25, 0.25, 0.03, 0x3a3f48, 10), 0, 0.02, 0));
  return g;
}

export function chair(color = 0x2f6b4f) {
  const g = new THREE.Group();
  g.add(at(box(0.45, 0.05, 0.45, color), 0, 0.45, 0));
  g.add(at(box(0.45, 0.5, 0.05, color), 0, 0.7, -0.2));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(at(box(0.04, 0.45, 0.04, 0x3a3f48), sx * 0.19, 0.22, sz * 0.19));
  return g;
}

export function catTower() {
  const g = new THREE.Group();
  g.add(at(box(0.8, 0.1, 0.8, 0xc8a070), 0, 0.05, 0));
  g.add(at(cyl(0.08, 0.08, 1.8, 0xd8c0a0, 6), 0, 0.9, 0));
  for (const [y, x] of [[0.6, 0.25], [1.1, -0.25], [1.7, 0.2]]) g.add(at(box(0.5, 0.06, 0.5, 0xc8a070), x, y, 0));
  g.add(at(box(0.5, 0.35, 0.5, 0xc8a070), -0.2, 1.35, 0.1));
  return g;
}

export function tv() {
  const g = new THREE.Group();
  g.add(at(box(1.6, 0.45, 0.4, 0x8a6a4a), 0, 0.22, 0));
  g.add(at(box(1.3, 0.75, 0.05, 0x1a1d24), 0, 0.9, 0));
  return g;
}

export function cage() {
  const g = new THREE.Group();
  g.add(at(box(1, 0.05, 0.7, 0x8a6a4a), 0, 0.03, 0));
  g.add(at(box(1, 0.05, 0.7, 0x8a6a4a), 0, 0.8, 0));
  for (let i = 0; i <= 8; i++) {
    g.add(at(box(0.02, 0.8, 0.02, 0x8a6a4a), -0.5 + i * 0.125, 0.4, 0.35));
    g.add(at(box(0.02, 0.8, 0.02, 0x8a6a4a), -0.5 + i * 0.125, 0.4, -0.35));
  }
  return g;
}

export function plant(h = 1) {
  const g = new THREE.Group();
  g.add(at(cyl(0.18, 0.14, 0.35, 0xe9e2d6, 8), 0, 0.17, 0));
  g.add(at(ball(0.35 * h, 0x4f9a3f), 0, 0.55 * h + 0.2, 0));
  return g;
}

export function counter(w = 2.4) {
  const g = new THREE.Group();
  g.add(at(box(w, 1, 0.6, 0x9a7048), 0, 0.5, 0));
  g.add(at(box(w + 0.1, 0.06, 0.7, 0xe8e2d6), 0, 1.02, 0));
  return g;
}

export function sink() {
  const g = new THREE.Group();
  g.add(at(box(0.8, 0.85, 0.5, 0xf4efe6), 0, 0.42, 0));
  g.add(at(box(0.55, 0.06, 0.35, 0xd8e4ea), 0, 0.86, 0.02));
  g.add(at(cyl(0.025, 0.025, 0.3, 0xb8c0c8, 6), 0, 1.0, -0.15));
  g.add(at(box(0.6, 0.7, 0.03, 0xd8e8f0), 0, 1.55, -0.24));
  return g;
}

export function cardboardBed() {
  const g = new THREE.Group();
  g.add(at(box(0.9, 0.35, 2, 0xc89a62), 0, 0.17, 0));
  g.add(at(box(0.85, 0.06, 1.9, 0xe8e4f0), 0, 0.38, 0));
  g.add(at(box(0.5, 0.1, 0.3, 0xffffff), 0, 0.44, -0.75));
  return g;
}

export function partition(w = 2.4) {
  return at(box(w, 1.2, 0.04, 0xc89a62), 0, 0.6, 0);
}

export function hoop() {
  const g = new THREE.Group();
  g.add(at(box(1.6, 1.1, 0.05, 0xf4f4f4), 0, 3.4, 0));
  g.add(at(mesh(new THREE.TorusGeometry(0.25, 0.025, 4, 12), 0xe0602a), 0, 3, 0.3, Math.PI / 2));
  return g;
}

export function backpack() {
  const g = new THREE.Group();
  g.add(at(box(0.5, 0.6, 0.25, 0x2f5fb5), 0, 0.3, 0));
  g.add(at(box(0.42, 0.25, 0.08, 0x234a8f), 0, 0.22, 0.15));
  g.add(at(ball(0.05, 0xffffff, 5, 4), 0, 0.25, 0.2));
  return g;
}

export function foodBag() {
  const g = new THREE.Group();
  g.add(at(box(0.3, 0.42, 0.14, 0xb8864a), 0, 0.21, 0));
  g.add(at(cyl(0.06, 0.06, 0.25, 0x9fd0f0, 8), 0.3, 0.12, 0));
  g.add(at(cyl(0.06, 0.06, 0.25, 0x9fd0f0, 8), 0.45, 0.12, 0.05));
  return g;
}

export function boxes() {
  const g = new THREE.Group();
  g.add(at(box(0.6, 0.45, 0.45, 0xc89a62), 0, 0.22, 0));
  g.add(at(box(0.5, 0.4, 0.4, 0xd4aa72), 0.1, 0.65, 0, 0, 0.3));
  return g;
}
