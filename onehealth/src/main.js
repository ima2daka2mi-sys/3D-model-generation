import * as THREE from 'three';
import { buildWorld, insideAny, pushOut, inside } from './world.js';
import * as M from './models.js';
import { ZONES, SCENARIOS, rankFor } from './content.js';

const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem('onehealth:' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('onehealth:' + k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};

/* ---------------- renderer ---------------- */
const coarse = matchMedia('(pointer: coarse)').matches;
const TOUCH = coarse || navigator.maxTouchPoints > 0;
const MOBILE = coarse && Math.min(screen.width, screen.height) < 820;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
$('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 600);

scene.add(new THREE.HemisphereLight(0xe8f6ff, 0x7aa860, 1.5));
const sun = new THREE.DirectionalLight(0xfff2dc, 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -28, right: 28, top: 28, bottom: -28, near: 1, far: 120 });
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);

const W = buildWorld(scene);

/* ---------------- player ---------------- */
let look = { ...M.DEFAULT_LOOK, ...store.get('look', {}) };
let avatar = M.avatar(look);
scene.add(avatar);
const player = { pos: new THREE.Vector3(0, 0, 7.5), yaw: 0, phase: 0, moving: false, target: null, targetMark: null };
const cam = { yaw: Math.PI, pitch: 0.42, dist: 7.5, mode: 'third' };
const SPEED = 4.2, RADIUS = 0.35;

function rebuildAvatar() {
  scene.remove(avatar);
  avatar = M.avatar(look);
  scene.add(avatar);
  store.set('look', look);
}

/* ---------------- progress ---------------- */
const state = {
  results: {}, // id -> { correct }
  best: store.get('best', {}), // zone -> 'gold' | 'silver'
};
const zoneScenarios = (z) => SCENARIOS.filter((s) => s.zone === z);
function zoneProgress(z) {
  const list = zoneScenarios(z);
  const done = list.filter((s) => state.results[s.id]).length;
  return { done, total: list.length, cleared: done === list.length };
}
function zoneStamp(z) {
  const list = zoneScenarios(z);
  if (!list.every((s) => state.results[s.id])) return null;
  return list.every((s) => state.results[s.id].correct) ? 'gold' : 'silver';
}
function refreshProgress() {
  for (const z of ZONES) {
    const p = zoneProgress(z.id);
    W.zones[z.id].setGate(p.done, p.total, zoneStamp(z.id) || null);
    const chip = $('prog-' + z.id);
    chip.querySelector('b').textContent = `${p.done}/${p.total}`;
    chip.classList.toggle('done', p.cleared);
  }
  renderStampCard();
}

/* ---------------- audio (WebAudio, starts after the first tap) ---------------- */
let actx = null;
let muted = store.get('muted', false);
function audio() {
  if (muted) return null;
  if (!actx) {
    try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
  }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}
function tone(freq, t0, dur, type = 'sine', gain = 0.18) {
  const a = audio();
  if (!a) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, a.currentTime + t0);
  g.gain.linearRampToValueAtTime(gain, a.currentTime + t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(a.currentTime + t0);
  o.stop(a.currentTime + t0 + dur + 0.05);
}
const sfx = {
  correct() { tone(784, 0, 0.18); tone(1175, 0.12, 0.35); },
  wrong() { tone(220, 0, 0.25, 'triangle', 0.16); tone(185, 0.18, 0.35, 'triangle', 0.14); },
  fanfare() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.3, 'triangle', 0.16)); [523, 659, 784].forEach((f) => tone(f, 0.55, 0.9, 'sine', 0.1)); },
  pop() { tone(660, 0, 0.12, 'sine', 0.12); },
  bark(vol = 1) {
    const a = audio();
    if (!a || vol <= 0.02) return;
    for (const t0 of [0, 0.22]) {
      const o = a.createOscillator(), g = a.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(620, a.currentTime + t0);
      o.frequency.exponentialRampToValueAtTime(260, a.currentTime + t0 + 0.12);
      g.gain.setValueAtTime(0, a.currentTime + t0);
      g.gain.linearRampToValueAtTime(0.16 * vol, a.currentTime + t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + t0 + 0.14);
      const f = a.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 1800;
      o.connect(f).connect(g).connect(a.destination);
      o.start(a.currentTime + t0);
      o.stop(a.currentTime + t0 + 0.2);
    }
  },
};
function setMuted(m) {
  muted = m;
  store.set('muted', m);
  $('btn-sound').textContent = m ? '音：オフ' : '音：オン';
  $('btn-sound').setAttribute('aria-pressed', String(!m));
  if (m && actx) actx.suspend();
}

