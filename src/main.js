import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { PointerLockControls } from 'three/addons/PointerLockControls.js';
import { RoomEnvironment } from 'three/addons/RoomEnvironment.js';
import { GLTFExporter } from 'three/addons/GLTFExporter.js';
import { buildHall, polar } from './hall.js';
import { R, SLOT, SPEC } from './data.js';
import { Q, TOUCH } from './quality.js';

/* ---------------- renderer / scene ---------------- */
const container = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Q.pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.localClippingEnabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xdfe9f2, 60, 260);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.05, 1200);

/* ---------------- lights ---------------- */
scene.add(new THREE.HemisphereLight(0xeaf4ff, 0xcbbd9f, 1.1));
const sun = new THREE.DirectionalLight(0xfff3e0, 2.6);
sun.position.set(-30, 45, -18);
sun.castShadow = true;
sun.shadow.mapSize.set(Q.shadowMap, Q.shadowMap);
Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 120 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun);
// soft interior fill under the ceiling ring
const fill = new THREE.PointLight(0xfff0dc, 40, 22, 1.6);
fill.position.set(0, 6.2, 0);
scene.add(fill);

/* ---------------- build ---------------- */
const hall = buildHall({ renderer });
scene.add(hall.root);

// Section cut (立面図): clip everything in front of the hall's centre plane.
const sectionPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 1e6);
const exterior = new Set(hall.exterior);
hall.root.traverse((o) => {
  if (!o.material || exterior.has(o)) return;
  for (const m of [].concat(o.material)) m.clippingPlanes = [sectionPlane];
});
function setSection(on) {
  sectionPlane.constant = on ? 0.2 : 1e6;
  $('btn-section').classList.toggle('active', on);
}

/* ---------------- camera stops ---------------- */
const STOPS = {
  hero: { view: new THREE.Vector3(0, 2.3, R.planterOut + 6.4), target: new THREE.Vector3(0, 2.9, 0) },
  plan: { view: new THREE.Vector3(0, 48, 0.01), target: new THREE.Vector3(0, 0, 0) },
  section: { view: new THREE.Vector3(0, 5, 25), target: new THREE.Vector3(0, 4.2, 0), section: true },
  entrance: { view: new THREE.Vector3(0, 1.65, R.hall + 6.2), target: new THREE.Vector3(0, 1.9, R.hall - 6) },
  vote: hall.voteStop,
};
hall.panels.forEach((p, i) => (STOPS['p' + (i + 1)] = { view: p.view, target: p.target }));

camera.position.copy(STOPS.hero.view);

/* ---------------- controls ---------------- */
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.target.copy(STOPS.hero.target);
orbit.enableDamping = true;
orbit.dampingFactor = 0.08;
orbit.maxDistance = 120;
orbit.minDistance = 0.5;
orbit.maxPolarAngle = Math.PI * 0.495;
orbit.update();

const walk = new PointerLockControls(camera, renderer.domElement);
let mode = 'orbit';
const keys = {};
addEventListener('keydown', (e) => (keys[e.code] = true));
addEventListener('keyup', (e) => (keys[e.code] = false));

const $ = (id) => document.getElementById(id);
function setMode(m) {
  mode = m;
  $('btn-orbit').classList.toggle('active', m === 'orbit');
  $('btn-walk').classList.toggle('active', m === 'walk');
  $('walk-hint').hidden = m !== 'walk';
  if (m === 'walk') {
    camera.position.y = 1.65;
    clampWalk(camera.position);
    orbit.enabled = false;
  } else {
    if (walk.isLocked) walk.unlock();
    touchLook.id = null;
    orbit.enabled = true;
    const dir = camera.getWorldDirection(new THREE.Vector3());
    orbit.target.copy(camera.position).addScaledVector(dir, 6);
    orbit.update();
  }
}
$('btn-orbit').onclick = () => setMode('orbit');
$('btn-section').onclick = () => setSection(sectionPlane.constant > 1e5);
$('btn-walk').onclick = () => {
  stopTour();
  hideInfo();
  setMode('walk');
  if (TOUCH) {
    $('walk-hint').textContent = '左下のスティックで移動・画面をドラッグで視点';
    setTimeout(() => ($('walk-hint').hidden = true), 3500);
  }
  else walk.lock();
};
walk.addEventListener('unlock', () => {
  if (mode === 'walk') $('walk-hint').textContent = 'クリックで操作再開 ／ Esc で解除';
});
walk.addEventListener('lock', () => {
  $('walk-hint').textContent = 'WASD / 矢印キーで移動・マウスで視点・Shift で速く・Esc で解除';
});
renderer.domElement.addEventListener('click', () => {
  if (mode === 'walk' && !TOUCH && !walk.isLocked) walk.lock();
});

