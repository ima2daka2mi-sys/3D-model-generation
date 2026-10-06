// Phone-friendly visual effects. No post-processing: everything is a few
// draw calls, mostly animated on the GPU in small shaders.
//  - gradient sky dome with a sun glow
//  - floating light motes that follow the player (wrap-around box)
//  - falling leaves over the forest
//  - light beams + pulsing ground rings on unsolved trouble marks
//  - flowing river surface
//  - butterflies
//  - footstep dust, and a confetti + shockwave burst on success
import * as THREE from 'three';

export function createEffects(scene, W, renderer, { mobile = false } = {}) {
  const uTime = { value: 0 };
  const pixelRatio = renderer.getPixelRatio();
  const updaters = [];

  /* ---------------- sky ---------------- */
  const horizon = new THREE.Color(0xd9eefa);
  scene.background = null;
  scene.fog.color.copy(horizon);
  const sunDir = new THREE.Vector3(-0.45, 0.62, 0.35).normalize();
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(420, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        top: { value: new THREE.Color(0x3d8fd6) },
        mid: { value: new THREE.Color(0x8cc8ef) },
        bottom: { value: horizon },
        sunDir: { value: sunDir },
      },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 top, mid, bottom, sunDir; varying vec3 vDir;
        void main(){
          float h = vDir.y;
          vec3 c = mix(bottom, mid, smoothstep(0.0, 0.25, h));
          c = mix(c, top, smoothstep(0.25, 0.9, h));
          float s = max(dot(normalize(vDir), sunDir), 0.0);
          c += vec3(1.0, 0.9, 0.7) * (pow(s, 600.0) * 1.2 + pow(s, 12.0) * 0.25);
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  );
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  scene.add(sky);
  updaters.push((dt, t, player) => sky.position.set(player.x, 0, player.z));

  /* ---------------- soft dot texture ---------------- */
  const dotTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    return t;
  })();

  /* ---------------- floating motes (wrap around the player) ---------------- */
  function motes({ count, box, color, size, rise, sway, colors }) {
    const pos = new Float32Array(count * 3), seed = new Float32Array(count), col = new Float32Array(count * 3);
    const palette = (colors || [color]).map((c) => new THREE.Color(c));
    for (let i = 0; i < count; i++) {
      pos.set([Math.random() * box.x, Math.random() * box.y, Math.random() * box.z], i * 3);
      seed[i] = Math.random() * 100;
      palette[i % palette.length].toArray(col, i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    const center = { value: new THREE.Vector3() };
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime, center, box: { value: box }, size: { value: size * pixelRatio }, map: { value: dotTex }, rise: { value: rise }, sway: { value: sway } },
      vertexShader: `uniform float uTime, size, rise, sway; uniform vec3 center, box; attribute float aSeed; attribute vec3 aColor;
        varying vec3 vColor; varying float vFade;
        void main(){
          vec3 p = position;
          p.y += uTime * rise * (0.6 + fract(aSeed) * 0.8);
          p.x += sin(uTime * 0.6 + aSeed) * sway;
          p.z += cos(uTime * 0.5 + aSeed * 1.3) * sway;
          // wrap inside a box centred on the player
          vec3 origin = center - box * 0.5;
          p = mod(p - origin, box) + origin;
          p.y = mod(p.y, box.y) + 0.2;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float tw = 0.6 + 0.4 * sin(uTime * 3.0 + aSeed * 7.0);
          gl_PointSize = size * tw * (20.0 / -mv.z);
          vFade = smoothstep(0.0, 1.5, p.y) * (1.0 - smoothstep(box.y * 0.7, box.y, p.y));
          vColor = aColor;
        }`,
      fragmentShader: `uniform sampler2D map; varying vec3 vColor; varying float vFade;
        void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vColor * t.a, t.a * vFade); }`,
    });
    const pts = new THREE.Points(geo, m);
    pts.frustumCulled = false;
    scene.add(pts);
    return center;
  }
  const moteCenter = motes({
    count: mobile ? 160 : 320, box: new THREE.Vector3(36, 7, 36), size: 9, rise: 0.25, sway: 0.6,
    colors: [0xfff1b8, 0xffffff, 0xd8f5ff],
  });
  updaters.push((dt, t, player) => moteCenter.value.set(player.x, 0, player.z));

  /* ---------------- falling leaves over the forest (zone A) ---------------- */
  if (W.zones.A) {
    const Z = W.zones.A;
    const count = mobile ? 70 : 140;
    const geo = new THREE.PlaneGeometry(0.16, 0.1);
    const leaves = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), count);
    const greens = [0x7cc05a, 0xc9d84a, 0xe0a23a, 0x5fae49].map((c) => new THREE.Color(c));
    const data = [];
    for (let i = 0; i < count; i++) {
      const lx = 10 + Math.random() * 12, lz = -18 + Math.random() * 36;
      const w = new THREE.Vector3(lx, 0, lz).applyAxisAngle(new THREE.Vector3(0, 1, 0), Z.rot).add(Z.center);
      data.push({ x: w.x, z: w.z, y: Math.random() * 6, s: Math.random() * 10, v: 0.4 + Math.random() * 0.4 });
      leaves.setColorAt(i, greens[i % greens.length]);
    }
    scene.add(leaves);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    updaters.push((dt, t, player) => {
      // only animate when the player is near the forest
      if (player.distanceTo(Z.center) > 45) { leaves.visible = false; return; }
      leaves.visible = true;
      data.forEach((d, i) => {
        d.y -= d.v * dt;
        if (d.y < 0) d.y = 5 + Math.random() * 2;
        p.set(d.x + Math.sin(t + d.s) * 0.6, d.y, d.z + Math.cos(t * 0.7 + d.s) * 0.6);
        q.setFromEuler(e.set(t * 2 + d.s, t * 1.3 + d.s, 0));
        leaves.setMatrixAt(i, m4.compose(p, q, one));
      });
      leaves.instanceMatrix.needsUpdate = true;
    });
  }

  /* ---------------- trouble-mark beacons ---------------- */
  const beamMat = (color) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime, color: { value: new THREE.Color(color) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform float uTime; uniform vec3 color; varying vec2 vUv;
      void main(){
        float fade = (1.0 - vUv.y) * (1.0 - vUv.y);
        float stripes = 0.65 + 0.35 * sin(vUv.y * 30.0 - uTime * 4.0);
        gl_FragColor = vec4(color * fade * stripes * 0.9, fade * stripes);
      }`,
  });
  const ringMat = (color) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime, color: { value: new THREE.Color(color) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform float uTime; uniform vec3 color; varying vec2 vUv;
      void main(){
        float r = length(vUv - 0.5) * 2.0;
        float w = fract(uTime * 0.6);
        float ring = smoothstep(0.08, 0.0, abs(r - w)) * (1.0 - w);
        float core = smoothstep(1.0, 0.85, r) * smoothstep(0.7, 0.85, r) * 0.5;
        gl_FragColor = vec4(color * (ring + core), (ring + core));
      }`,
  });
  const mats = { trouble: [beamMat(0xff4a3a), ringMat(0xff6a4a)], tip: [beamMat(0x3a8fff), ringMat(0x4a9fff)] };
  const beamGeo = new THREE.CylinderGeometry(0.42, 0.42, 7, 20, 1, true).translate(0, 3.5, 0);
  const ringGeo = new THREE.PlaneGeometry(2.4, 2.4).rotateX(-Math.PI / 2);
  for (const m of W.marks) {
    const [bm, rm] = mats[m.scenario.type === 'tip' ? 'tip' : 'trouble'];
    const g = new THREE.Group();
    const beam = new THREE.Mesh(beamGeo, bm);
    const ring = new THREE.Mesh(ringGeo, rm);
    ring.position.y = 0.07;
    beam.renderOrder = ring.renderOrder = 3;
    g.add(beam, ring);
    scene.add(g);
    m.beacon = g;
  }
  updaters.push(() => {
    for (const m of W.marks) {
      m.beacon.visible = !m.done;
      if (!m.done) m.beacon.position.set(m.sprite.position.x, 0, m.sprite.position.z);
    }
  });

  /* ---------------- flowing river ---------------- */
  if (W.riverMesh) {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = '#3f8fd0';
    x.fillRect(0, 0, 64, 256);
    for (let i = 0; i < 40; i++) {
      x.fillStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.35})`;
      x.fillRect(Math.random() * 64, Math.random() * 256, 2 + Math.random() * 10, 2 + Math.random() * 3);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 6);
    W.riverMesh.material.map = tex;
    W.riverMesh.material.color.set(0xffffff);
    W.riverMesh.material.needsUpdate = true;
    updaters.push((dt) => { tex.offset.y += dt * 0.35; });
  }

  /* ---------------- butterflies ---------------- */
  {
    const wingGeo = new THREE.CircleGeometry(0.09, 8);
    wingGeo.translate(0.08, 0, 0);
    const spots = [[0, 9, 2.5], [3, 9.5, 2], [-3, 9.5, 1.8]];
    if (W.anchors.parkWorld) spots.push([W.anchors.parkWorld.x, W.anchors.parkWorld.z, 3], [W.anchors.parkWorld.x - 6, W.anchors.parkWorld.z + 4, 3]);
    const colors = [0xffb347, 0xffffff, 0x7fc8ff, 0xff8fb0, 0xffe066];
    spots.forEach(([cx, cz, r], i) => {
      const b = new THREE.Group();
      const m = new THREE.MeshBasicMaterial({ color: colors[i % colors.length], side: THREE.DoubleSide });
      const L = new THREE.Mesh(wingGeo, m), R = new THREE.Mesh(wingGeo, m);
      L.rotation.x = R.rotation.x = -Math.PI / 2;
      b.add(L, R);
      scene.add(b);
      const sp = 0.5 + i * 0.13, ph = i * 1.7;
      updaters.push((dt, t) => {
        const a = t * sp + ph;
        b.position.set(cx + Math.cos(a) * r, 1.1 + Math.sin(t * 2 + i) * 0.4, cz + Math.sin(a * 1.3) * r * 0.7);
        b.rotation.y = -a;
        const f = Math.sin(t * 18 + i) * 1.1;
        L.rotation.y = f;
        R.rotation.y = Math.PI - f;
      });
    });
  }

  /* ---------------- pooled sprites: dust, confetti, shockwave ---------------- */
  const live = [];
  const dustMat = new THREE.SpriteMaterial({ map: dotTex, color: 0xe8dcc4, transparent: true, depthWrite: false, opacity: 0.6 });
  let dustTimer = 0;
  function dust(pos) {
    const s = new THREE.Sprite(dustMat.clone());
    s.position.set(pos.x + (Math.random() - 0.5) * 0.2, 0.08, pos.z + (Math.random() - 0.5) * 0.2);
    s.scale.setScalar(0.25);
    scene.add(s);
    live.push({ o: s, life: 0.7, max: 0.7, step(dt, k) { s.scale.setScalar(0.25 + (1 - k) * 0.5); s.material.opacity = 0.5 * k; s.position.y += dt * 0.3; } });
  }

  const confettiGeo = new THREE.PlaneGeometry(0.09, 0.05);
  const confettiCols = [0xff4a6a, 0xffcf4a, 0x4ac8ff, 0x6ad86a, 0xffffff, 0xb07aff].map((c) => new THREE.Color(c));
  function celebrate(pos, big = false) {
    const n = big ? (mobile ? 120 : 220) : (mobile ? 50 : 90);
    const inst = new THREE.InstancedMesh(confettiGeo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true }), n);
    const parts = [];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = (big ? 3 : 2) + Math.random() * 2.5;
      parts.push({
        p: new THREE.Vector3(pos.x, pos.y + 0.8, pos.z),
        v: new THREE.Vector3(Math.cos(a) * sp * 0.6, 3 + Math.random() * (big ? 5 : 3), Math.sin(a) * sp * 0.6),
        r: new THREE.Euler(Math.random() * 6, Math.random() * 6, 0), w: 4 + Math.random() * 8,
      });
      inst.setColorAt(i, confettiCols[i % confettiCols.length]);
    }
    inst.frustumCulled = false;
    scene.add(inst);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
    live.push({ o: inst, life: 2.6, max: 2.6, step(dt, k) {
      parts.forEach((pp, i) => {
        pp.v.y -= 7 * dt;
        pp.v.multiplyScalar(0.985);
        pp.p.addScaledVector(pp.v, dt);
        if (pp.p.y < 0.05) { pp.p.y = 0.05; pp.v.set(0, 0, 0); }
        pp.r.x += pp.w * dt; pp.r.y += pp.w * 0.7 * dt;
        inst.setMatrixAt(i, m4.compose(pp.p, q.setFromEuler(pp.r), one));
      });
      inst.instanceMatrix.needsUpdate = true;
      inst.material.opacity = Math.min(1, k * 3);
    } });
    // shockwave ring
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({
      color: big ? 0xffd84a : 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    ring.position.set(pos.x, 0.1, pos.z);
    scene.add(ring);
    live.push({ o: ring, life: 0.9, max: 0.9, step(dt, k) { ring.scale.setScalar(1 + (1 - k) * (big ? 9 : 5)); ring.material.opacity = k; } });
    // rising light column
    const col = new THREE.Mesh(beamGeo, beamMat(big ? 0xffd84a : 0xfff4c0));
    col.position.set(pos.x, 0, pos.z);
    scene.add(col);
    live.push({ o: col, life: 1.2, max: 1.2, step(dt, k) { col.scale.set(1 + (1 - k) * 2, k, 1 + (1 - k) * 2); } });
  }

  return {
    celebrate,
    update(dt, t, player, moving) {
      uTime.value = t;
      for (const u of updaters) u(dt, t, player);
      dustTimer -= dt;
      if (moving && dustTimer <= 0) { dust(player); dustTimer = 0.18; }
      for (let i = live.length - 1; i >= 0; i--) {
        const l = live[i];
        l.life -= dt;
        l.step(dt, Math.max(0, l.life / l.max));
        if (l.life <= 0) {
          scene.remove(l.o);
          l.o.material?.dispose?.();
          if (!l.o.isSprite && l.o.geometry !== beamGeo && l.o.geometry !== confettiGeo) l.o.geometry?.dispose();
          if (l.o.isInstancedMesh) l.o.dispose();
          live.splice(i, 1);
        }
      }
    },
  };
}