/* ---------------- effects ---------------- */
const effects = [];
function spawnGerms(center, n = 10) {
  for (let i = 0; i < n; i++) {
    const g = M.germ(0.14 + Math.random() * 0.1);
    g.position.copy(center).add(new THREE.Vector3(0, 0.6, 0));
    const v = new THREE.Vector3(Math.random() - 0.5, 0.4 + Math.random() * 0.6, Math.random() - 0.5).multiplyScalar(2.2);
    scene.add(g);
    effects.push({ obj: g, life: 4, update(dt) { g.position.addScaledVector(v, dt); v.multiplyScalar(0.97); g.rotation.x += dt * 2; g.rotation.y += dt * 3; } });
  }
}
function spawnRiver(kind) {
  if (!W.river) return;
  const { from, to } = W.river;
  for (let i = 0; i < (kind === 'plastic' ? 40 : 12); i++) {
    const o = kind === 'plastic'
      ? M.mesh(new THREE.OctahedronGeometry(0.07, 0), [0xff5fa2, 0x4fb3ff, 0xffc93f, 0xffffff][i % 4])
      : M.germ(0.13);
    const off = (Math.random() - 0.5) * 2.2;
    const side = new THREE.Vector3().subVectors(to, from).normalize().cross(new THREE.Vector3(0, 1, 0));
    let t = -i * 0.05;
    scene.add(o);
    effects.push({ obj: o, life: 9, update(dt) {
      t += dt * 0.12;
      o.visible = t >= 0;
      o.position.lerpVectors(from, to, Math.max(0, t)).addScaledVector(side, off);
      o.position.y = 0.25 + Math.sin(t * 40 + i) * 0.05;
      o.rotation.y += dt * 2;
    } });
  }
}
function spawnThinFox() {
  const fx = M.fox({ thin: true });
  const from = W.anchors.forestDamage.clone(), to = W.anchors.parkWorld.clone();
  from.y = to.y = 0;
  scene.add(fx);
  let t = 0;
  effects.push({ obj: fx, life: 6, update(dt) {
    t = Math.min(1, t + dt / 5);
    fx.position.lerpVectors(from, to, t);
    fx.lookAt(to.x, 0, to.z);
    fx.position.y = Math.abs(Math.sin(t * 40)) * 0.05;
  } });
}
function spawnSparkle(pos) {
  for (let i = 0; i < 14; i++) {
    const s = M.mesh(new THREE.OctahedronGeometry(0.09, 0), 0xffd84a, { emissive: 0x6a5000 });
    s.position.copy(pos);
    const v = new THREE.Vector3(Math.cos(i) * 1.5, 1.5 + Math.random(), Math.sin(i) * 1.5);
    scene.add(s);
    effects.push({ obj: s, life: 1.4, update(dt) { s.position.addScaledVector(v, dt); v.y -= 4 * dt; s.rotation.y += dt * 6; } });
  }
}
function playEffect(sc, mark) {
  const pos = mark.sprite.position.clone();
  pos.y = 0.3;
  if (sc.effect === 'germs') spawnGerms(pos);
  if (sc.effect === 'river') { spawnRiver('germs'); spawnGerms(pos, 5); }
  if (sc.effect === 'plastic') spawnRiver('plastic');
  if (sc.effect === 'thin') spawnThinFox();
  if (sc.effect === 'bark') sfx.bark(1);
}

/* ---------------- dialog: scenarios ---------------- */
const dlg = $('dialog');
let open = null; // { sc, mark, step }
function zoneOf(id) { return ZONES.find((z) => z.id === id); }

function showDialog(html, color, mode = '') {
  dlg.style.setProperty('--zone', color || 'var(--accent)');
  dlg.dataset.mode = mode;
  cam.editing = mode === 'side';
  $('dialog-body').innerHTML = html;
  dlg.hidden = false;
  $('hud').classList.add('dimmed');
  const first = dlg.querySelector('button.primary, button.choice');
  first?.focus({ preventScroll: true });
}
function closeDialog() {
  dlg.hidden = true;
  cam.editing = false;
  $('hud').classList.remove('dimmed');
  open = null;
}
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function openScenario(mark) {
  const sc = mark.scenario;
  const z = zoneOf(sc.zone);
  open = { sc, mark };
  player.target = null;
  player.targetMark = null;
  if (sc.id === 'C4') W.lostDog.paused = true;
  const head = `<p class="eyebrow">${esc(z.name)}</p><h2>${esc(sc.title)}</h2>`;
  if (sc.type === 'tip') {
    showDialog(`${head}<p class="lead">${esc(sc.tip)}</p>
      <div class="actions"><button class="primary" data-act="tipdone">わかった！</button></div>`, z.color);
    return;
  }
  if (sc.type === 'pack') {
    const items = sc.items.map((it, i) => `<button class="item" data-item="${i}" aria-pressed="false">${esc(it.label)}</button>`).join('');
    showDialog(`${head}<p class="lead">${esc(sc.situation)}</p><div class="items">${items}</div>
      <p class="feedback" id="pack-feedback" role="status"></p>
      <div class="actions"><button class="primary" data-act="packcheck">これで準備OK！</button></div>`, z.color);
    return;
  }
  const choices = sc.choices.map((c, i) => `<button class="choice" data-choice="${i}">${esc(c)}</button>`).join('');
  showDialog(`${head}<div class="situation"><span class="tag">シチュエーション</span><p>${esc(sc.situation)}</p></div>
    <p class="question">${esc(sc.question)}</p><div class="choices">${choices}</div>`, z.color);
}