/* ---------------- touch walk: joystick + drag to look ---------------- */
const joy = { x: 0, y: 0, id: null };
const touchLook = { id: null, x: 0, y: 0 };
const lookEuler = new THREE.Euler(0, 0, 0, 'YXZ');
{
  const pad = $('joystick'), knob = pad.querySelector('span');
  const move = (e) => {
    const r = pad.getBoundingClientRect();
    const R0 = r.width / 2;
    let dx = e.clientX - (r.left + R0), dy = e.clientY - (r.top + R0);
    const d = Math.hypot(dx, dy);
    if (d > R0) { dx *= R0 / d; dy *= R0 / d; }
    joy.x = dx / R0;
    joy.y = dy / R0;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  };
  const end = () => {
    joy.id = null; joy.x = joy.y = 0;
    knob.style.transform = '';
  };
  pad.addEventListener('pointerdown', (e) => {
    joy.id = e.pointerId;
    pad.setPointerCapture(e.pointerId);
    move(e);
  });
  pad.addEventListener('pointermove', (e) => e.pointerId === joy.id && move(e));
  pad.addEventListener('pointerup', end);
  pad.addEventListener('pointercancel', end);
}
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (mode !== 'walk' || !TOUCH) return;
  Object.assign(touchLook, { id: e.pointerId, x: e.clientX, y: e.clientY });
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (mode !== 'walk' || e.pointerId !== touchLook.id) return;
  lookEuler.setFromQuaternion(camera.quaternion);
  lookEuler.y += (e.clientX - touchLook.x) * 0.005;
  lookEuler.x = THREE.MathUtils.clamp(lookEuler.x + (e.clientY - touchLook.y) * 0.005, -1.3, 1.3);
  camera.quaternion.setFromEuler(lookEuler);
  touchLook.x = e.clientX;
  touchLook.y = e.clientY;
});
for (const ev of ['pointerup', 'pointercancel']) {
  renderer.domElement.addEventListener(ev, (e) => e.pointerId === touchLook.id && (touchLook.id = null));
}

/** Keep the walker on the gallery floor (out of the pool, planting and objects). */
function clampWalk(p) {
  // the entrance axis (no planting bed there) connects to the corridor
  const inCorridor = Math.abs(p.x) < 2.9 && p.z > R.bedIn - 0.5;
  let d = Math.hypot(p.x, p.z);
  if (!inCorridor) {
    const outer = R.bedIn - 0.35;
    if (d > outer) {
      p.x *= outer / d;
      p.z *= outer / d;
    }
  } else {
    p.x = THREE.MathUtils.clamp(p.x, -2.7, 2.7);
    p.z = Math.min(p.z, R.hall + 6.4);
  }
  for (const c of hall.colliders) {
    if (c.outer) continue;
    const dx = p.x - c.x, dz = p.z - c.z;
    d = Math.hypot(dx, dz);
    if (d < c.r && d > 1e-4) {
      p.x = c.x + (dx / d) * c.r;
      p.z = c.z + (dz / d) * c.r;
    }
  }
}

/* ---------------- fly-to animation ---------------- */
let flight = null;
function flyTo(stop, duration = 1.8) {
  if (mode === 'walk') setMode('orbit');
  setSection(!!stop.section);
  flight = {
    t: 0,
    duration,
    p0: camera.position.clone(),
    t0: orbit.target.clone(),
    p1: stop.view.clone(),
    t1: stop.target.clone(),
  };
}
function updateFlight(dt) {
  if (!flight) return;
  flight.t += dt / flight.duration;
  const k = Math.min(1, flight.t);
  const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  // move along an arc around the hall centre to avoid cutting through the pool
  const a0 = Math.atan2(flight.p0.x, flight.p0.z), a1 = Math.atan2(flight.p1.x, flight.p1.z);
  let da = a1 - a0;
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  const r0 = Math.hypot(flight.p0.x, flight.p0.z), r1 = Math.hypot(flight.p1.x, flight.p1.z);
  const a = a0 + da * e, rr = r0 + (r1 - r0) * e;
  camera.position.set(Math.sin(a) * rr, flight.p0.y + (flight.p1.y - flight.p0.y) * e, Math.cos(a) * rr);
  orbit.target.lerpVectors(flight.t0, flight.t1, e);
  if (k >= 1) {
    flight.done?.();
    flight = null;
  }
}

