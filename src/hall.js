// Builds the VDWC circular gallery as a three.js scene graph.
import * as THREE from 'three';
import { SPEC, R, SLOT, ENTRIES } from './data.js';
import * as T from './textures.js';

const up = new THREE.Vector3(0, 1, 0);

/** Point on the hall floor at angle `a` (0 = entrance, +Z) and radius `r`. */
export function polar(a, r, y = 0) {
  return new THREE.Vector3(-Math.sin(a) * r, y, Math.cos(a) * r);
}

function shadow(obj, cast = true, receive = true) {
  obj.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = cast;
      o.receiveShadow = receive;
    }
  });
  return obj;
}

/** Annular sector solid (planters, basins, walls). */
function arcSolid(rIn, rOut, h, a0, a1, mat, segs = 48) {
  const s = new THREE.Shape();
  const n = Math.max(4, Math.round(segs * (a1 - a0) / (Math.PI * 2)));
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * (i / n);
    const v = polar(a, rOut);
    i ? s.lineTo(v.x, -v.z) : s.moveTo(v.x, -v.z);
  }
  for (let i = n; i >= 0; i--) {
    const a = a0 + (a1 - a0) * (i / n);
    const v = polar(a, rIn);
    s.lineTo(v.x, -v.z);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 1 });
  g.rotateX(-Math.PI / 2);
  return new THREE.Mesh(g, mat);
}