function answer(i) {
  const { sc, mark } = open;
  const ok = i === sc.answer;
  if (!(sc.id in state.results)) state.results[sc.id] = { correct: ok, pending: true };
  ok ? sfx.correct() : sfx.wrong();
  playEffect(sc, mark);
  const z = zoneOf(sc.zone);
  showDialog(`<p class="eyebrow">${esc(z.name)}</p>
    <p class="verdict ${ok ? 'ok' : 'ng'}"><span aria-hidden="true">${ok ? '○' : '×'}</span>${ok ? '正解！' : 'ざんねん…'}</p>
    <p class="small">正解は <b>${esc(sc.choices[sc.answer].slice(0, 1))}</b>：${esc(sc.choices[sc.answer].slice(2))}</p>
    <div class="situation warn"><span class="tag">このままだと…</span><p>${esc(sc.damage)}</p></div>
    <div class="actions"><button class="primary" data-act="fix">正しい対処を見る</button></div>`, z.color);
}

function showFix() {
  const { sc } = open;
  const z = zoneOf(sc.zone);
  showDialog(`<p class="eyebrow">${esc(z.name)}</p><h2>正しい対処</h2>
    <div class="situation good"><span class="tag">こうしよう</span><p>${esc(sc.correct)}</p></div>
    <div class="actions"><button class="primary" data-act="resolve">トラブル解決！</button></div>`, z.color);
}

function resolve() {
  const { sc, mark } = open;
  if (!state.results[sc.id]) state.results[sc.id] = { correct: true };
  delete state.results[sc.id].pending;
  mark.done = true;
  mark.sprite.visible = false;
  spawnSparkle(mark.sprite.position.clone());
  sfx.pop();
  if (sc.id === 'C4') {
    // the dog is taken to the pet space and waits for its owner
    W.lostDog.obj.position.copy(W.lostDog.home);
    W.lostDog.obj.rotation.y = W.lostDog.rot;
  }
  closeDialog();
  refreshProgress();
  const p = zoneProgress(sc.zone);
  if (p.cleared) setTimeout(() => zoneClear(sc.zone), 500);
}

function packCheck() {
  const { sc } = open;
  const chosen = [...dlg.querySelectorAll('.item')].map((b) => b.getAttribute('aria-pressed') === 'true');
  const missing = sc.items.filter((it, i) => it.ok && !chosen[i]);
  const wrong = sc.items.filter((it, i) => !it.ok && chosen[i]);
  const ok = !missing.length && !wrong.length;
  if (!(sc.id in state.results)) state.results[sc.id] = { correct: ok, pending: true };
  const fb = $('pack-feedback');
  if (!ok) {
    sfx.wrong();
    const parts = [];
    if (missing.length) parts.push(`足りないものがあるよ（あと${missing.length}つ）。`);
    for (const w of wrong) parts.push(`「${w.label}」：${w.why}`);
    fb.textContent = parts.join(' ');
    fb.className = 'feedback ng';
    return;
  }
  sfx.fanfare();
  const z = zoneOf(sc.zone);
  showDialog(`<p class="eyebrow">${esc(z.name)}</p>
    <p class="verdict ok"><span aria-hidden="true">○</span>準備完了！</p>
    <div class="situation good"><span class="tag">ペットの防災用品</span><p>${esc(sc.correct)}</p></div>
    <div class="actions"><button class="primary" data-act="resolve">トラブル解決！</button></div>`, z.color);
}

dlg.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.choice) answer(Number(b.dataset.choice));
  else if (b.dataset.item) {
    const on = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', String(on));
    sfx.pop();
  } else if (b.dataset.act === 'fix') showFix();
  else if (b.dataset.act === 'resolve') resolve();
  else if (b.dataset.act === 'tipdone') { state.results[open.sc.id] = { correct: true }; resolve(); }
  else if (b.dataset.act === 'packcheck') packCheck();
  else if (b.dataset.act === 'close') closeDialog();
  else if (b.dataset.act === 'hub') { closeDialog(); goHub(); }
  else if (b.dataset.act === 'retry') { const z = b.dataset.zone; closeDialog(); resetZone(z); }
  else if (b.dataset.act === 'start') { closeDialog(); audio(); }
});
$('dialog-close').onclick = () => {
  if (open?.sc?.id === 'C4' && !open.mark.done) W.lostDog.paused = false;
  if (open && state.results[open.sc.id]?.pending) delete state.results[open.sc.id];
  closeDialog();
};