/* ---------------- tour ---------------- */
const tourOrder = ['entrance', ...hall.panels.map((_, i) => 'p' + (i + 1)), 'vote'];
let tour = null;
function tourStep() {
  if (!tour) return;
  const key = tourOrder[tour.i];
  highlightStop(key);
  const idx = key.startsWith('p') ? Number(key.slice(1)) - 1 : -1;
  if (idx >= 0) showInfo(hall.panels[idx].entry);
  else hideInfo();
  flyTo(STOPS[key], tour.i === 0 ? 2.2 : 2.6);
  flight.done = () => {
    tour.timer = setTimeout(() => {
      tour.i++;
      if (tour.i >= tourOrder.length) stopTour();
      else tourStep();
    }, 2600);
  };
}
function startTour() {
  stopTour();
  tour = { i: 0 };
  $('btn-tour').textContent = '■ ツアー停止';
  tourStep();
}
function stopTour() {
  if (tour?.timer) clearTimeout(tour.timer);
  tour = null;
  $('btn-tour').textContent = '▶ 自動ツアー';
}
$('btn-tour').onclick = () => (tour ? stopTour() : startTour());

/* ---------------- stop buttons ---------------- */
const stopBar = $('stops');
const labels = [
  ['hero', 'メインビュー'],
  ['entrance', 'エントランス'],
  ...hall.panels.map((p, i) => ['p' + (i + 1), p.entry.no]),
  ['vote', '投票'],
  ['section', '立面'],
  ['plan', '平面'],
];
for (const [key, label] of labels) {
  const b = document.createElement('button');
  b.textContent = label;
  b.dataset.key = key;
  b.onclick = () => {
    stopTour();
    highlightStop(key);
    const idx = key.startsWith('p') ? Number(key.slice(1)) - 1 : -1;
    idx >= 0 ? showInfo(hall.panels[idx].entry) : hideInfo();
    flyTo(STOPS[key]);
  };
  stopBar.appendChild(b);
}
function highlightStop(key) {
  for (const b of stopBar.children) b.classList.toggle('active', b.dataset.key === key);
}

/* ---------------- panel info card ---------------- */
function showInfo(entry) {
  $('info-no').textContent = entry.no;
  $('info-title').textContent = entry.title;
  $('info-team').textContent = entry.team;
  $('info-country').textContent = entry.country;
  $('info-summary').textContent = entry.summary;
  $('info').hidden = false;
}
function hideInfo() {
  $('info').hidden = true;
}
$('info-close').onclick = hideInfo;

const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let downAt = null;
renderer.domElement.addEventListener('pointerdown', (e) => (downAt = [e.clientX, e.clientY]));
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!downAt || mode === 'walk') return;
  if (Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(hall.interactive, false)[0];
  if (hit) {
    stopTour();
    const i = hit.object.userData.index;
    highlightStop('p' + (i + 1));
    showInfo(hit.object.userData.entry);
    flyTo(STOPS['p' + (i + 1)]);
  }
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (mode === 'walk') return;
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  renderer.domElement.style.cursor = ray.intersectObjects(hall.interactive, false).length ? 'pointer' : '';
});

/* ---------------- minimap ---------------- */
const mm = $('minimap');
const mctx = mm.getContext('2d');
function drawMinimap() {
  const S = mm.width, c = S / 2, k = (S / 2 - 8) / (R.hall + 1);
  const P = (x, z) => [c + x * k, c + z * k];
  mctx.clearRect(0, 0, S, S);
  mctx.fillStyle = 'rgba(245,242,236,0.95)';
  mctx.beginPath(); mctx.arc(c, c, R.hall * k, 0, 7); mctx.fill();
  mctx.fillStyle = '#9cc28a';
  mctx.beginPath(); mctx.arc(c, c, (R.hall - 0.3) * k, 0, 7); mctx.arc(c, c, R.bedIn * k, 0, 7, true); mctx.fill();
  mctx.fillStyle = '#b5d49f';
  mctx.beginPath(); mctx.arc(c, c, R.planterOut * k, 0, 7); mctx.fill();
  mctx.fillStyle = '#4f9ad0';
  mctx.beginPath(); mctx.arc(c, c, R.pool * k, 0, 7); mctx.fill();
  mctx.fillStyle = '#eef6ff';
  mctx.beginPath(); mctx.arc(c, c, 2 * k, 0, 7); mctx.fill();
  // entrance
  mctx.fillStyle = '#f5f2ec';
  mctx.fillRect(c - 3.2 * k, c + (R.hall - 4) * k, 6.4 * k, 4 * k + 8);
  // panels
  mctx.font = '600 9px sans-serif';
  mctx.textAlign = 'center';
  mctx.textBaseline = 'middle';
  hall.panels.forEach((p) => {
    const [x, y] = P(p.group.position.x, p.group.position.z);
    mctx.save();
    mctx.translate(x, y);
    mctx.rotate(-p.angle);
    mctx.fillStyle = '#fff';
    mctx.strokeStyle = '#1b2a44';
    mctx.fillRect(-1.5 * k, -0.35 * k, 3 * k, 0.7 * k);
    mctx.strokeRect(-1.5 * k, -0.35 * k, 3 * k, 0.7 * k);
    mctx.restore();
    const [lx, ly] = P(...(() => { const v = polar(p.angle, R.panel - 1.3); return [v.x, v.z]; })());
    mctx.fillStyle = '#1b2a44';
    mctx.fillText(p.entry.no, lx, ly);
  });
  const vp = polar(11 * SLOT, R.panel - 0.2);
  const [vx, vy] = P(vp.x, vp.z);
  mctx.fillStyle = '#16243f';
  mctx.fillRect(vx - 6, vy - 6, 12, 12);
  // camera
  const [cx, cy] = P(camera.position.x, camera.position.z);
  const dir = camera.getWorldDirection(new THREE.Vector3());
  const ang = Math.atan2(dir.z, dir.x);
  mctx.fillStyle = 'rgba(230,80,60,0.25)';
  mctx.beginPath();
  mctx.moveTo(cx, cy);
  mctx.arc(cx, cy, 26, ang - 0.45, ang + 0.45);
  mctx.fill();
  mctx.fillStyle = '#e6503c';
  mctx.beginPath(); mctx.arc(cx, cy, 4, 0, 7); mctx.fill();
}

