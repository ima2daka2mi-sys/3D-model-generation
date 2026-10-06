// Hub & spoke world (doc section 4): an entrance plaza (hub) with three
// theme areas (spokes) — A. ワンヘルスの理念, B. 人獣共通感染症対策, C. ペットの災害対策.
import * as THREE from 'three';
import * as M from './models.js';
import { ZONES, SCENARIOS } from './content.js';

const FONT = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", "Helvetica Neue", Arial, sans-serif';

export const HUB_R = 15;
export const ZONE_DIST = 48;
export const ZONE_HW = 22; // half width (local x)
export const ZONE_HD = 18; // half depth (local z); entry side is local +z
// Spoke angles: A straight ahead (north), B south-east, C south-west.
const ANGLES = { A: 0, B: (2 * Math.PI) / 3, C: (-2 * Math.PI) / 3 };

/* ---------------- canvas helpers ---------------- */

export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Board with text lines: [{ t, size, weight, color }] */
export function signTexture(lines, { w = 1024, h = 512, bg = '#ffffff', border = null, radius = 40 } = {}) {
  return canvasTexture(w, h, (ctx) => {
    ctx.fillStyle = bg;
    roundRect(ctx, 0, 0, w, h, radius);
    ctx.fill();
    if (border) {
      ctx.lineWidth = 16;
      ctx.strokeStyle = border;
      roundRect(ctx, 8, 8, w - 16, h - 16, radius);
      ctx.stroke();
    }
    const total = lines.reduce((s, l) => s + l.size * 1.3, 0);
    let y = (h - total) / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const l of lines) {
      ctx.fillStyle = l.color || '#1d2733';
      ctx.font = `${l.weight || 700} ${l.size}px ${FONT}`;
      ctx.fillText(l.t, w / 2, y + l.size * 0.15, w - 60);
      y += l.size * 1.3;
    }
  });
}