/* ---------------- stamps & endings ---------------- */
function stampSVG(kind, label) {
  const fill = kind === 'gold' ? '#e6b422' : kind === 'silver' ? '#b9c2cc' : 'none';
  const stroke = kind ? '#5a4a1a' : '#9aa6b2';
  return `<svg viewBox="0 0 100 100" class="stamp ${kind || 'empty'}" role="img" aria-label="${label}">
    <circle cx="50" cy="50" r="44" fill="${fill}" stroke="${stroke}" stroke-width="4" ${kind ? '' : 'stroke-dasharray="6 6"'}/>
    ${kind ? '<path d="M30 52 l14 14 l28 -30" fill="none" stroke="#ffffff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>' : ''}
  </svg>`;
}
function renderStampCard() {
  $('stamps').innerHTML = ZONES.map((z) => {
    const now = zoneStamp(z.id), best = state.best[z.id];
    const kind = now || best || null;
    const label = kind === 'gold' ? 'ゴールド' : kind === 'silver' ? 'シルバー' : 'まだ';
    return `<li>${stampSVG(kind, `${z.name}：${label}`)}<span>${z.name}<small>${label}</small></span></li>`;
  }).join('');
  const allGold = ZONES.every((z) => (zoneStamp(z.id) || state.best[z.id]) === 'gold');
  $('badge').hidden = !allGold;
}
function zoneClear(zid) {
  const stamp = zoneStamp(zid);
  if (state.best[zid] !== 'gold') state.best[zid] = stamp;
  store.set('best', state.best);
  refreshProgress();
  sfx.fanfare();
  const z = zoneOf(zid);
  const all = ZONES.every((zz) => zoneProgress(zz.id).cleared);
  const nextHint = stamp === 'silver' ? '<p class="small">まちがえた問題があったのでシルバー。次はゴールドを目指そう！</p>' : '<p class="small">全問正解でゴールドスタンプ！</p>';
  showDialog(`<p class="eyebrow">エリアクリア</p><h2>${esc(z.name)}</h2>
    <div class="stamp-big">${stampSVG(stamp, stamp === 'gold' ? 'ゴールドスタンプ' : 'シルバースタンプ')}<p>${stamp === 'gold' ? 'ゴールド' : 'シルバー'}スタンプ獲得！</p></div>
    ${nextHint}
    <div class="actions">
      ${stamp === 'silver' ? `<button data-act="retry" data-zone="${zid}">もう一度挑戦</button>` : ''}
      <button class="primary" data-act="${all ? 'ending' : 'hub'}">${all ? '結果を見る' : 'エントランスに戻る'}</button>
    </div>`, z.color);
  dlg.querySelector('[data-act="ending"]')?.addEventListener('click', ending, { once: true });
}
function ending() {
  const all = SCENARIOS.filter((s) => state.results[s.id]);
  const rate = all.filter((s) => state.results[s.id].correct).length / SCENARIOS.length;
  const allGold = ZONES.every((z) => zoneStamp(z.id) === 'gold');
  const r = rankFor(rate, allGold);
  showDialog(`<p class="eyebrow">ぜんぶのエリアをクリア！</p><h2>称号「${esc(r.title)}」</h2>
    <p class="lead">${esc(r.text)}</p>
    <p class="small">正解率 ${Math.round(rate * 100)}%</p>
    <ul class="stamps inline">${$('stamps').innerHTML}</ul>
    <div class="actions"><button class="primary" data-act="hub">エントランスに戻る</button></div>`, '#1d4f7a');
}
function resetZone(zid) {
  for (const s of zoneScenarios(zid)) delete state.results[s.id];
  for (const m of W.marks) if (m.scenario.zone === zid) { m.done = false; m.sprite.visible = true; }
  if (zid === 'C') W.lostDog.paused = false;
  refreshProgress();
}

/* ---------------- avatar editor ---------------- */
const OPT_LABEL = { skin: 'はだの色', hairStyle: '髪型', hairColor: '髪の色', top: '上の服', topColor: '上の服の色', bottom: '下の服', bottomColor: '下の服の色' };
function openAvatar() {
  const rows = Object.entries(M.AVATAR_OPTIONS).map(([k, opts]) => {
    const chips = opts.map((o, i) => {
      const isColor = o.startsWith('#');
      return `<button class="chip ${isColor ? 'swatch' : ''}" data-opt="${k}" data-val="${i}" aria-pressed="${look[k] === i}"
        ${isColor ? `style="--sw:${o}" aria-label="${OPT_LABEL[k]} ${i + 1}"` : ''}>${isColor ? '' : esc(o)}</button>`;
    }).join('');
    return `<div class="opt-row"><span>${OPT_LABEL[k]}</span><div>${chips}</div></div>`;
  }).join('');
  showDialog(`<p class="eyebrow">アバター</p><h2>好きなパーツを組み合わせよう</h2>${rows}
    <div class="actions"><button class="primary" data-act="close">決定</button></div>`, '#1d4f7a', 'side');
  cam.mode = 'third';
  $('btn-view').textContent = '視点：三人称';
  cam.yaw = player.yaw + Math.PI;
  cam.dist = 4;
}
dlg.addEventListener('click', (e) => {
  const b = e.target.closest('[data-opt]');
  if (!b) return;
  look[b.dataset.opt] = Number(b.dataset.val);
  for (const c of dlg.querySelectorAll(`[data-opt="${b.dataset.opt}"]`)) c.setAttribute('aria-pressed', String(c === b));
  rebuildAvatar();
});

