/* LAUNCH - hidden 3D rocket easter-egg game.
   Fly a rocket through an endless asteroid field: steer with the mouse or arrow
   keys, dodge the rocks, grab green data orbs for bonus. One crash ends the run.
   Pure three.js from the pinned CDN, lazy-loaded, full cleanup on close. */
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

let OPEN = false;

export function launchRocket() {
  if (OPEN) return;
  OPEN = true;
  injectStyle();

  const SIGNAL = new THREE.Color('#4ade80');

  const overlay = document.createElement('div');
  overlay.className = 'rk-overlay';
  overlay.innerHTML = `
    <div class="rk-panel" role="dialog" aria-label="Launch rocket game">
      <div class="rk-bar">
        <span class="rk-title"><span class="rk-dot"></span>LAUNCH<span class="rk-muted"> // thread the asteroid field</span></span>
        <button class="rk-close" aria-label="Close game">esc ✕</button>
      </div>
      <div class="rk-stage">
        <canvas class="rk-canvas"></canvas>
        <div class="rk-hud"><div class="rk-score">0 km</div><div class="rk-best"></div></div>
        <div class="rk-center">
          <div class="rk-big">LAUNCH</div>
          <div class="rk-sub">steer: mouse or ← → ↑ ↓ &nbsp;·&nbsp; dodge the rocks &nbsp;·&nbsp; grab green orbs</div>
          <div class="rk-hint">click to launch</div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const stage = overlay.querySelector('.rk-stage');
  const canvas = overlay.querySelector('.rk-canvas');
  const elScore = overlay.querySelector('.rk-score');
  const elBest = overlay.querySelector('.rk-best');
  const center = overlay.querySelector('.rk-center');
  const big = overlay.querySelector('.rk-big');
  const hud = overlay.querySelector('.rk-hud');

  let width = stage.clientWidth || 760, height = stage.clientHeight || 475;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height, false);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 200);
  camera.position.set(0, 0, 6);
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.1); key.position.set(2, 3, 4); scene.add(key);

  // ---- rocket ----
  const rocket = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xdfe7f0, metalness: 0.3, roughness: 0.5 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0x4ade80, metalness: 0.2, roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.7, 16), bodyMat); body.rotation.x = -Math.PI / 2; rocket.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.32, 16), accentMat); nose.rotation.x = -Math.PI / 2; nose.position.z = -0.5; rocket.add(nose);
  for (let i = 0; i < 3; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.22), accentMat);
    fin.position.z = 0.28; fin.position.applyAxisAngle(new THREE.Vector3(0, 0, 1), i * 2.094);
    const a = i * 2.094; fin.position.set(Math.cos(a) * 0.16, Math.sin(a) * 0.16, 0.28); fin.rotation.z = a; rocket.add(fin);
  }
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 12), new THREE.MeshBasicMaterial({ color: 0xffb24c, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending }));
  flame.rotation.x = Math.PI / 2; flame.position.z = 0.5; rocket.add(flame);
  rocket.position.set(0, 0, 2);
  scene.add(rocket);

  const ROCK_Z = 2, BOUND_X = 3.0, BOUND_Y = 1.9, HIT = 0.42;

  // ---- streaking starfield ----
  const SN = 360, sgeo = new THREE.BufferGeometry(), spos = new Float32Array(SN * 3);
  for (let i = 0; i < SN; i++) { spos[i * 3] = (Math.random() - 0.5) * 16; spos[i * 3 + 1] = (Math.random() - 0.5) * 11; spos[i * 3 + 2] = -Math.random() * 60; }
  sgeo.setAttribute('position', new THREE.BufferAttribute(spos, 3));
  const stars = new THREE.Points(sgeo, new THREE.PointsMaterial({ color: 0x9fb2c8, size: 0.05, transparent: true, opacity: 0.8 }));
  scene.add(stars);

  // ---- pools ----
  const rockGeo = new THREE.IcosahedronGeometry(0.5, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x6b7891, flatShading: true, metalness: 0.1, roughness: 0.9 });
  const orbGeo = new THREE.IcosahedronGeometry(0.22, 0);

  const G = {
    mode: 'start', dist: 0, best: +(localStorage.getItem('launch_best') || 0),
    speed: 14, rocks: [], orbs: [], parts: [], spawn: 0, every: 0.5,
    aim: { x: 0, y: 0 }, keys: { l: 0, r: 0, u: 0, d: 0 }, raf: null, last: 0, shake: 0
  };

  function spawnRock() {
    const s = 0.5 + Math.random() * 0.9;
    const m = new THREE.Mesh(rockGeo, rockMat); m.scale.setScalar(s);
    m.position.set((Math.random() - 0.5) * 2 * BOUND_X, (Math.random() - 0.5) * 2 * BOUND_Y, -60);
    m.userData = { r: 0.5 * s, spin: new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(2) };
    scene.add(m); G.rocks.push(m);
  }
  function spawnOrb() {
    const m = new THREE.Mesh(orbGeo, new THREE.MeshBasicMaterial({ color: SIGNAL, wireframe: true }));
    m.position.set((Math.random() - 0.5) * 2 * BOUND_X, (Math.random() - 0.5) * 2 * BOUND_Y, -60);
    scene.add(m); G.orbs.push(m);
  }
  function burst(pos, color) {
    const n = 16, p = new Float32Array(n * 3), v = [];
    for (let i = 0; i < n; i++) { p[i * 3] = pos.x; p[i * 3 + 1] = pos.y; p[i * 3 + 2] = pos.z; v.push(new THREE.Vector3((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6)); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const ps = new THREE.Points(g, new THREE.PointsMaterial({ color, size: 0.16, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }));
    ps.userData = { v, life: 0.7 }; scene.add(ps); G.parts.push(ps);
  }

  function reset() {
    [...G.rocks, ...G.orbs, ...G.parts].forEach((o) => scene.remove(o));
    G.rocks.length = 0; G.orbs.length = 0; G.parts.length = 0;
    Object.assign(G, { mode: 'play', dist: 0, speed: 14, spawn: 0, every: 0.5, shake: 0 });
    rocket.position.set(0, 0, ROCK_Z); rocket.visible = true;
    center.style.display = 'none'; hud.style.display = 'flex'; sync();
  }
  function over() {
    G.mode = 'over'; rocket.visible = false;
    G.best = Math.max(G.best, Math.floor(G.dist)); localStorage.setItem('launch_best', G.best);
    big.textContent = 'CRASHED';
    center.querySelector('.rk-sub').textContent = 'distance  ' + Math.floor(G.dist) + ' km' + (Math.floor(G.dist) >= G.best ? '   ★ new best' : '   ·   best ' + G.best);
    center.querySelector('.rk-hint').textContent = 'click to fly again';
    center.style.display = 'flex';
  }
  function sync() { elScore.textContent = Math.floor(G.dist) + ' km'; elBest.textContent = 'BEST ' + G.best; }

  // ---- input ----
  function aimFrom(e) { const r = canvas.getBoundingClientRect(); G.aim.x = ((e.clientX - r.left) / r.width - 0.5) * 2 * BOUND_X; G.aim.y = -((e.clientY - r.top) / r.height - 0.5) * 2 * BOUND_Y; }
  function onMove(e) { if (G.mode === 'play') aimFrom(e); }
  function onDown(e) { if (G.mode !== 'play') reset(); else aimFrom(e); }
  function onKey(e) {
    const d = e.type === 'keydown' ? 1 : 0;
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'ArrowLeft') G.keys.l = d; if (e.key === 'ArrowRight') G.keys.r = d;
    if (e.key === 'ArrowUp') G.keys.u = d; if (e.key === 'ArrowDown') G.keys.d = d;
    if (d && (G.mode !== 'play') && (e.key === ' ' || e.key === 'Enter')) reset();
    if (d && [' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) e.preventDefault();
  }
  stage.addEventListener('pointermove', onMove);
  stage.addEventListener('pointerdown', onDown);
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  overlay.querySelector('.rk-close').addEventListener('click', close);

  // ---- loop ----
  function update(dt) {
    // starfield streak
    const sa = sgeo.attributes.position.array;
    const warp = G.mode === 'play' ? G.speed : 6;
    for (let i = 0; i < SN; i++) { sa[i * 3 + 2] += warp * dt * 2.2; if (sa[i * 3 + 2] > 6) { sa[i * 3] = (Math.random() - 0.5) * 16; sa[i * 3 + 1] = (Math.random() - 0.5) * 11; sa[i * 3 + 2] = -60; } }
    sgeo.attributes.position.needsUpdate = true;

    flame.scale.y = 0.8 + Math.random() * 0.6; flame.material.opacity = 0.7 + Math.random() * 0.3;

    if (G.mode === 'play') {
      G.dist += G.speed * dt * 0.1;
      G.speed += dt * 0.5;
      G.every = Math.max(0.18, 0.5 - G.dist * 0.004);
      G.spawn += dt;
      if (G.spawn >= G.every) { G.spawn = 0; spawnRock(); if (Math.random() < 0.3) spawnOrb(); }

      // steer
      let tx = G.aim.x, ty = G.aim.y;
      if (G.keys.l || G.keys.r || G.keys.u || G.keys.d) { tx = rocket.position.x + (G.keys.r - G.keys.l) * 7 * dt; ty = rocket.position.y + (G.keys.u - G.keys.d) * 7 * dt; }
      rocket.position.x += (tx - rocket.position.x) * Math.min(1, dt * 10);
      rocket.position.y += (ty - rocket.position.y) * Math.min(1, dt * 10);
      rocket.position.x = Math.max(-BOUND_X, Math.min(BOUND_X, rocket.position.x));
      rocket.position.y = Math.max(-BOUND_Y, Math.min(BOUND_Y, rocket.position.y));
      rocket.rotation.z = (rocket.position.x - tx) * 0.0 + -(tx - rocket.position.x) * 0.6; // bank toward motion
      rocket.rotation.x = (ty - rocket.position.y) * 0.4;

      for (let i = G.rocks.length - 1; i >= 0; i--) {
        const m = G.rocks[i]; m.position.z += G.speed * dt; m.rotation.x += m.userData.spin.x * dt; m.rotation.y += m.userData.spin.y * dt;
        if (Math.abs(m.position.z - ROCK_Z) < 0.6) {
          const dx = m.position.x - rocket.position.x, dy = m.position.y - rocket.position.y;
          if (Math.hypot(dx, dy) < m.userData.r + 0.22) { burst(rocket.position, 0xffb24c); G.shake = 0.4; over(); }
        }
        if (m.position.z > 7) { scene.remove(m); G.rocks.splice(i, 1); }
      }
      for (let i = G.orbs.length - 1; i >= 0; i--) {
        const m = G.orbs[i]; m.position.z += G.speed * dt; m.rotation.y += dt * 2;
        if (Math.abs(m.position.z - ROCK_Z) < 0.5 && Math.hypot(m.position.x - rocket.position.x, m.position.y - rocket.position.y) < 0.5) {
          scene.remove(m); G.orbs.splice(i, 1); G.dist += 5; burst(m.position, SIGNAL);
        } else if (m.position.z > 7) { scene.remove(m); G.orbs.splice(i, 1); }
      }
      sync();
    }

    for (let i = G.parts.length - 1; i >= 0; i--) {
      const ps = G.parts[i]; ps.userData.life -= dt;
      const a = ps.geometry.attributes.position.array, v = ps.userData.v;
      for (let k = 0; k < v.length; k++) { a[k * 3] += v[k].x * dt; a[k * 3 + 1] += v[k].y * dt; a[k * 3 + 2] += v[k].z * dt; }
      ps.geometry.attributes.position.needsUpdate = true; ps.material.opacity = Math.max(0, ps.userData.life * 1.4);
      if (ps.userData.life <= 0) { scene.remove(ps); G.parts.splice(i, 1); }
    }

    // camera shake
    if (G.shake > 0) { G.shake -= dt; camera.position.x = (Math.random() - 0.5) * G.shake; camera.position.y = (Math.random() - 0.5) * G.shake; }
    else { camera.position.x = 0; camera.position.y = 0; }
  }

  function frame(now) {
    G.raf = requestAnimationFrame(frame);
    const dt = G.last ? Math.min((now - G.last) / 1000, 0.05) : 0.016; G.last = now;
    update(dt); renderer.render(scene, camera);
  }
  G.raf = requestAnimationFrame(frame);
  sync();

  function resize() { width = stage.clientWidth || 760; height = stage.clientHeight || 475; if (!width || !height) return; camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height, false); }
  window.addEventListener('resize', resize); resize();

  function close() {
    if (!OPEN) return; OPEN = false; cancelAnimationFrame(G.raf);
    stage.removeEventListener('pointermove', onMove); stage.removeEventListener('pointerdown', onDown);
    window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey);
    window.removeEventListener('resize', resize); renderer.dispose(); overlay.remove();
  }
}

let styled = false;
function injectStyle() {
  if (styled) return; styled = true;
  const s = document.createElement('style');
  s.textContent = `
    .rk-overlay{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;
      background:rgba(6,9,13,0.85);backdrop-filter:blur(6px);animation:rkIn .25s ease;padding:20px;}
    @keyframes rkIn{from{opacity:0}to{opacity:1}}
    .rk-panel{border:1px solid #1f2b3d;border-radius:14px;overflow:hidden;background:#070b10;
      box-shadow:0 30px 80px rgba(0,0,0,.55);width:760px;max-width:92vw;user-select:none;-webkit-user-select:none;}
    .rk-bar{display:flex;align-items:center;justify-content:space-between;padding:11px 14px;border-bottom:1px solid #16202e;}
    .rk-title{font-family:ui-monospace,monospace;font-size:13px;font-weight:600;color:#e8edf4;display:flex;align-items:center;gap:9px;}
    .rk-muted{color:#5e6b7d;font-weight:500;}
    .rk-dot{width:8px;height:8px;border-radius:50%;background:#4ade80;box-shadow:0 0 8px #4ade80;}
    .rk-close{font-family:ui-monospace,monospace;font-size:12px;color:#9aa7b8;background:transparent;border:1px solid #1f2b3d;border-radius:7px;padding:4px 10px;cursor:pointer;transition:all .2s;}
    .rk-close:hover{color:#4ade80;border-color:#2f9e5c;}
    .rk-stage{position:relative;width:100%;aspect-ratio:16/10;background:#070b10;cursor:crosshair;}
    .rk-canvas{display:block;width:100%;height:100%;touch-action:none;}
    .rk-hud{position:absolute;inset:0;display:flex;justify-content:space-between;align-items:flex-start;padding:14px 16px;
      pointer-events:none;font-family:ui-monospace,monospace;font-size:14px;font-weight:600;color:#e8edf4;}
    .rk-best{color:#5e6b7d;}
    .rk-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;
      text-align:center;background:rgba(7,11,16,0.55);padding:20px;pointer-events:none;}
    .rk-big{font-family:"Space Grotesk",system-ui,sans-serif;font-weight:700;font-size:clamp(26px,5vw,42px);color:#4ade80;letter-spacing:-.02em;}
    .rk-sub{font-family:ui-monospace,monospace;font-size:13px;color:#9aa7b8;}
    .rk-hint{font-family:ui-monospace,monospace;font-size:12px;color:#5e6b7d;margin-top:10px;}`;
  document.head.appendChild(s);
}