/* ---------------- GLB export ---------------- */
$('btn-export').onclick = async () => {
  const btn = $('btn-export');
  btn.disabled = true;
  btn.textContent = '書き出し中…';
  try {
    const exporter = new GLTFExporter();
    const glb = await exporter.parseAsync(hall.root, { binary: true, maxTextureSize: 2048 });
    const url = URL.createObjectURL(new Blob([glb], { type: 'model/gltf-binary' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vdwc_gallery.glb';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (err) {
    console.error(err);
    alert('GLB の書き出しに失敗しました: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'GLB 書き出し';
  }
};

$('btn-shot').onclick = () => {
  renderer.render(scene, camera);
  const a = document.createElement('a');
  a.href = renderer.domElement.toDataURL('image/png');
  a.download = 'vdwc_view.png';
  a.click();
};

/* ---------------- stats ---------------- */
let tris = 0;
hall.root.traverse((o) => {
  if (!o.isMesh || !o.geometry) return;
  const g = o.geometry;
  const n = (g.index ? g.index.count : g.attributes.position.count) / 3;
  tris += n * (o.isInstancedMesh ? o.count : 1);
});
$('stats').textContent = `約 ${Math.round(tris / 1000)}k ポリゴン ／ 直径 ${SPEC.hallDiameter}m・天井高 ${SPEC.ceilingHeight}m`;

/* ---------------- loop ---------------- */
const timer = new THREE.Timer();
timer.connect(document);
const fwd = new THREE.Vector3();
const right = new THREE.Vector3();
function animate() {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.05);
  const t = timer.getElapsed();
  for (const f of hall.anim) f(t);

  $('joystick').hidden = !(mode === 'walk' && TOUCH);
  if (mode === 'walk' && (walk.isLocked || TOUCH)) {
    const speed = (keys.ShiftLeft || keys.ShiftRight ? 4.5 : 2.2) * dt;
    camera.getWorldDirection(fwd);
    fwd.y = 0;
    fwd.normalize();
    right.crossVectors(fwd, camera.up).normalize();
    const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
    const s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + joy.x;
    const fj = f - joy.y;
    camera.position.addScaledVector(fwd, fj * speed).addScaledVector(right, s * speed);
    camera.position.y = 1.65;
    clampWalk(camera.position);
  } else if (mode === 'orbit') {
    updateFlight(dt);
    orbit.update();
  }
  // roof cut-away when looking from above (平面図)
  hall.ceiling.visible = camera.position.y < SPEC.voidHeight + 2;
  renderer.render(scene, camera);
  drawMinimap();
}
renderer.setAnimationLoop(animate);

function onResize() {
  camera.aspect = innerWidth / innerHeight;
  // portrait phones: keep ~60° horizontal view so a whole panel fits on screen
  camera.fov = camera.aspect < 1
    ? Math.min(85, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(30)) / camera.aspect)))
    : 55;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
addEventListener('resize', onResize);
addEventListener('orientationchange', () => setTimeout(onResize, 300));
window.visualViewport?.addEventListener('resize', onResize);
onResize();

$('loading').remove();
window.__vdwc = { scene, camera, flyTo, STOPS, orbit, hall, GLTFExporter };