/* ---------------- HUD buttons ---------------- */
function goHub() {
  player.pos.set(0, 0, 7.5);
  player.yaw = 0;
  player.target = null;
  cam.yaw = Math.PI;
  cam.dist = 7.5;
}
$('btn-hub').onclick = goHub;
$('btn-view').onclick = () => {
  cam.mode = cam.mode === 'third' ? 'first' : 'third';
  if (cam.mode === 'first') { cam.yaw = player.yaw; cam.pitch = 0.05; } else { cam.yaw = player.yaw + Math.PI; cam.pitch = 0.42; }
  $('btn-view').textContent = cam.mode === 'third' ? '視点：三人称' : '視点：一人称';
};
$('btn-avatar').onclick = openAvatar;
$('btn-stamps').onclick = () => {
  showDialog(`<p class="eyebrow">スタンプ台紙</p><h2>3つのテーマでゴールドを集めよう</h2>
    <ul class="stamps inline">${$('stamps').innerHTML}</ul>
    <p class="small">全テーマでゴールドを集めると、称号「ワンヘルスマスター」のバッジがもらえます。</p>
    <div class="actions"><button class="primary" data-act="close">閉じる</button></div>`, '#1d4f7a');
};
$('btn-sound').onclick = () => setMuted(!muted);
$('btn-help').onclick = showIntro;
$('prompt').onclick = () => { if (nearMark) openScenario(nearMark); };

function showIntro() {
  showDialog(`<p class="eyebrow">あそびかた</p><h2>ワンヘルス・クエストへようこそ</h2>
    <p class="lead">エントランス広場から、3つのテーマエリアへ自由に行き来できます。</p>
    <ol class="steps">
      <li>エリアにある <span class="mk">!</span> トラブルマークを調べよう</li>
      <li>「まちがった行動」が出てくるので、なぜダメなのかを選ぼう</li>
      <li>このままだとどうなるかを見て、正しい対処を覚えよう</li>
      <li>マークをすべて解決するとエリアクリア。全問正解でゴールドスタンプ！</li>
    </ol>
    <p class="small">${TOUCH ? '画面をタップした場所へ歩きます。左下のスティックでも移動、ドラッグで見回し、2本指でズーム。' : 'クリックした場所へ歩きます。WASD・矢印キーでも移動、ドラッグで見回し、ホイールでズーム。Eキーで調べる。'}</p>
    <div class="actions"><button class="primary" data-act="start">はじめる</button></div>`, '#1d4f7a');
}

/* ---------------- input ---------------- */
const keys = {};
addEventListener('keydown', (e) => {
  if (!dlg.hidden) { if (e.key === 'Escape') $('dialog-close').click(); return; }
  keys[e.code] = true;
  if ((e.code === 'KeyE' || e.code === 'Enter') && nearMark) openScenario(nearMark);
});
addEventListener('keyup', (e) => (keys[e.code] = false));

const joy = { x: 0, y: 0, id: null };
{
  const pad = $('joystick'), knob = pad.querySelector('span');
  pad.hidden = !TOUCH;
  const move = (e) => {
    const r = pad.getBoundingClientRect(), R0 = r.width / 2;
    let dx = e.clientX - (r.left + R0), dy = e.clientY - (r.top + R0);
    const d = Math.hypot(dx, dy);
    if (d > R0) { dx *= R0 / d; dy *= R0 / d; }
    joy.x = dx / R0; joy.y = dy / R0;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  };
  const end = () => { joy.id = null; joy.x = joy.y = 0; knob.style.transform = ''; };
  pad.addEventListener('pointerdown', (e) => { joy.id = e.pointerId; pad.setPointerCapture(e.pointerId); player.target = null; move(e); });
  pad.addEventListener('pointermove', (e) => e.pointerId === joy.id && move(e));
  pad.addEventListener('pointerup', end);
  pad.addEventListener('pointercancel', end);
}