/** Trouble mark (red burst + "!") or tip mark (blue "Tips"). */
function markTexture(kind) {
  return canvasTexture(256, 256, (ctx) => {
    const c = 128;
    if (kind === 'tip') {
      ctx.fillStyle = '#1f6fd1';
      ctx.beginPath();
      ctx.arc(c, c, 100, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 12;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = `800 64px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Tips', c, c + 4);
      return;
    }
    ctx.beginPath();
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const r = i % 2 ? 72 : 118;
      ctx.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fillStyle = '#e0322a';
    ctx.fill();
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#1a1a1a';
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = `900 120px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', c, c + 6);
  });
}

/* ---------------- world ---------------- */

export function buildWorld(scene) {
  const W = {
    walkable: [], // { kind:'circle', x, z, r } | { kind:'obb', x, z, hw, hd, rot }
    solids: [], // same shapes, blocking
    marks: [], // { scenario, sprite, base:Vector3, anchor:Object3D|null, done }
    zones: {}, // id -> { center, rot, group, gate }
    animals: [], // per-frame updaters
    anchors: {}, // spot -> Object3D (moving characters)
    river: null,
  };
  const forest = new M.Forest();
  const tex = { trouble: markTexture('trouble'), tip: markTexture('tip') };

  /* ---------- ground & sky ---------- */
  scene.background = new THREE.Color(0xbfe3f7);
  scene.fog = new THREE.Fog(0xcfe8f5, 80, 230);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(260, 48), M.mat(0x8cc56a));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.name = 'Ground';
  scene.add(ground);
  W.ground = ground;
  // distant low-poly hills
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + 0.2;
    const r = 150 + (i % 3) * 25;
    const h = 25 + ((i * 37) % 30);
    const hill = M.mesh(new THREE.ConeGeometry(30 + (i % 4) * 8, h, 7), i % 2 ? 0x6fa95a : 0x7fb768);
    hill.position.set(Math.sin(a) * r, h / 2 - 2, -Math.cos(a) * r);
    hill.castShadow = false;
    scene.add(hill);
  }

  /* ---------- hub (entrance plaza) ---------- */
  const hub = new THREE.Group();
  hub.name = 'EntrancePlaza';
  scene.add(hub);
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(HUB_R, 64), M.mat(0xe9e1d0));
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0.02;
  plaza.receiveShadow = true;
  hub.add(plaza);
  for (const [r0, r1, c] of [[4.2, 4.6, 0xc9b48a], [9, 9.3, 0xc9b48a], [HUB_R - 0.4, HUB_R, 0xb89f72]]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 64), M.mat(c));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    hub.add(ring);
  }
  // central planter, big tree, animal statues
  const planter = M.mesh(new THREE.CylinderGeometry(3.2, 3.4, 0.6, 16), 0xd8cdb8);
  planter.position.y = 0.3;
  hub.add(planter);
  const soil = M.mesh(new THREE.CylinderGeometry(3, 3, 0.05, 16), 0x6b4a32);
  soil.position.y = 0.62;
  hub.add(soil);
  forest.tree(0, 0, 1.35);
  W.solids.push({ kind: 'circle', x: 0, z: 0, r: 3.6 });
  const statues = [
    [M.cat(), 2.1, 1.5],
    [M.dog({ kind: 'shiba' }), 2.3, 2.6],
    [M.fox(), 2.2, 3.8],
    [M.cow(), 2.4, 5.0],
  ];
  for (const [o, r, a] of statues) {
    o.position.set(Math.sin(a) * r, 0.62, Math.cos(a) * r);
    o.rotation.y = a;
    if (o.userData.head && o === statues[3][0]) o.scale.setScalar(0.45);
    hub.add(o);
  }

  // key visual board (south side, facing the spawn point)
  const kv = new THREE.Group();
  kv.name = 'KeyVisual';
  const kvTex = canvasTexture(1600, 800, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#7ec8f0');
    g.addColorStop(0.62, '#d9f0fb');
    g.addColorStop(0.62, '#8cc56a');
    g.addColorStop(1, '#5fa04a');
    ctx.fillStyle = g;
    roundRect(ctx, 0, 0, w, h, 48);
    ctx.fill();
    // little scene: houses, trees, river
    ctx.fillStyle = '#3f8fd0';
    ctx.beginPath();
    ctx.moveTo(1050, h);
    ctx.quadraticCurveTo(1150, 620, 1300, 500);
    ctx.lineTo(1340, 500);
    ctx.quadraticCurveTo(1220, 640, 1180, h);
    ctx.fill();
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = ['#4f9a3f', '#5fae49', '#3f8a3a'][i % 3];
      ctx.beginPath();
      ctx.arc(1180 + i * 48, 470 - (i % 3) * 14, 46, 0, 7);
      ctx.fill();
    }
    for (const [x, c] of [[120, '#f2ece0'], [280, '#f6d6b0'], [440, '#e8eef4']]) {
      ctx.fillStyle = c;
      ctx.fillRect(x, 400, 120, 96);
      ctx.fillStyle = '#5a6478';
      ctx.beginPath();
      ctx.moveTo(x - 14, 404);
      ctx.lineTo(x + 60, 340);
      ctx.lineTo(x + 134, 404);
      ctx.fill();
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#1d4f7a';
    ctx.lineWidth = 18;
    ctx.lineJoin = 'round';
    ctx.font = `900 150px ${FONT}`;
    ctx.strokeText('ワンヘルス・クエスト', w / 2, 210);
    ctx.fillText('ワンヘルス・クエスト', w / 2, 210);
    ctx.font = `700 54px ${FONT}`;
    ctx.fillStyle = '#1d4f7a';
    ctx.fillText('人・動物・環境のつながりを体験しよう', w / 2, 300);
    ctx.font = `600 36px ${FONT}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText('（名称は仮称です）', w / 2, 760);
    const cols = ZONES.map((z) => z.color);
    ZONES.forEach((z, i) => {
      const x = 260 + i * 540;
      ctx.fillStyle = cols[i];
      roundRect(ctx, x - 230, 560, 460, 120, 60);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `800 46px ${FONT}`;
      ctx.fillText(z.name, x, 636);
    });
  });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), new THREE.MeshStandardMaterial({ map: kvTex, roughness: 0.7 }));
  board.position.set(0, 3.6, 0);
  kv.add(board);
  const back = M.mesh(new THREE.BoxGeometry(10.4, 5.4, 0.2), 0xf4f1ea);
  back.position.set(0, 3.6, -0.12);
  kv.add(back);
  for (const s of [-1, 1]) {
    const post = M.mesh(new THREE.BoxGeometry(0.3, 1.2, 0.3), 0x9a7048);
    post.position.set(s * 4, 0.6, -0.12);
    kv.add(post);
  }
  kv.position.set(0, 0, 12.3);
  kv.rotation.y = Math.PI; // face north (towards the plaza centre)
  hub.add(kv);
  W.solids.push({ kind: 'obb', x: 0, z: 12.3, hw: 5.3, hd: 0.4, rot: 0 });

  // benches & flower beds around the plaza
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
    const b = M.bench();
    b.position.set(Math.sin(a) * 10.8, 0, -Math.cos(a) * 10.8);
    b.rotation.y = Math.atan2(-b.position.x, -b.position.z);
    hub.add(b);
    W.solids.push({ kind: 'circle', x: b.position.x, z: b.position.z, r: 0.8 });
    if (Math.abs(Math.cos(a)) < 0.95) {
      for (let j = -1; j <= 1; j++) forest.shrub(Math.sin(a + j * 0.08) * 12.6, -Math.cos(a + j * 0.08) * 12.6, 1.3);
    }
  }
  W.walkable.push({ kind: 'circle', x: 0, z: 0, r: HUB_R - 0.3 });

  // ring of trees around the plaza, leaving gaps for the spokes and the KV
  for (let k = 0; k < 40; k++) {
    const a = (k / 40) * Math.PI * 2;
    const nearSpoke = Object.values(ANGLES).some((s) => Math.abs(Math.atan2(Math.sin(a - s), Math.cos(a - s))) < 0.32);
    if (nearSpoke) continue;
    const r = 17.5 + (k % 3) * 2.2;
    forest.tree(Math.sin(a) * r, -Math.cos(a) * r, 0.9 + (k % 4) * 0.12);
  }

  /* ---------- spokes & zones ---------- */
  for (const zone of ZONES) {
    const a = ANGLES[zone.id];
    const dir = new THREE.Vector3(Math.sin(a), 0, -Math.cos(a));
    const rot = Math.atan2(-dir.x, -dir.z);
    const center = dir.clone().multiplyScalar(ZONE_DIST);

    // path from the plaza to the zone entry
    const pathLen = ZONE_DIST - ZONE_HD - HUB_R + 3;
    const mid = dir.clone().multiplyScalar(HUB_R - 1.5 + pathLen / 2);
    const path = new THREE.Mesh(new THREE.PlaneGeometry(6, pathLen), M.mat(0xe2d6bd));
    path.rotation.x = -Math.PI / 2;
    path.rotation.z = rot;
    path.position.set(mid.x, 0.015, mid.z);
    path.receiveShadow = true;
    scene.add(path);
    W.walkable.push({ kind: 'obb', x: mid.x, z: mid.z, hw: 2.8, hd: pathLen / 2, rot });
    // path-side trees
    for (let t = 0; t < 5; t++) {
      const along = dir.clone().multiplyScalar(HUB_R + 4 + t * 4);
      const side = new THREE.Vector3(-dir.z, 0, dir.x);
      for (const s of [-1, 1]) {
        const p = along.clone().addScaledVector(side, s * 5.5);
        forest.tree(p.x, p.z, 0.8 + ((t + s) % 3) * 0.15);
      }
    }

    // zone group in local coordinates (entry at local +z)
    const g = new THREE.Group();
    g.name = `Zone_${zone.id}`;
    g.position.copy(center);
    g.rotation.y = rot;
    scene.add(g);
    g.updateMatrixWorld(true);
    const Z = zoneKit(g, rot, center, W, forest, tex);
    W.zones[zone.id] = { center, rot, group: g, dir, zone };
    W.walkable.push({ kind: 'obb', x: center.x, z: center.z, hw: ZONE_HW, hd: ZONE_HD, rot });

    // gate at the plaza edge with live progress sign
    const gatePos = dir.clone().multiplyScalar(HUB_R - 0.5);
    const gate = new THREE.Group();
    const col = new THREE.Color(zone.color);
    for (const s of [-1, 1]) {
      const p = M.mesh(new THREE.BoxGeometry(0.5, 4.2, 0.5), col.getHex());
      p.position.set(s * 3.4, 2.1, 0);
      gate.add(p);
    }
    const beam = M.mesh(new THREE.BoxGeometry(7.6, 0.5, 0.5), col.getHex());
    beam.position.y = 4.35;
    gate.add(beam);
    const signMat = new THREE.MeshStandardMaterial({ roughness: 0.6 });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.6), signMat);
    sign.position.set(0, 5.4, 0);
    gate.add(sign);
    const signBack = sign.clone();
    signBack.rotation.y = Math.PI;
    signBack.material = signMat;
    gate.add(signBack);
    gate.position.copy(gatePos);
    gate.rotation.y = rot;
    scene.add(gate);
    for (const s of [-1, 1]) {
      const p = gatePos.clone().add(new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(s * 3.4));
      W.solids.push({ kind: 'circle', x: p.x, z: p.z, r: 0.45 });
    }
    W.zones[zone.id].setGate = (done, total, stamp) => {
      signMat.map?.dispose();
      signMat.map = signTexture([
        { t: zone.name, size: 92, color: '#ffffff' },
        { t: stamp ? `${stamp === 'gold' ? 'ゴールド' : 'シルバー'}スタンプ獲得！` : `トラブル ${done} / ${total} 解決`, size: 56, weight: 600, color: '#ffffff' },
      ], { w: 1024, h: 256, bg: zone.color, radius: 30 });
      signMat.needsUpdate = true;
    };
    W.zones[zone.id].setGate(0, SCENARIOS.filter((s) => s.zone === zone.id).length, null);

    if (zone.id === 'A') buildZoneA(Z, W);
    if (zone.id === 'B') buildZoneB(Z, W);
    if (zone.id === 'C') buildZoneC(Z, W);

    // area name board at the entry
    const board2 = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.2), new THREE.MeshStandardMaterial({
      map: signTexture([
        { t: zone.name, size: 88, color: zone.color },
        { t: zone.sub, size: 40, weight: 600 },
      ], { w: 1024, h: 512, border: zone.color }),
    }));
    const bp = Z.put(new THREE.Group(), 6.5, ZONE_HD - 2.5, 0);
    board2.position.y = 2;
    bp.add(board2);
    const bpost = M.mesh(new THREE.BoxGeometry(0.15, 1, 0.15), 0x9a7048);
    bpost.position.y = 0.5;
    bp.add(bpost);
  }

  // scattered trees in the gaps between zones
  for (let k = 0; k < 90; k++) {
    const a = (k / 90) * Math.PI * 2;
    const r = 30 + ((k * 53) % 45);
    const x = Math.sin(a) * r, z = -Math.cos(a) * r;
    if (insideAny(W.walkable, x, z, 3)) continue;
    forest.tree(x, z, 0.8 + ((k * 7) % 5) * 0.12, k % 4 === 0 ? 'pine' : 'round');
  }

  const trees = forest.build(7);
  trees.name = 'Vegetation';
  scene.add(trees);
  W.occluders = trees.children; // used to keep the camera in front of trees
  return W;
}

/* ---------------- zone kit: local-space placement helpers ---------------- */

function zoneKit(g, rot, center, W, forest, tex) {
  const toWorld = (lx, lz) => {
    const v = new THREE.Vector3(lx, 0, lz).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
    return v.add(center);
  };
  return {
    g,
    toWorld,
    put(obj, lx, lz, ry = 0, y = 0) {
      obj.position.set(lx, y, lz);
      obj.rotation.y = ry;
      g.add(obj);
      return obj;
    },
    /** blocking box in local coords (half sizes) */
    solid(lx, lz, hw, hd, ry = 0) {
      const p = toWorld(lx, lz);
      W.solids.push({ kind: 'obb', x: p.x, z: p.z, hw, hd, rot: rot + ry });
    },
    circle(lx, lz, r) {
      const p = toWorld(lx, lz);
      W.solids.push({ kind: 'circle', x: p.x, z: p.z, r });
    },
    tree(lx, lz, s, kind) {
      const p = toWorld(lx, lz);
      forest.tree(p.x, p.z, s, kind);
      W.solids.push({ kind: 'circle', x: p.x, z: p.z, r: 0.35 * s });
    },
    shrub(lx, lz, s) {
      const p = toWorld(lx, lz);
      forest.shrub(p.x, p.z, s);
    },
    floor(lx, lz, w, d, color, y = 0.025) {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(w, d), M.mat(color));
      f.rotation.x = -Math.PI / 2;
      f.position.set(lx, y, lz);
      f.receiveShadow = true;
      g.add(f);
      return f;
    },
    /** Room without roof (cut-away like the doc's isometric art). Door on +z wall. */
    room(cx, cz, w, d, { wall = 0xf2ece0, trim = 0x4a5a78, floor = 0xd9b98a, door = 2.4, doorX = 0, h = 2.6 } = {}) {
      this.floor(cx, cz, w, d, floor, 0.035);
      const t = 0.22;
      const seg = (x, z, sw, sd) => {
        const m = M.mesh(new THREE.BoxGeometry(sw, h, sd), wall);
        m.position.set(x, h / 2, z);
        g.add(m);
        const cap = M.mesh(new THREE.BoxGeometry(sw + 0.02, 0.12, sd + 0.02), trim);
        cap.position.set(x, h + 0.06, z);
        g.add(cap);
        this.solid(x, z, sw / 2 + 0.05, sd / 2 + 0.05);
      };
      seg(cx, cz - d / 2, w, t); // back
      seg(cx - w / 2, cz, t, d); // left
      seg(cx + w / 2, cz, t, d); // right
      const dl = cx + doorX - door / 2, dr = cx + doorX + door / 2;
      const left = dl - (cx - w / 2), right = cx + w / 2 - dr;
      seg(cx - w / 2 + left / 2, cz + d / 2, left, t);
      seg(dr + right / 2, cz + d / 2, right, t);
      // door mat
      this.floor(cx + doorX, cz + d / 2 + 0.6, door, 1, 0x7a8a6a, 0.03);
    },
    mark(id, lx, lz, y = 2.1, anchor = null) {
      const sc = SCENARIOS.find((s) => s.id === id);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: sc.type === 'tip' ? tex.tip : tex.trouble, depthWrite: false }));
      sprite.scale.setScalar(sc.type === 'tip' ? 0.9 : 1.1);
      sprite.renderOrder = 5;
      sprite.userData.scenarioId = id;
      const base = toWorld(lx, lz);
      base.y = y;
      sprite.position.copy(base);
      g.parent.add(sprite);
      W.marks.push({ scenario: sc, sprite, base, anchor, done: false });
      return sprite;
    },
  };
}

/* ---------------- A. ワンヘルスの理念 ---------------- */

function buildZoneA(Z, W) {
  // human environment (local x < 0) ↔ natural environment (x > 0)
  Z.floor(-11, 0, 22, 36, 0x9fcf7a, 0.01);
  Z.floor(11, 0, 22, 36, 0x7dbb5c, 0.01);
  // main road continuing from the spoke
  Z.floor(-3, 0, 5, 36, 0x6d7380, 0.02);
  for (let z = -16; z <= 16; z += 4) Z.floor(-3, z, 0.25, 2, 0xf4f4f4, 0.025);
  for (let i = 0; i < 6; i++) Z.floor(-3, 6 + (i - 2.5) * 0.6, 4.4, 0.3, 0xf4f4f4, 0.026); // crosswalk
  Z.floor(-0.2, 0, 0.6, 36, 0xd8d2c6, 0.03); // curb / sidewalk
  for (let z = -14; z <= 14; z += 7) Z.put(M.streetLight(), -0.2, z);

  // houses (town) — A4
  const h1 = Z.put(M.house({ wall: 0xf2ece0 }), -11, 9, Math.PI / 2);
  Z.solid(-11, 9, 2.6, 3.1);
  const h2 = Z.put(M.house({ wall: 0xf6dcc0, roof: 0x8a4a3a }), -11, -1, Math.PI / 2);
  Z.solid(-11, -1, 2.6, 3.1);
  Z.mark('A4', -8, -1, 2.3);
  for (const z of [4.5, -5.5]) { Z.shrub(-8.4, z, 1); Z.shrub(-9.2, z, 0.8); }
  void h1; void h2;

  // farm: barn + silo + pasture + cow — A3
  Z.put(M.barn(), -14.5, -11.5, Math.PI / 2);
  Z.solid(-14.5, -11.5, 3.1, 3.6);
  Z.circle(-15.5, -6.5, 1.5);
  const fenceX = [-10.5, -5.5], fenceZ = [-16.5, -7.5];
  Z.put(M.fence(5), -8, fenceZ[0]);
  Z.put(M.fence(5), -8, fenceZ[1] - 0, 0);
  Z.put(M.fence(9), fenceX[1], -12, Math.PI / 2);
  Z.solid(-8, fenceZ[0], 2.5, 0.15);
  Z.solid(-8, fenceZ[1], 2.5, 0.15);
  Z.solid(fenceX[1], -12, 0.15, 4.5);
  Z.floor(-8, -12, 5, 9, 0xb7c97a, 0.015);
  const c = Z.put(M.cow(), -8, -12, Math.PI / 2);
  W.animals.push((t) => { c.userData.head.rotation.x = Math.sin(t * 0.8) * 0.15; });
  Z.mark('A3', -7.4, -12, 2.6);
  // crop field
  for (let x = -21; x <= -17; x += 1) for (let z = -3; z <= 16; z += 1.2) {
    const crop = M.mesh(new THREE.BoxGeometry(0.4, 0.35, 0.4), (x + z) % 2 ? 0x5fae49 : 0x7cc05a);
    Z.put(crop, x, z, 0, 0.17);
  }
  Z.floor(-19, 6.5, 5, 20, 0x9a7048, 0.012);

  // park at the boundary — A2 (fox + candy)
  Z.floor(3.5, 8, 6, 10, 0xd8c79a, 0.02);
  Z.put(M.slide(), 4.5, 11.5, -Math.PI / 2);
  Z.solid(4.5, 11.5, 0.6, 1.8, -Math.PI / 2);
  const b = Z.put(M.bench(), 1.5, 4, Math.PI / 2);
  Z.solid(1.5, 4, 0.4, 0.9);
  void b;
  const parkFox = Z.put(M.fox({ thin: true }), 4, 6, -Math.PI / 2);
  for (let i = 0; i < 3; i++) {
    const candy = M.mesh(new THREE.OctahedronGeometry(0.1, 0), [0xff5fa2, 0x4fb3ff, 0xffc93f][i]);
    Z.put(candy, 3.2 + i * 0.2, 6.4 - i * 0.25, 0, 0.1);
  }
  W.animals.push((t) => {
    parkFox.userData.head.rotation.y = Math.sin(t * 0.7) * 0.4;
    parkFox.userData.tail.rotation.y = Math.sin(t * 2) * 0.3;
  });
  Z.mark('A2', 4, 6, 1.8);
  W.anchors.parkFox = parkFox;

  // river through the natural side — A5, and the bridge
  const riverMat = new THREE.MeshStandardMaterial({ color: 0x3f8fd0, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.92 });
  const river = new THREE.Mesh(new THREE.PlaneGeometry(3, 36, 1, 24), riverMat);
  river.rotation.x = -Math.PI / 2;
  river.position.set(9, 0.04, 0);
  Z.g.add(river);
  W.river = { from: Z.toWorld(9, 18), to: Z.toWorld(9, -18) };
  for (const s of [-1, 1]) Z.floor(9 + s * 1.7, 0, 0.4, 36, 0xa8b4a0, 0.03);
  Z.solid(9, 8.25, 1.5, 9.75); // river north of the bridge (bridge spans z -4.5..-1.5)
  Z.solid(9, -11.25, 1.5, 6.75);
  const bridge = M.mesh(new THREE.BoxGeometry(4.4, 0.15, 3), 0xb8865a);
  Z.put(bridge, 9, -3, 0, 0.12);
  for (const s of [-1, 1]) Z.put(M.fence(4.4, 0x9a7048), 9, -3 + s * 1.5);
  Z.put(M.mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 6), 0xffffff), 7.3, 8, 0, 0.06);
  Z.mark('A5', 7.2, 8, 1.8);

  // forest with a damaged clearing — A1
  const clear = (x, z) => Math.hypot(x - 15.5, z + 10) < 4.5;
  for (let x = 12; x <= 21; x += 2.3) {
    for (let z = -17; z <= 17; z += 2.4) {
      const jx = x + Math.sin(z * 3.1) * 0.8, jz = z + Math.cos(x * 2.3) * 0.8;
      if (clear(jx, jz)) continue;
      Z.tree(jx, jz, 0.9 + Math.abs(Math.sin(x * z)) * 0.5, (Math.round(x + z) % 3 === 0) ? 'pine' : 'round');
    }
  }
  for (const [x, z] of [[14, -8], [16.5, -11.5], [17.5, -8.5], [14.5, -12]]) {
    Z.put(M.stump(), x, z);
    Z.circle(x, z, 0.45);
  }
  const log = M.mesh(new THREE.CylinderGeometry(0.25, 0.3, 3, 7), 0x8a6038);
  Z.put(log, 16, -9.5, 0.6, 0.25).rotation.z = Math.PI / 2;
  Z.put(M.trash(), 13.8, -10.2);
  Z.put(M.trash(), 17, -12.6, 1.2);
  Z.mark('A1', 15.2, -9.6, 2.2);
  W.anchors.forestDamage = Z.toWorld(15.2, -9.6);
  W.anchors.parkWorld = Z.toWorld(4, 6);

  // trees on the town side
  for (const [x, z] of [[-15, 15], [-7, 15], [-7, 3.5], [-15.5, 3], [-21, -10], [-20, -16]]) Z.tree(x, z, 0.9);
}

/* ---------------- B. 人獣共通感染症対策 ---------------- */

function buildZoneB(Z, W) {
  Z.floor(0, 0, 44, 36, 0xa9d08a, 0.01);
  Z.floor(0, 13, 4, 10, 0xe2d6bd, 0.02);
  Z.floor(0, 7.5, 34, 2.5, 0xe2d6bd, 0.02);

  // cat café
  const cx = -9.5, cz = -2.5;
  Z.room(cx, cz, 13, 15, { wall: 0xf3eee4, trim: 0x2f3a4a, floor: 0xd2a26a, doorX: 2 });
  const rug = Z.floor(cx - 1, cz - 1, 6, 5, 0x6fae5a, 0.045);
  void rug;
  Z.put(M.catTower(), cx - 5.2, cz - 5.8);
  Z.circle(cx - 5.2, cz - 5.8, 0.6);
  Z.put(M.sofa(0xe8e1cf), cx - 5.4, cz + 0.5, Math.PI / 2);
  Z.solid(cx - 5.4, cz + 0.5, 0.5, 1.05);
  Z.put(M.counter(4), cx + 2, cz - 6.9);
  Z.solid(cx + 2, cz - 6.9, 2.05, 0.35);
  const menu = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.1), new THREE.MeshStandardMaterial({
    map: signTexture([{ t: 'Cat Cafe', size: 110, color: '#f4efe6' }, { t: 'ねこカフェ', size: 70, weight: 600, color: '#f4efe6' }], { w: 1024, h: 470, bg: '#2f3a35' }),
  }));
  Z.put(menu, cx + 2, cz - 7.25, 0, 1.9);
  for (const [x, z] of [[cx + 1.5, cz - 1], [cx + 3.5, cz + 2.5]]) {
    Z.put(M.roundTable(), x, z);
    Z.circle(x, z, 0.6);
    for (const a of [0, Math.PI]) Z.put(M.chair(), x + Math.sin(a) * 0.85, z + Math.cos(a) * 0.85, a + Math.PI);
  }
  // cake on the table — B2
  const cake = M.mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 8), 0xf6e0c8);
  Z.put(cake, cx + 1.5, cz - 1, 0, 0.8);
  Z.mark('B2', cx + 1.5, cz - 1, 2);
  // hand-wash sink by the door
  Z.put(M.sink(), cx - 3.5, cz + 7.1, Math.PI);
  Z.solid(cx - 3.5, cz + 7.1, 0.45, 0.3);
  for (const [x, z] of [[cx + 5.5, cz - 4.5], [cx - 5.5, cz + 5.5]]) Z.put(M.plant(1.1), x, z);
  // cats wandering — B1 cat sits by the sofa
  const licker = Z.put(M.cat({ color: 0x8a6a4a }), cx - 4.3, cz + 0.6, -Math.PI / 2);
  W.animals.push((t) => {
    licker.userData.head.rotation.x = Math.sin(t * 6) * 0.15;
    licker.userData.tail.rotation.z = Math.sin(t * 2) * 0.4;
  });
  Z.mark('B1', cx - 4.3, cz + 0.6, 1.4);
  const cats = [0xd9a066, 0x3a3a3a, 0xf0ebe3];
  cats.forEach((col, i) => {
    const kitty = Z.put(M.cat({ color: col }), cx, cz, 0);
    const r = 1.6 + i * 0.7, w = 0.25 + i * 0.07, ph = i * 2;
    W.animals.push((t) => {
      const a = t * w + ph;
      kitty.position.set(cx - 1 + Math.cos(a) * r, 0, cz - 1 + Math.sin(a) * r * 0.8);
      kitty.rotation.y = -a;
      kitty.userData.tail.rotation.z = Math.sin(t * 3 + i) * 0.4;
    });
  });

  // home
  const hx = 9.5, hz = -2.5;
  Z.room(hx, hz, 12, 13, { wall: 0xeef0f4, trim: 0x4a5a78, floor: 0xdcc3a0, doorX: -2.5 });
  Z.floor(hx, hz - 1, 5, 4, 0x8fa0b8, 0.045);
  Z.put(M.sofa(0x5d6f8c), hx, hz - 4.8);
  Z.solid(hx, hz - 4.8, 1.05, 0.5);
  Z.put(M.tv(), hx - 5.6, hz - 1, Math.PI / 2);
  Z.solid(hx - 5.6, hz - 1, 0.25, 0.85);
  Z.put(M.cage(), hx + 4.8, hz - 5.4);
  Z.solid(hx + 4.8, hz - 5.4, 0.55, 0.4);
  Z.put(M.table(1.4, 0.9), hx + 3.6, hz + 2.6);
  Z.solid(hx + 3.6, hz + 2.6, 0.75, 0.5);
  for (const s of [-1, 1]) Z.put(M.chair(0x8a6a4a), hx + 3.6 + s * 0.45, hz + 3.35, Math.PI);
  Z.put(M.counter(3), hx + 5.5, hz + 0.2, -Math.PI / 2);
  Z.solid(hx + 5.5, hz + 0.2, 0.35, 1.55);
  Z.put(M.plant(1.2), hx - 5.3, hz - 5.6);
  // sick beagle — B3
  const sick = Z.put(M.dog({ kind: 'beagle', lying: true }), hx - 0.5, hz - 1.4, 0.4);
  W.animals.push((t) => { sick.userData.head.rotation.x = 0.1 + Math.sin(t * 0.6) * 0.05; });
  const poop = M.mesh(new THREE.SphereGeometry(0.08, 5, 4), 0x5a3a1a);
  Z.put(poop, hx + 0.6, hz - 0.3, 0, 0.06);
  Z.mark('B3', hx - 0.2, hz - 1, 1.7);
  // paw prints near the door — B4 (tip)
  const paw = new THREE.MeshStandardMaterial({
    map: canvasTexture(256, 256, (ctx) => {
      ctx.fillStyle = '#5a3a1a';
      for (const [x, y, r] of [[128, 150, 46], [70, 80, 22], [110, 55, 22], [150, 55, 22], [190, 80, 22]]) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 7);
        ctx.fill();
      }
    }),
    transparent: true, depthWrite: false,
  });
  for (let i = 0; i < 6; i++) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.28), paw);
    p.rotation.x = -Math.PI / 2;
    p.rotation.z = Math.PI + (i % 2 ? 0.2 : -0.2);
    p.position.set(hx - 2.5 + (i % 2 ? 0.25 : -0.25), 0.05, hz + 5.8 - i * 0.6);
    Z.g.add(p);
  }
  Z.mark('B4', hx - 2.5, hz + 4.3, 1.5);
  // healthy shiba by the sofa — B5
  const pet = Z.put(M.dog({ kind: 'shiba' }), hx + 1.8, hz - 3.6, -0.6);
  W.animals.push((t) => { pet.userData.tail.rotation.z = Math.sin(t * 8) * 0.4; });
  Z.mark('B5', hx + 1.8, hz - 3.6, 1.7);

  for (const [x, z] of [[-19, 12], [-19, -14], [19, 12], [19, -14], [-2, -14], [1.5, -14], [14, 10], [-14, 11]]) Z.tree(x, z, 1);
  for (let x = -18; x <= 18; x += 3) if (Math.abs(x) > 2.5) Z.shrub(x, 10.5, 1);
}

/* ---------------- C. ペットの災害対策 ---------------- */

function buildZoneC(Z, W) {
  Z.floor(0, 0, 44, 36, 0xa9d08a, 0.01);
  Z.floor(0, 13, 4, 10, 0xe2d6bd, 0.02);
  Z.floor(0, 11.5, 34, 2.4, 0xe2d6bd, 0.02);

  // home (disaster preparation) — C1, C2, C3
  const hx = -13, hz = 0;
  Z.room(hx, hz, 11, 12, { wall: 0xeef0f4, trim: 0x4a5a78, floor: 0xdcc3a0, doorX: 2.5 });
  Z.floor(hx - 1, hz - 1, 4.5, 3.5, 0x8fa0b8, 0.045);
  Z.put(M.sofa(0x5d6f8c), hx - 1, hz - 4.2);
  Z.solid(hx - 1, hz - 4.2, 1.05, 0.5);
  Z.put(M.tv(), hx - 5.1, hz - 1, Math.PI / 2);
  Z.solid(hx - 5.1, hz - 1, 0.25, 0.85);
  const lazy = Z.put(M.dog({ kind: 'beagle', lying: true }), hx - 1, hz - 1.6, 0.3);
  void lazy;
  Z.put(M.cage(), hx + 4.3, hz - 4.9);
  Z.solid(hx + 4.3, hz - 4.9, 0.55, 0.4);
  // C1 pet food
  Z.put(M.foodBag(), hx - 4.2, hz + 3.6);
  Z.mark('C1', hx - 4, hz + 3.6, 1.7);
  // C2 kitchen water
  Z.put(M.counter(3), hx + 4.9, hz, -Math.PI / 2);
  Z.solid(hx + 4.9, hz, 0.35, 1.55);
  for (let i = 0; i < 4; i++) Z.put(M.mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 8), 0x9fd0f0), hx + 4.9, hz - 1 + i * 0.25, 0, 1.2);
  Z.mark('C2', hx + 4.2, hz - 0.2, 2.2);
  // C3 emergency backpack
  Z.put(M.backpack(), hx + 1.2, hz + 3);
  Z.mark('C3', hx + 1.2, hz + 3, 1.7);

  // evacuation shelter (school gym)
  const gx = 7.5, gz = -2.5, gw = 20, gd = 25;
  Z.room(gx, gz, gw, gd, { wall: 0xe8e0d0, trim: 0x3a4a68, floor: 0xd8a868, door: 3, doorX: -3, h: 3.4 });
  // court lines
  Z.floor(gx, gz, 0.12, gd - 1, 0xf4f4f4, 0.05);
  Z.floor(gx, gz, gw - 1, 0.12, 0xf4f4f4, 0.05);
  // stage with red curtain
  const stage = M.mesh(new THREE.BoxGeometry(gw - 0.5, 1, 3), 0xb8864a);
  Z.put(stage, gx, gz - gd / 2 + 1.7, 0, 0.5);
  Z.solid(gx, gz - gd / 2 + 1.7, gw / 2, 1.6);
  const curtain = M.mesh(new THREE.BoxGeometry(gw - 2, 2.2, 0.1), 0xb8282a);
  Z.put(curtain, gx, gz - gd / 2 + 0.6, 0, 2.1);
  for (const s of [-1, 1]) Z.put(M.hoop(), gx + s * (gw / 2 - 0.3), gz + 2, -s * Math.PI / 2);
  // window band
  for (const s of [-1, 1]) for (let k = -4; k <= 4; k++) Z.put(M.mesh(new THREE.BoxGeometry(0.05, 0.8, 2), 0xbfe0f2), gx + s * (gw / 2 + 0.12), gz + k * 2.6, 0, 2.6);
  // residential spaces: cardboard beds with partitions
  for (let cxi = 0; cxi < 3; cxi++) for (let czi = 0; czi < 3; czi++) {
    const x = gx - 5.5 + cxi * 5.5, z = gz - 6.5 + czi * 4.6;
    Z.put(M.cardboardBed(), x - 0.6, z, Math.PI / 2);
    Z.put(M.cardboardBed(), x + 0.6, z + 0.2, Math.PI / 2);
    Z.put(M.partition(3), x, z - 1.2);
    Z.put(M.partition(2.2), x - 1.6, z, Math.PI / 2);
    Z.solid(x, z, 1.6, 1.25);
    Z.put(M.boxes(), x + 1.4, z - 0.8);
  }
  // pet space (飼育スペース) near the entrance
  const pet = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.8), new THREE.MeshStandardMaterial({
    map: signTexture([{ t: 'ペット飼育スペース', size: 120, color: '#ffffff' }], { w: 1024, h: 300, bg: '#2b63b5' }),
  }));
  Z.put(pet, gx + 7.6, gz + 9.6, 0, 2.2);
  for (let k = 0; k < 3; k++) {
    Z.put(M.cage(), gx + 6 + k * 1.2, gz + 10.8, Math.PI);
  }
  Z.solid(gx + 7.2, gz + 10.8, 1.9, 0.4);
  // supplies along the wall
  for (let k = 0; k < 5; k++) Z.put(M.boxes(), gx - gw / 2 + 0.8, gz - 6 + k * 1.4);
  Z.solid(gx - gw / 2 + 0.8, gz - 3.2, 0.45, 3.6);
  // C5 residential space dialogue
  const neighbor = Z.put(M.avatar({ skin: 1, hairStyle: 3, hairColor: 3, top: 2, topColor: 0, bottom: 0, bottomColor: 1 }), gx + 3.5, gz + 4.6, Math.PI);
  void neighbor;
  Z.mark('C5', gx + 3.5, gz + 4.6, 2.4);
  // C4 lost shiba without ID walking the aisle
  const lost = Z.put(M.dog({ kind: 'shiba' }), gx, gz, 0);
  const loop = (t) => {
    // rectangular loop along the aisles between the bed blocks
    const pts = [[-8, 6.8], [8.2, 6.8], [8.2, -9], [-8, -9]];
    const per = [16.2, 15.8, 16.2, 15.8];
    const total = per.reduce((a, b) => a + b);
    let d = (t * 0.9) % total, i = 0;
    while (d > per[i]) { d -= per[i]; i = (i + 1) % 4; }
    const a = pts[i], b = pts[(i + 1) % 4];
    const f = d / per[i];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, Math.atan2(b[0] - a[0], b[1] - a[1])];
  };
  W.lostDog = { obj: lost, paused: false, t: 0, home: new THREE.Vector3(gx + 7.2, 0, gz + 9.4), rot: Math.PI }; // zone-local
  W.animals.push((t, dt) => {
    if (W.lostDog.paused) return;
    W.lostDog.t += dt;
    const [x, z, ry] = loop(W.lostDog.t);
    lost.position.set(gx + x, 0, gz + z);
    lost.rotation.y = ry;
    lost.userData.tail.rotation.z = Math.sin(t * 8) * 0.3;
  });
  const lostMark = Z.mark('C4', gx, gz, 1.6, lost);
  void lostMark;

  for (const [x, z] of [[-19, 13], [-19, -14], [19.5, 13], [-6, -14], [-6, 13]]) Z.tree(x, z, 1);
}

/* ---------------- shape tests ---------------- */

export function inside(s, x, z, margin = 0) {
  if (s.kind === 'circle') return Math.hypot(x - s.x, z - s.z) < s.r - margin;
  const dx = x - s.x, dz = z - s.z;
  const c = Math.cos(s.rot), sn = Math.sin(s.rot);
  const lx = dx * c - dz * sn, lz = dx * sn + dz * c;
  return Math.abs(lx) < s.hw - margin && Math.abs(lz) < s.hd - margin;
}

export function insideAny(list, x, z, margin = 0) {
  return list.some((s) => inside(s, x, z, -margin));
}

/** Push a circle (player) out of a solid shape. Returns corrected [x, z]. */
export function pushOut(s, x, z, r) {
  if (s.kind === 'circle') {
    const dx = x - s.x, dz = z - s.z;
    const d = Math.hypot(dx, dz), min = s.r + r;
    if (d < min && d > 1e-5) return [s.x + (dx / d) * min, s.z + (dz / d) * min];
    return [x, z];
  }
  const c = Math.cos(s.rot), sn = Math.sin(s.rot);
  const dx = x - s.x, dz = z - s.z;
  let lx = dx * c - dz * sn, lz = dx * sn + dz * c;
  const ex = s.hw + r, ez = s.hd + r;
  if (Math.abs(lx) >= ex || Math.abs(lz) >= ez) return [x, z];
  // push along the axis of least penetration
  if (ex - Math.abs(lx) < ez - Math.abs(lz)) lx = Math.sign(lx || 1) * ex;
  else lz = Math.sign(lz || 1) * ez;
  return [s.x + lx * c + lz * sn, s.z - lx * sn + lz * c];
}