export function buildHall({ renderer }) {
  const root = new THREE.Group();
  root.name = 'VDWC_Gallery';
  const anim = []; // per-frame callbacks
  const interactive = []; // panel meshes for raycasting
  const colliders = []; // simple circles {x,z,r} for walk mode

  const aniso = renderer.capabilities.getMaxAnisotropy();

  /* ---------------- materials ---------------- */
  const M = {
    floor: new THREE.MeshStandardMaterial({ map: T.stoneTexture([10, 10], 11), roughness: 0.35, metalness: 0 }),
    stone: new THREE.MeshStandardMaterial({ map: T.stoneTexture([2, 2], 17, false), roughness: 0.6 }),
    white: new THREE.MeshStandardMaterial({ color: 0xf4f2ee, roughness: 0.5 }),
    whiteGloss: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 }),
    wood: new THREE.MeshStandardMaterial({ map: T.woodTexture([6, 1]), roughness: 0.6 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xd6b36a, metalness: 1, roughness: 0.25 }),
    navy: new THREE.MeshStandardMaterial({ color: 0x14223d, roughness: 0.5 }),
    soil: new THREE.MeshStandardMaterial({ color: 0x3b2e22, roughness: 1 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0xdff0ff, metalness: 0, roughness: 0.02, transparent: true, opacity: 0.12,
      side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.5,
    }),
    mullion: new THREE.MeshStandardMaterial({ color: 0xe9e6df, roughness: 0.4, metalness: 0.2 }),
    led: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff1d6, emissiveIntensity: 2.2 }),
    trunk: new THREE.MeshStandardMaterial({ color: 0x6b5238, roughness: 0.9 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }),
  };
  for (const m of Object.values(M)) if (m.map) m.map.anisotropy = aniso;

  /* ---------------- sky + exterior ---------------- */
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(400, 32, 16),
    new THREE.MeshBasicMaterial({ map: T.skyTexture(), side: THREE.BackSide, fog: false, depthWrite: false }),
  );
  sky.name = 'Sky';
  root.add(sky);

  const pano = new THREE.Mesh(
    new THREE.CylinderGeometry(180, 180, 90, 96, 1, true),
    new THREE.MeshBasicMaterial({ map: T.panoramaTexture(), side: THREE.BackSide, transparent: true, fog: false }),
  );
  pano.position.y = 90 / 2 - 8;
  pano.name = 'CityPanorama';
  root.add(pano);

  const lake = new THREE.Mesh(
    new THREE.CircleGeometry(180, 64),
    new THREE.MeshStandardMaterial({ color: 0x4d88b3, roughness: 0.15, metalness: 0.1 }),
  );
  lake.rotation.x = -Math.PI / 2;
  lake.position.y = -1.2;
  lake.name = 'Lake';
  root.add(lake);

  // exterior terrace + base
  const terrace = new THREE.Mesh(new THREE.CylinderGeometry(24, 24.5, 1.2, 96), M.stone);
  terrace.position.y = -0.6;
  terrace.name = 'Terrace';
  root.add(shadow(terrace, false, true));

  /* ---------------- floor ---------------- */
  const floor = new THREE.Mesh(new THREE.CircleGeometry(R.hall + 0.5, 128), M.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.001;
  floor.name = 'Floor';
  floor.receiveShadow = true;
  root.add(floor);

  // brass inlay rings marking the circulation loop
  for (const rr of [R.planterOut + 0.15, R.panel - 0.9]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(rr - 0.03, rr + 0.03, 160), M.gold);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.004;
    root.add(ring);
  }

  // floor lettering near the entrance
  const floorText = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 1.5),
    new THREE.MeshStandardMaterial({
      map: T.textTexture([
        { text: 'IDEAS CONNECT PEOPLE', size: 92, weight: 500, color: '#3a3f47', spacing: 10, italic: true },
        { text: 'A BRIGHTER TOMORROW.', size: 92, weight: 500, color: '#3a3f47', spacing: 10, italic: true },
      ], { w: 1600, h: 400 }),
      transparent: true, opacity: 0.8, roughness: 0.4, depthWrite: false,
    }),
  );
  floorText.rotation.x = -Math.PI / 2;
  floorText.position.set(0, 0.006, R.planterOut + 2.3);
  floorText.name = 'FloorLettering';
  root.add(floorText);

  /* ---------------- central pool ---------------- */
  const pool = new THREE.Group();
  pool.name = 'CentralPool';
  root.add(pool);

  const rim = new THREE.Mesh(new THREE.CylinderGeometry(R.pool + 0.35, R.pool + 0.4, 0.5, 128, 1, true), M.white);
  rim.position.y = 0.25;
  pool.add(rim);
  const rimTop = new THREE.Mesh(new THREE.RingGeometry(R.pool - 0.05, R.pool + 0.35, 128), M.whiteGloss);
  rimTop.rotation.x = -Math.PI / 2;
  rimTop.position.y = 0.5;
  pool.add(rimTop);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(R.pool - 0.05, R.pool - 0.05, 0.5, 128, 1, true), M.white);
  inner.position.y = 0.25;
  inner.material = M.white.clone();
  inner.material.side = THREE.BackSide;
  pool.add(inner);
  const basin = new THREE.Mesh(new THREE.CircleGeometry(R.pool, 96), new THREE.MeshStandardMaterial({ map: T.mosaicTexture([6, 6]), roughness: 0.4 }));
  basin.rotation.x = -Math.PI / 2;
  basin.position.y = 0.05;
  pool.add(basin);

  const waterNormal = T.waterNormalTexture();
  const water = new THREE.Mesh(
    new THREE.RingGeometry(1.95, R.pool - 0.05, 128, 1),
    new THREE.MeshPhysicalMaterial({
      color: 0x2f86c0, roughness: 0.04, metalness: 0.0, transparent: true, opacity: 0.72,
      normalMap: waterNormal, normalScale: new THREE.Vector2(0.35, 0.35), clearcoat: 1, clearcoatRoughness: 0.05,
      envMapIntensity: 1.6,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.42;
  water.name = 'Water';
  water.receiveShadow = true;
  pool.add(water);
  anim.push((t) => {
    waterNormal.offset.set(t * 0.012, t * 0.008);
  });
  shadow(pool, false, true);

  // pedestal with lettering
  const pedestal = new THREE.Group();
  pedestal.name = 'Pedestal';
  pool.add(pedestal);
  const pedBody = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.0, 1.3, 96), M.white);
  pedBody.position.y = 0.65;
  pedestal.add(pedBody);
  const pedText = new THREE.Mesh(
    new THREE.CylinderGeometry(2.005, 2.005, 1.0, 96, 1, true, -Math.PI / 4, Math.PI / 2),
    new THREE.MeshStandardMaterial({
      map: T.textTexture([
        { text: 'VDWC', size: 190, weight: 600, color: '#1b2a44', spacing: 12 },
        { text: 'Virtual Design World Cup', size: 64, weight: 400, color: '#1b2a44', gap: 6 },
      ], { w: 1400, h: 440 }),
      transparent: true, roughness: 0.5,
    }),
  );
  pedText.position.y = 0.72;
  pedestal.add(pedText);
  // LED base line
  const pedLed = new THREE.Mesh(new THREE.TorusGeometry(2.01, 0.02, 6, 128), M.led);
  pedLed.rotation.x = Math.PI / 2;
  pedLed.position.y = 1.28;
  pedestal.add(pedLed);
  const cradle = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.3, 0.25, 64), M.whiteGloss);
  cradle.position.y = 1.42;
  pedestal.add(cradle);
  shadow(pedestal);

  /* ---------------- glass globe ---------------- */
  const globe = new THREE.Group();
  globe.name = 'GlassGlobe';
  globe.position.y = 1.55 + 1.6;
  pool.add(globe);
  const glassBall = new THREE.Mesh(
    new THREE.SphereGeometry(1.6, 96, 64),
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff, metalness: 0, roughness: 0.02, transmission: 1, thickness: 1.2, ior: 1.45,
      envMapIntensity: 2.0, clearcoat: 1, specularIntensity: 1,
    }),
  );
  globe.add(glassBall);
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(1.45, 96, 64),
    new THREE.MeshStandardMaterial({
      map: T.globeTexture(), transparent: true, emissive: 0xbfe0ff, emissiveIntensity: 0.9,
      emissiveMap: null, roughness: 0.3, side: THREE.DoubleSide, depthWrite: false,
    }),
  );
  earth.material.emissiveMap = earth.material.map;
  globe.add(earth);
  anim.push((t) => {
    earth.rotation.y = t * 0.08;
  });

  /* ---------------- gold spiral sculpture ---------------- */
  class Helix extends THREE.Curve {
    constructor(phase, turns, r0, r1, y0, y1) {
      super();
      Object.assign(this, { phase, turns, r0, r1, y0, y1 });
    }
    getPoint(t, target = new THREE.Vector3()) {
      const a = this.phase + t * this.turns * Math.PI * 2;
      const r = this.r0 + (this.r1 - this.r0) * Math.sin(t * Math.PI) ** 0.7;
      return target.set(Math.cos(a) * r, this.y0 + (this.y1 - this.y0) * t, Math.sin(a) * r);
    }
  }
  const spiral = new THREE.Group();
  spiral.name = 'GoldSpiral';
  const h1 = new THREE.Mesh(new THREE.TubeGeometry(new Helix(0, 2.2, 1.9, 3.4, 3.2, 10.2), 400, 0.07, 10), M.gold);
  const h2 = new THREE.Mesh(new THREE.TubeGeometry(new Helix(Math.PI, 1.6, 2.4, 4.2, 5.0, 10.2), 300, 0.035, 8), M.gold);
  spiral.add(h1, h2);
  shadow(spiral, true, false);
  pool.add(spiral);
  anim.push((t) => {
    spiral.rotation.y = t * 0.03;
  });

  /* ---------------- plants (instanced) ---------------- */
  const trees = [];
  const bushes = [];
  const r = T.rng(99);
  const addTree = (p, s = 1) => trees.push({ p, s: s * (0.8 + r() * 0.4), rot: r() * 6.28 });
  const addBush = (p, s = 1) => bushes.push({ p, s: s * (0.7 + r() * 0.6), rot: r() * 6.28 });

  /* ---------------- planters around pool ---------------- */
  const planters = new THREE.Group();
  planters.name = 'PoolPlanters';
  root.add(planters);
  // 6 arcs, gaps aligned with entrance/vote so the pool edge stays reachable
  for (let k = 0; k < 6; k++) {
    const a0 = k * (Math.PI / 3) + 0.2;
    const a1 = (k + 1) * (Math.PI / 3) - 0.2;
    const box = arcSolid(R.planterIn, R.planterOut, 0.55, a0, a1, M.stone);
    planters.add(box);
    const soil = arcSolid(R.planterIn + 0.08, R.planterOut - 0.08, 0.02, a0 + 0.01, a1 - 0.01, M.soil);
    soil.position.y = 0.5;
    planters.add(soil);
    for (let j = 0; j < 7; j++) {
      const a = a0 + (a1 - a0) * ((j + 0.5) / 7);
      addBush(polar(a, (R.planterIn + R.planterOut) / 2, 0.5), 0.55);
    }
    addTree(polar((a0 + a1) / 2, (R.planterIn + R.planterOut) / 2, 0.5), 0.55);
  }
  shadow(planters);
  colliders.push({ x: 0, z: 0, r: R.planterOut + 0.35, ring: true });

  /* ---------------- exhibition panels ---------------- */
  const panels = [];
  const panelGroup = new THREE.Group();
  panelGroup.name = 'ExhibitionPanels';
  root.add(panelGroup);
  const baseY = 0.35;
  ENTRIES.forEach((entry, i) => {
    const a = (i + 1) * SLOT;
    const g = new THREE.Group();
    g.name = `Panel_${entry.no}`;
    g.position.copy(polar(a, R.panel));
    g.lookAt(0, 0, 0);

    const W = SPEC.panelWidth, H = SPEC.panelHeight;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(W + 0.12, H + 0.12, 0.28), M.white);
    frame.position.set(0, baseY + H / 2, -0.14);
    g.add(frame);
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(W, H),
      new THREE.MeshStandardMaterial({ map: T.panelTexture(entry), roughness: 0.55 }),
    );
    face.material.map.anisotropy = aniso;
    face.position.set(0, baseY + H / 2, 0.001);
    face.name = `PanelFace_${entry.no}`;
    face.userData.entry = entry;
    face.userData.index = i;
    g.add(face);
    interactive.push(face);
    // plinth with LED line
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(W + 0.3, baseY, 0.6), M.stone);
    plinth.position.set(0, baseY / 2, -0.05);
    g.add(plinth);
    const led = new THREE.Mesh(new THREE.BoxGeometry(W + 0.3, 0.02, 0.02), M.led);
    led.position.set(0, 0.03, 0.26);
    g.add(led);
    // side planters
    for (const sx of [-1, 1]) {
      const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.35, 0.5, 32), M.white);
      pl.position.set(sx * (W / 2 + 0.75), 0.25, 0.1);
      g.add(pl);
    }
    shadow(g);
    panelGroup.add(g);
    g.updateMatrixWorld(true);
    for (const sx of [-1, 1]) {
      const wp = new THREE.Vector3(sx * (W / 2 + 0.75), 0.5, 0.1).applyMatrix4(g.matrixWorld);
      addBush(wp, 0.6);
      addBush(wp.clone().add(new THREE.Vector3(0, 0.3, 0)), 0.45);
    }

    // viewing position: 3.6 m in front of the panel, eye level
    const view = polar(a, R.panel - 3.6, 1.65);
    const target = polar(a, R.panel, baseY + H / 2);
    panels.push({ entry, mesh: face, group: g, angle: a, view, target });
    colliders.push({ x: g.position.x, z: g.position.z, r: 1.9 });
  });

  /* ---------------- perimeter planting bed ---------------- */
  const bed = new THREE.Group();
  bed.name = 'PerimeterPlanting';
  root.add(bed);
  // skip the entrance slot (angle 0)
  const bedA0 = SLOT * 0.62, bedA1 = Math.PI * 2 - SLOT * 0.62;
  bed.add(arcSolid(R.bedIn, R.hall - 0.3, 0.4, bedA0, bedA1, M.stone, 128));
  const bedSoil = arcSolid(R.bedIn + 0.1, R.hall - 0.4, 0.02, bedA0, bedA1, M.soil, 128);
  bedSoil.position.y = 0.4;
  bed.add(bedSoil);
  shadow(bed);
  for (let k = 0; k < 44; k++) {
    const a = bedA0 + (bedA1 - bedA0) * ((k + r() * 0.6) / 44);
    const rr = R.bedIn + 0.8 + r() * 2.3;
    if (Math.abs(((a / SLOT) % 1) - 0) < 0.12 || Math.abs(((a / SLOT) % 1) - 1) < 0.12) {
      // right behind a panel → keep trees a bit further back
      addTree(polar(a, Math.max(rr, R.bedIn + 2.2), 0.4), 1.15);
    } else addTree(polar(a, rr, 0.4), 1.0 + r() * 0.4);
  }
  for (let k = 0; k < 280; k++) {
    const a = bedA0 + (bedA1 - bedA0) * r();
    addBush(polar(a, R.bedIn + 0.3 + r() * 3.2, 0.4), 0.6);
  }

  /* ---------------- columns, glass wall ---------------- */
  const shell = new THREE.Group();
  shell.name = 'Shell';
  root.add(shell);
  const wallH = SPEC.ceilingHeight + 0.3; // up to the slab underside
  const colGeo = new THREE.CylinderGeometry(0.22, 0.22, wallH, 24);
  const entryHalf = 0.2;
  const colAngles = [entryHalf, -entryHalf];
  for (let k = 0; k < 24; k++) {
    const a = k * (Math.PI / 12) + Math.PI / 24;
    if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) > entryHalf + 0.1) colAngles.push(a);
  }
  for (const a of colAngles) {
    const c = new THREE.Mesh(colGeo, M.white);
    c.position.copy(polar(a, R.hall - 0.1, wallH / 2));
    shell.add(c);
  }
  // glass wall with an opening for the entrance
  const glassWall = new THREE.Mesh(
    new THREE.CylinderGeometry(R.hall, R.hall, wallH, 128, 1, true, entryHalf, Math.PI * 2 - entryHalf * 2),
    M.glass,
  );
  glassWall.position.y = wallH / 2;
  glassWall.name = 'GlassWall';
  glassWall.renderOrder = 2;
  shell.add(glassWall);
  // horizontal mullions
  const mullionGeo = new THREE.TorusGeometry(R.hall, 0.04, 6, 192, Math.PI * 2 - entryHalf * 2);
  mullionGeo.rotateX(Math.PI / 2);
  mullionGeo.rotateY(-(Math.PI / 2 + entryHalf)); // torus starts at +X; align with the wall opening
  for (const y of [0.05, 3.2, wallH - 0.05]) {
    const m = new THREE.Mesh(mullionGeo, M.mullion);
    m.position.y = y;
    shell.add(m);
  }
  shadow(shell, true, true);
  shell.getObjectByName('GlassWall').castShadow = false;
  colliders.push({ x: 0, z: 0, r: R.hall - 0.6, outer: true });

  /* ---------------- ceiling ---------------- */
  const ceiling = new THREE.Group();
  ceiling.name = 'Ceiling';
  root.add(ceiling);
  const slabHole = new THREE.Mesh(new THREE.RingGeometry(R.oculus, R.hall + 0.6, 128), M.white);
  slabHole.rotation.x = Math.PI / 2;
  slabHole.position.y = SPEC.ceilingHeight + 0.3;
  ceiling.add(slabHole);
  const roofTop = slabHole.clone();
  roofTop.rotation.x = -Math.PI / 2;
  roofTop.position.y = SPEC.ceilingHeight + 0.7;
  ceiling.add(roofTop);
  const outerFascia = new THREE.Mesh(new THREE.CylinderGeometry(R.hall + 0.6, R.hall + 0.6, 0.4, 128, 1, true), M.white);
  outerFascia.position.y = SPEC.ceilingHeight + 0.5;
  ceiling.add(outerFascia);
  // wooden louvers: concentric bands hanging below the slab
  for (let rr = R.oculus + 0.6; rr < R.hall; rr += 0.45) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, 0.28, 128, 1, true), M.wood);
    band.position.y = SPEC.ceilingHeight + 0.16;
    ceiling.add(band);
  }
  M.wood.side = THREE.DoubleSide;
  // oculus fascia + LED
  const fascia = new THREE.Mesh(new THREE.CylinderGeometry(R.oculus, R.oculus, 1.0, 128, 1, true), M.white);
  fascia.material = M.white.clone();
  fascia.material.side = THREE.DoubleSide;
  fascia.position.y = SPEC.ceilingHeight + 0.2;
  ceiling.add(fascia);
  const ocLed = new THREE.Mesh(new THREE.TorusGeometry(R.oculus + 0.05, 0.03, 6, 160), M.led);
  ocLed.rotation.x = Math.PI / 2;
  ocLed.position.y = SPEC.ceilingHeight - 0.28;
  ceiling.add(ocLed);
  const perimLed = new THREE.Mesh(new THREE.TorusGeometry(R.hall - 0.35, 0.03, 6, 192), M.led);
  perimLed.rotation.x = Math.PI / 2;
  perimLed.position.y = SPEC.ceilingHeight - 0.02;
  ceiling.add(perimLed);
  // raised glass drum above the oculus (central void up to 10 m)
  const drum = new THREE.Mesh(
    new THREE.CylinderGeometry(R.oculus, R.oculus, SPEC.voidHeight - SPEC.ceilingHeight - 0.6, 96, 1, true),
    M.glass,
  );
  drum.position.y = (SPEC.voidHeight + SPEC.ceilingHeight + 0.6) / 2;
  drum.renderOrder = 2;
  ceiling.add(drum);
  const drumTop = new THREE.Mesh(new THREE.TorusGeometry(R.oculus, 0.18, 12, 128), M.white);
  drumTop.rotation.x = Math.PI / 2;
  drumTop.position.y = SPEC.voidHeight;
  ceiling.add(drumTop);
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, SPEC.voidHeight - SPEC.ceilingHeight - 0.6, 0.1), M.mullion);
    post.position.copy(polar(a, R.oculus, (SPEC.voidHeight + SPEC.ceilingHeight + 0.6) / 2));
    ceiling.add(post);
  }
  // thin hanging lines around the spiral
  const wires = new THREE.BufferGeometry();
  const wp = [];
  for (let k = 0; k < 40; k++) {
    const a = (k / 40) * Math.PI * 2;
    const rr = 1.5 + (k % 5) * 0.7;
    const y0 = 4 + (k % 7) * 0.5;
    wp.push(Math.cos(a) * rr, y0, Math.sin(a) * rr, Math.cos(a) * rr, SPEC.voidHeight, Math.sin(a) * rr);
  }
  wires.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3));
  const wireLines = new THREE.LineSegments(wires, new THREE.LineBasicMaterial({ color: 0xe8d9b0, transparent: true, opacity: 0.45 }));
  wireLines.name = 'HangingWires';
  ceiling.add(wireLines);
  shadow(ceiling, false, true);
  drum.castShadow = false;

  /* ---------------- benches ---------------- */
  const benches = new THREE.Group();
  benches.name = 'Benches';
  root.add(benches);
  const benchAngles = [2.5, 4.5, 6.5, 8.5, 10.5].map((k) => k * SLOT);
  for (const a of benchAngles) {
    const b = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.38, 0.55), M.stone);
    base.position.y = 0.19;
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.07, 0.62), M.wood);
    top.position.y = 0.415;
    const led = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.015, 0.015), M.led);
    led.position.set(0, 0.02, 0.28);
    b.add(base, top, led);
    b.position.copy(polar(a, R.planterOut + 1.4));
    b.lookAt(polar(a, 30));
    benches.add(b);
    colliders.push({ x: b.position.x, z: b.position.z, r: 1.3 });
  }
  shadow(benches);

  /* ---------------- entrance ---------------- */
  const entrance = new THREE.Group();
  entrance.name = 'Entrance';
  root.add(entrance);
  const eW = 6.4, eH = 4.6, eL = 7;
  const eFloor = new THREE.Mesh(new THREE.PlaneGeometry(eW, eL + 1), M.floor);
  eFloor.rotation.x = -Math.PI / 2;
  eFloor.position.set(0, 0.002, R.hall + eL / 2 - 0.5);
  entrance.add(eFloor);
  const eRoof = new THREE.Mesh(new THREE.BoxGeometry(eW + 0.6, 0.35, eL), M.white);
  eRoof.position.set(0, eH + 0.17, R.hall + eL / 2);
  entrance.add(eRoof);
  const eLed = new THREE.Mesh(new THREE.BoxGeometry(eW - 1, 0.02, eL - 0.6), M.led);
  eLed.position.set(0, eH - 0.01, R.hall + eL / 2);
  entrance.add(eLed);
  // left: navy sign wall, right: white wall with slogan
  const signMat = new THREE.MeshStandardMaterial({
    map: T.textTexture([
      { text: 'VDWC', size: 230, weight: 600, color: '#ffffff', spacing: 14 },
      { text: 'Virtual Design World Cup', size: 70, weight: 400, color: '#dfe6f2', gap: 10 },
    ], { w: 1400, h: 900, bg: '#16243f' }),
    roughness: 0.5,
  });
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.3, eH, eL), [M.navy, M.navy, M.navy, M.navy, M.navy, M.navy]);
  leftWall.position.set(-eW / 2 - 0.15, eH / 2, R.hall + eL / 2);
  entrance.add(leftWall);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.8), signMat);
  sign.position.set(-eW / 2 + 0.01, 2.4, R.hall + eL / 2);
  sign.rotation.y = Math.PI / 2;
  entrance.add(sign);
  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.3, eH, eL), M.white);
  rightWall.position.set(eW / 2 + 0.15, eH / 2, R.hall + eL / 2);
  entrance.add(rightWall);
  const slogan = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 1.6),
    new THREE.MeshStandardMaterial({
      map: T.textTexture([
        { text: 'Design', size: 120, weight: 400, color: '#1b2a44' },
        { text: 'for a', size: 120, weight: 400, color: '#1b2a44' },
        { text: 'Better', size: 120, weight: 400, color: '#1b2a44' },
        { text: 'Future.', size: 120, weight: 400, color: '#1b2a44' },
      ], { w: 800, h: 700, align: 'left', pad: 40 }),
      transparent: true,
    }),
  );
  slogan.position.set(eW / 2 - 0.01, 2.6, R.hall + eL / 2 + 1.2);
  slogan.rotation.y = -Math.PI / 2;
  entrance.add(slogan);
  // entrance planters
  for (const sx of [-1, 1]) {
    for (const dz of [eL - 1.2]) {
      const pl = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 1.4), M.stone);
      pl.position.set(sx * (eW / 2 - 0.55), 0.25, R.hall + dz);
      entrance.add(pl);
      addTree(new THREE.Vector3(sx * (eW / 2 - 0.55), 0.5, R.hall + dz), 0.75);
    }
  }
  shadow(entrance);

  // text monoliths at the mouth of the entrance, greeting arriving visitors
  const monoText = (lines) => new THREE.MeshStandardMaterial({
    map: T.textTexture(lines.map((t) => ({ text: t, size: 64, weight: 400, color: '#2c3440', spacing: 6 })),
      { w: 700, h: 900, align: 'left', pad: 60, bg: '#e7e1d6' }),
    roughness: 0.7,
  });
  const monoliths = [
    { side: -1, lines: ['PEOPLE', 'CITIES', 'INFRASTRUCTURE', 'NATURE', 'TOGETHER'] },
    { side: 1, lines: ['IDEAS', 'SIMULATION', 'DESIGN', 'A SUSTAINABLE', 'TOMORROW.'] },
  ];
  for (const { side, lines } of monoliths) {
    const a = -side * 0.23; // PEOPLE… on the visitor's left, IDEAS… on the right
    const mat = monoText(lines);
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.1, 0.5), [M.stone, M.stone, M.stone, M.stone, mat, M.stone]);
    box.position.copy(polar(a, R.hall - 2.1, 1.05));
    box.lookAt(polar(0, R.hall + 5, 1.05));
    box.name = side < 0 ? 'Monolith_People' : 'Monolith_Ideas';
    root.add(shadow(box));
    colliders.push({ x: box.position.x, z: box.position.z, r: 1.0 });
  }

  /* ---------------- voting area ---------------- */
  const vote = new THREE.Group();
  vote.name = 'VotingArea';
  root.add(vote);
  const va = 11 * SLOT;
  vote.position.copy(polar(va, R.panel - 0.2));
  vote.lookAt(0, 0, 0);
  const back = new THREE.Mesh(new THREE.BoxGeometry(4.4, 3.4, 0.3), M.navy);
  back.position.set(0, 1.7, -0.3);
  const voteSign = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.1), new THREE.MeshStandardMaterial({
    map: T.trophyVoteTexture(), emissive: 0xffffff, emissiveIntensity: 0.25,
  }));
  voteSign.material.emissiveMap = voteSign.material.map;
  voteSign.position.set(0, 2.05, -0.14);
  const desk = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.95, 0.8), M.white);
  desk.position.set(0, 0.475, 1.1);
  const deskTop = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.05, 0.9), M.wood);
  deskTop.position.set(0, 0.97, 1.1);
  vote.add(back, voteSign, desk, deskTop);
  for (let k = 0; k < 3; k++) {
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5), new THREE.MeshStandardMaterial({
      map: T.screenTexture(k), emissive: 0xffffff, emissiveIntensity: 0.8,
    }));
    scr.material.emissiveMap = scr.material.map;
    scr.position.set((k - 1) * 1.1, 1.05, 1.05);
    scr.rotation.x = -Math.PI / 2 + 0.5;
    vote.add(scr);
  }
  const vLed = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.02, 0.02), M.led);
  vLed.position.set(0, 0.03, 1.51);
  vote.add(vLed);
  for (const sx of [-1, 1]) {
    const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.42, 0.6, 32), M.stone);
    pl.position.set(sx * 2.8, 0.3, 0.4);
    vote.add(pl);
  }
  shadow(vote);
  vote.updateMatrixWorld(true);
  for (const sx of [-1, 1]) {
    const wpos = new THREE.Vector3(sx * 2.8, 0.6, 0.4).applyMatrix4(vote.matrixWorld);
    addTree(wpos, 0.7);
  }
  colliders.push({ x: vote.position.x, z: vote.position.z, r: 2.4 });
  const voteStop = {
    view: polar(va, R.panel - 4.4, 1.65),
    target: polar(va, R.panel, 1.7),
  };

  /* ---------------- build instanced vegetation ---------------- */
  buildVegetation(root, trees, bushes, M);

  return { root, anim, interactive, panels, voteStop, colliders, ceiling, exterior: [sky, pano, lake] };
}