const ptrs = new Map();
let drag = null, pinch = null;
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const cv = renderer.domElement;
cv.addEventListener('pointerdown', (e) => {
  cv.setPointerCapture(e.pointerId);
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 1) drag = { x: e.clientX, y: e.clientY, moved: 0 };
  if (ptrs.size === 2) {
    const [a, b] = [...ptrs.values()];
    pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), dist: cam.dist };
    drag = null;
  }
});
cv.addEventListener('pointermove', (e) => {
  const p = ptrs.get(e.pointerId);
  if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX; p.y = e.clientY;
  if (pinch && ptrs.size === 2) {
    const [a, b] = [...ptrs.values()];
    cam.dist = THREE.MathUtils.clamp(pinch.dist * pinch.d / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)), 2.5, 16);
    return;
  }
  if (!drag) return;
  drag.moved += Math.abs(dx) + Math.abs(dy);
  if (drag.moved > 8) {
    const s = cam.mode === 'first' ? -1 : 1;
    cam.yaw -= dx * 0.006 * s;
    cam.pitch = THREE.MathUtils.clamp(cam.pitch + dy * 0.004 * (cam.mode === 'first' ? -1 : 1), cam.mode === 'first' ? -0.8 : 0.08, cam.mode === 'first' ? 0.8 : 1.2);
  }
});
const endPtr = (e) => {
  ptrs.delete(e.pointerId);
  if (ptrs.size < 2) pinch = null;
  if (drag && drag.moved <= 8 && e.type === 'pointerup') tap(e.clientX, e.clientY);
  if (ptrs.size === 0) drag = null;
};
cv.addEventListener('pointerup', endPtr);
cv.addEventListener('pointercancel', endPtr);
cv.addEventListener('wheel', (e) => { e.preventDefault(); cam.dist = THREE.MathUtils.clamp(cam.dist + e.deltaY * 0.01, 2.5, 16); }, { passive: false });

function tap(x, y) {
  audio();
  ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const sprites = W.marks.filter((m) => !m.done).map((m) => m.sprite);
  const hit = ray.intersectObjects(sprites, false)[0];
  if (hit) {
    const mark = W.marks.find((m) => m.sprite === hit.object);
    const d = Math.hypot(mark.sprite.position.x - player.pos.x, mark.sprite.position.z - player.pos.z);
    if (d < 2.6) openScenario(mark);
    else { player.target = mark.sprite.position.clone().setY(0); player.targetMark = mark; }
    return;
  }
  const g = ray.intersectObject(W.ground, false)[0];
  if (g) { player.target = g.point.clone().setY(0); player.targetMark = null; showTapRing(g.point); }
}
const tapRing = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.38, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }));
tapRing.rotation.x = -Math.PI / 2;
tapRing.visible = false;
scene.add(tapRing);
function showTapRing(p) { tapRing.position.set(p.x, 0.06, p.z); tapRing.visible = true; tapRing.userData.t = 0.6; }

/* ---------------- movement & collisions ---------------- */
function tryMove(nx, nz) {
  const ok = (x, z) => insideAny(W.walkable, x, z, -RADIUS);
  let x = player.pos.x, z = player.pos.z;
  if (ok(nx, nz)) { x = nx; z = nz; }
  else if (ok(nx, z)) x = nx;
  else if (ok(x, nz)) z = nz;
  for (let it = 0; it < 2; it++) for (const s of W.solids) [x, z] = pushOut(s, x, z, RADIUS);
  const moved = Math.hypot(x - player.pos.x, z - player.pos.z);
  player.pos.x = x;
  player.pos.z = z;
  return moved;
}

let nearMark = null;
function currentZone() {
  for (const z of ZONES) {
    const Z = W.zones[z.id];
    if (inside({ kind: 'obb', x: Z.center.x, z: Z.center.z, hw: 22, hd: 18, rot: Z.rot }, player.pos.x, player.pos.z)) return z;
  }
  return null;
}

/* ---------------- minimap ---------------- */
const mm = $('minimap'), mctx = mm.getContext('2d');
function drawMinimap() {
  const S = mm.width, c = S / 2, k = S / 150;
  const P = (x, z) => [c + x * k, c + (z + 8) * k];
  mctx.clearRect(0, 0, S, S);
  mctx.fillStyle = '#a9d08a';
  mctx.beginPath(); mctx.arc(c, c, c - 2, 0, 7); mctx.fill();
  for (const z of ZONES) {
    const Z = W.zones[z.id];
    const [x, y] = P(Z.center.x, Z.center.z);
    mctx.save();
    mctx.translate(x, y);
    mctx.rotate(-Z.rot);
    mctx.fillStyle = z.color + 'cc';
    mctx.fillRect(-22 * k, -18 * k, 44 * k, 36 * k);
    mctx.restore();
    const [hx, hy] = P(Z.dir.x * 15, Z.dir.z * 15), [ex, ey] = P(Z.dir.x * 31, Z.dir.z * 31);
    mctx.strokeStyle = '#e2d6bd';
    mctx.lineWidth = 6 * k;
    mctx.beginPath(); mctx.moveTo(hx, hy); mctx.lineTo(ex, ey); mctx.stroke();
  }
  const [hx, hy] = P(0, 0);
  mctx.fillStyle = '#efe7d6';
  mctx.beginPath(); mctx.arc(hx, hy, 15 * k, 0, 7); mctx.fill();
  for (const m of W.marks) {
    if (m.done) continue;
    const [x, y] = P(m.sprite.position.x, m.sprite.position.z);
    mctx.fillStyle = m.scenario.type === 'tip' ? '#1f6fd1' : '#e0322a';
    mctx.strokeStyle = '#fff';
    mctx.lineWidth = 1.5;
    mctx.beginPath(); mctx.arc(x, y, 4, 0, 7); mctx.fill(); mctx.stroke();
  }
  const [px, py] = P(player.pos.x, player.pos.z);
  mctx.save();
  mctx.translate(px, py);
  mctx.rotate(-player.yaw + Math.PI);
  mctx.fillStyle = '#ffffff';
  mctx.strokeStyle = '#1d2733';
  mctx.lineWidth = 2;
  mctx.beginPath(); mctx.moveTo(0, -8); mctx.lineTo(6, 6); mctx.lineTo(-6, 6); mctx.closePath(); mctx.fill(); mctx.stroke();
  mctx.restore();
}

/* ---------------- loop ---------------- */
const timer = new THREE.Timer();
timer.connect(document);
let barkTimer = 2;

/* Trees between the camera and the player are hidden (instance scaled to 0)
   so the avatar stays visible in the forest and under the plaza tree. */
const camRay = new THREE.Raycaster();
const hiddenTrees = new Map(); // key -> { mesh, id, matrix, center, radius }
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const _v = new THREE.Vector3(), _s = new THREE.Vector3(), _q = new THREE.Quaternion();
function segHitsSphere(a, b, c, r) {
  const ab = _v.subVectors(b, a), t = THREE.MathUtils.clamp(c.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1);
  return a.clone().addScaledVector(ab, t).distanceTo(c) < r;
}
function updateOcclusion(head, camPos) {
  const keep = new Set();
  const len = head.distanceTo(camPos);
  const dir = camPos.clone().sub(head).normalize();
  const waist = head.clone().setY(head.y - 0.7);
  const dirW = camPos.clone().sub(waist).normalize();
  for (const [o, d] of [[head, dir], [camPos, dir.clone().negate()], [waist, dirW]]) {
    camRay.set(o, d);
    camRay.far = len;
    for (const h of camRay.intersectObjects(W.occluders, false)) {
      if (h.instanceId == null) continue;
      const key = h.object.id + ':' + h.instanceId;
      keep.add(key);
      if (hiddenTrees.has(key)) continue;
      const m = new THREE.Matrix4();
      h.object.getMatrixAt(h.instanceId, m);
      const center = new THREE.Vector3();
      m.decompose(center, _q, _s);
      if (!h.object.geometry.boundingSphere) h.object.geometry.computeBoundingSphere();
      const radius = h.object.geometry.boundingSphere.radius * Math.max(_s.x, _s.y, _s.z) + 0.3;
      center.add(h.object.geometry.boundingSphere.center.clone().multiply(_s));
      hiddenTrees.set(key, { mesh: h.object, id: h.instanceId, m, center, radius });
      h.object.setMatrixAt(h.instanceId, ZERO);
      h.object.instanceMatrix.needsUpdate = true;
    }
  }
  for (const [key, e] of hiddenTrees) {
    if (keep.has(key) || segHitsSphere(head, camPos, e.center, e.radius) || segHitsSphere(waist, camPos, e.center, e.radius)) continue;
    e.mesh.setMatrixAt(e.id, e.m);
    e.mesh.instanceMatrix.needsUpdate = true;
    hiddenTrees.delete(key);
  }
}
const fwd = new THREE.Vector3(), right = new THREE.Vector3();