function buildVegetation(root, trees, bushes, M) {
  const r = T.rng(7);
  const greens = [0x3f7a38, 0x4e8c43, 0x2f6b34, 0x5e9a4c, 0x467f3d].map((c) => new THREE.Color(c));
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();

  // trunks
  const trunkGeo = new THREE.CylinderGeometry(0.06, 0.1, 1, 6);
  trunkGeo.translate(0, 0.5, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo, M.trunk, trees.length);
  // foliage clusters
  // lumpy, smooth-shaded blobs read better than faceted icosahedra
  const leafGeo = new THREE.SphereGeometry(1, 10, 7);
  const lp = leafGeo.attributes.position;
  for (let i = 0; i < lp.count; i++) {
    const k = 1 + 0.12 * Math.sin(lp.getX(i) * 5.1 + lp.getY(i) * 3.7) * Math.cos(lp.getZ(i) * 4.3);
    lp.setXYZ(i, lp.getX(i) * k, lp.getY(i) * k, lp.getZ(i) * k);
  }
  leafGeo.computeVertexNormals();
  const perTree = 7;
  const foliage = new THREE.InstancedMesh(leafGeo, M.leaf, trees.length * perTree + bushes.length * 3);
  let fi = 0;
  trees.forEach((t, i) => {
    const h = 2.6 * t.s;
    q.setFromAxisAngle(up, t.rot);
    m4.compose(t.p, q, s.set(t.s, h, t.s));
    trunks.setMatrixAt(i, m4);
    for (let k = 0; k < perTree; k++) {
      const a = t.rot + k * 1.3;
      const rad = k === 0 ? 0 : (0.35 + r() * 0.35) * t.s;
      p.set(t.p.x + Math.cos(a) * rad, t.p.y + h * (0.78 + r() * 0.32) + (k === 0 ? 0.3 * t.s : 0), t.p.z + Math.sin(a) * rad);
      const sc = (0.38 + r() * 0.22) * t.s;
      q.setFromEuler(new THREE.Euler(r() * 3, r() * 3, r() * 3));
      m4.compose(p, q, s.set(sc, sc * 0.8, sc));
      foliage.setMatrixAt(fi, m4);
      foliage.setColorAt(fi++, greens[Math.floor(r() * greens.length)]);
    }
  });
  bushes.forEach((b) => {
    for (let k = 0; k < 3; k++) {
      const a = b.rot + k * 2.1;
      p.set(b.p.x + Math.cos(a) * 0.18 * b.s, b.p.y + 0.22 * b.s, b.p.z + Math.sin(a) * 0.18 * b.s);
      const sc = (0.28 + r() * 0.12) * b.s;
      q.setFromEuler(new THREE.Euler(r() * 3, r() * 3, r() * 3));
      m4.compose(p, q, s.set(sc, sc * 0.85, sc));
      foliage.setMatrixAt(fi, m4);
      foliage.setColorAt(fi++, greens[Math.floor(r() * greens.length)]);
    }
  });
  foliage.count = fi;
  trunks.castShadow = foliage.castShadow = true;
  trunks.receiveShadow = foliage.receiveShadow = true;
  trunks.name = 'TreeTrunks';
  foliage.name = 'Foliage';
  foliage.computeBoundingSphere();
  trunks.computeBoundingSphere();
  root.add(trunks, foliage);
}