function frame() {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.05);
  const t = timer.getElapsed();
  const paused = !dlg.hidden;

  // input → movement
  let mx = 0, mz = 0;
  if (!paused) {
    const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) - joy.y;
    const s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + joy.x;
    const viewYaw = cam.mode === 'first' ? cam.yaw : cam.yaw + Math.PI;
    fwd.set(Math.sin(viewYaw), 0, Math.cos(viewYaw));
    right.set(-fwd.z, 0, fwd.x);
    if (Math.abs(f) + Math.abs(s) > 0.05) {
      player.target = null;
      mx = fwd.x * f + right.x * s;
      mz = fwd.z * f + right.z * s;
    } else if (player.target) {
      const dx = player.target.x - player.pos.x, dz = player.target.z - player.pos.z;
      const d = Math.hypot(dx, dz);
      const stopAt = player.targetMark ? 1.6 : 0.15;
      if (d <= stopAt) {
        const m = player.targetMark;
        player.target = null;
        player.targetMark = null;
        if (m && !m.done) openScenario(m);
      } else { mx = dx / d; mz = dz / d; }
    }
  }
  const len = Math.hypot(mx, mz);
  player.moving = false;
  if (len > 0.05) {
    const sp = SPEED * Math.min(1, len) * dt;
    const moved = tryMove(player.pos.x + (mx / len) * sp, player.pos.z + (mz / len) * sp);
    if (moved > 0.001) {
      player.moving = true;
      player.phase += moved * 3.2;
      const targetYaw = Math.atan2(mx, mz);
      let d = targetYaw - player.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      player.yaw += d * Math.min(1, dt * 12);
    } else if (player.target) {
      player.target = null; // blocked
      player.targetMark = null;
    }
  }
  avatar.position.copy(player.pos);
  avatar.rotation.y = player.yaw;
  M.animateAvatar(avatar, player.phase, player.moving);
  avatar.visible = cam.mode === 'third';
  if (cam.mode === 'first' && player.moving) cam.yaw = player.yaw;

  // world animation
  for (const a of W.animals) a(t, paused ? 0 : dt);
  for (const m of W.marks) {
    if (m.done) continue;
    if (m.anchor) m.sprite.position.set(m.anchor.position.x, 0, m.anchor.position.z).applyMatrix4(m.anchor.parent.matrixWorld).setY(m.base.y);
    else m.sprite.position.y = m.base.y + Math.sin(t * 2.5 + m.base.x) * 0.12;
    const s = (m.scenario.type === 'tip' ? 0.9 : 1.1) * (1 + Math.sin(t * 5) * 0.05);
    m.sprite.scale.setScalar(s);
  }
  for (let i = effects.length - 1; i >= 0; i--) {
    const fx = effects[i];
    fx.life -= dt;
    fx.update(dt);
    if (fx.life <= 0) { scene.remove(fx.obj); effects.splice(i, 1); }
  }
  if (tapRing.visible) {
    tapRing.userData.t -= dt;
    tapRing.material.opacity = Math.max(0, tapRing.userData.t / 0.6);
    tapRing.scale.setScalar(1 + (0.6 - tapRing.userData.t));
    if (tapRing.userData.t <= 0) tapRing.visible = false;
  }

  // nearest open mark → prompt
  nearMark = null;
  let best = 2.6;
  for (const m of W.marks) {
    if (m.done) continue;
    const d = Math.hypot(m.sprite.position.x - player.pos.x, m.sprite.position.z - player.pos.z);
    if (d < best) { best = d; nearMark = m; }
  }
  const pr = $('prompt');
  pr.hidden = !nearMark || paused;
  if (nearMark) pr.querySelector('span').textContent = nearMark.scenario.title;

  // place label
  const z = currentZone();
  const place = z ? z.name : (Math.hypot(player.pos.x, player.pos.z) < 16 ? 'エントランス広場' : '散歩道');
  if ($('place').textContent !== place) {
    $('place').textContent = place;
    $('goal').textContent = z ? z.goal : '3つのテーマエリアをめぐって、トラブルを解決しよう';
    $('place-card').style.setProperty('--zone', z ? z.color : '#1d4f7a');
  }

  // lost dog barks louder as you get closer (C4)
  const c4 = W.marks.find((m) => m.scenario.id === 'C4');
  barkTimer -= dt;
  if (barkTimer <= 0 && !paused && c4 && !c4.done && z?.id === 'C') {
    barkTimer = 3.5;
    const d = W.lostDog.obj.getWorldPosition(new THREE.Vector3()).distanceTo(player.pos);
    sfx.bark(THREE.MathUtils.clamp(1 - d / 26, 0, 1));
  }

  // camera
  const head = player.pos.clone().add(new THREE.Vector3(0, 1.35, 0));
  if (cam.mode === 'third') {
    const off = new THREE.Vector3(
      Math.sin(cam.yaw) * Math.cos(cam.pitch),
      Math.sin(cam.pitch),
      Math.cos(cam.yaw) * Math.cos(cam.pitch),
    ).multiplyScalar(cam.dist);
    const want = head.clone().add(off);
    want.y = Math.max(0.6, want.y);
    camera.position.lerp(want, Math.min(1, dt * 8));
    // while editing the avatar, aim lower so the avatar sits above the panel
    camera.lookAt(cam.editing ? head.clone().setY(head.y - (innerWidth < 720 ? 1.3 : 0)) : head);
    updateOcclusion(head, camera.position);
  } else {
    for (const [key, e] of hiddenTrees) { e.mesh.setMatrixAt(e.id, e.m); e.mesh.instanceMatrix.needsUpdate = true; hiddenTrees.delete(key); }
    camera.position.copy(player.pos).add(new THREE.Vector3(0, 1.55, 0));
    camera.lookAt(camera.position.clone().add(new THREE.Vector3(Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch))));
  }
  sun.position.copy(player.pos).add(new THREE.Vector3(-25, 45, 18));
  sun.target.position.copy(player.pos);

  renderer.render(scene, camera);
  drawMinimap();
}

function onResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.fov = camera.aspect < 1 ? Math.min(80, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(30)) / camera.aspect))) : 55;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
addEventListener('resize', onResize);
window.visualViewport?.addEventListener('resize', onResize);
onResize();

// first frame: camera already behind the player
camera.position.set(0, 4.5, 1.5);
setMuted(muted);
refreshProgress();
renderer.setAnimationLoop(frame);
$('loading').remove();
showIntro();
window.__oh = { W, player, state, cam, openScenario };
