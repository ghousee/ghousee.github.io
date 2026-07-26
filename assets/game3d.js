/* DATA INTERCEPT - the hidden 3D easter-egg game.
   Built on the same night-globe scene as the hero. Corrupt red packets streak
   in from space toward Earth; click to intercept before they breach the globe.
   Green data orbs drift near the surface for bonus points. Pure three.js
   (loaded from the same pinned CDN), lazy-loaded only when summoned, full
   cleanup on close. Falls back to the 2D game when WebGL is unavailable. */
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

let OPEN = false;

export function launchGame3D() {
  if (OPEN) return;
  OPEN = true;
  injectStyle();

  const SIGNAL = new THREE.Color('#4ade80');
  const RED = new THREE.Color('#f4615e');
  const R = 2.2;

  // ---- DOM ----
  const overlay = document.createElement('div');
  overlay.className = 'g3-overlay';
  overlay.innerHTML = `
    <div class="g3-panel" role="dialog" aria-label="Data Intercept 3D game">
      <div class="g3-bar">
        <span class="g3-title"><span class="g3-dot"></span>DATA INTERCEPT<span class="g3-muted"> // defend the globe</span></span>
        <button class="g3-close" aria-label="Close game">esc ✕</button>
      </div>
      <div class="g3-stage">
        <canvas class="g3-canvas"></canvas>
        <div class="g3-hud">
          <div class="g3-score">SCORE 0 <span class="g3-mult"></span></div>
          <div class="g3-int">INTEGRITY <span class="g3-bars"></span></div>
        </div>
        <div class="g3-center">
          <div class="g3-big">DATA INTERCEPT</div>
          <div class="g3-sub">red packets are breaching the globe, click to intercept</div>
          <div class="g3-sub">grab green orbs for bonus</div>
          <div class="g3-hint">click to start</div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const stage = overlay.querySelector('.g3-stage');
  const canvas = overlay.querySelector('.g3-canvas');
  const elScore = overlay.querySelector('.g3-score');
  const elMult = overlay.querySelector('.g3-mult');
  const elBars = overlay.querySelector('.g3-bars');
  const center = overlay.querySelector('.g3-center');
  const big = overlay.querySelector('.g3-big');
  const hud = overlay.querySelector('.g3-hud');

  // ---- three setup ----
  let width = stage.clientWidth || 720, height = stage.clientHeight || 460;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height, false);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
  camera.position.set(0, 0, 8);

  // globe + graticule + atmosphere + stars (mirrors the hero look)
  const globe = new THREE.Mesh(new THREE.SphereGeometry(R, 48, 48), new THREE.MeshBasicMaterial({ color: 0x0e2034 }));
  scene.add(globe);
  globe.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.004, 32, 22), new THREE.MeshBasicMaterial({ color: SIGNAL, wireframe: true, transparent: true, opacity: 0.16 })));
  new THREE.TextureLoader().load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/planets/earth_lights_2048.png',
    (t) => { t.colorSpace = THREE.SRGBColorSpace; globe.material.map = t; globe.material.color.set(0xffffff); globe.material.needsUpdate = true; });

  const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(R * 1.16, 48, 48), new THREE.ShaderMaterial({
    uniforms: { glow: { value: new THREE.Color('#2fd6a6') } },
    vertexShader: `varying vec3 vN; varying vec3 vP; void main(){ vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.0); vP=mv.xyz; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `varying vec3 vN; varying vec3 vP; uniform vec3 glow; void main(){ vec3 v=normalize(-vP); float f=pow(1.0-max(dot(vN,v),0.0),2.4); gl_FragColor=vec4(glow,f*1.3); }`,
    side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false
  }));
  scene.add(atmosphere);

  const starN = 500, sp = new Float32Array(starN * 3);
  for (let i = 0; i < starN; i++) { const r = 14 + Math.random() * 20, th = Math.random() * 6.28, ph = Math.acos(2 * Math.random() - 1); sp[i * 3] = r * Math.sin(ph) * Math.cos(th); sp[i * 3 + 1] = r * Math.cos(ph); sp[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th); }
  const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x9fb2c8, size: 0.06, transparent: true, opacity: 0.7 }));
  scene.add(stars);

  // shared geometry for cheapness
  const threatGeo = new THREE.OctahedronGeometry(0.26, 0);
  const orbGeo = new THREE.IcosahedronGeometry(0.2, 0);

  // ---- game state ----
  const G = {
    mode: 'start', score: 0, best: +(localStorage.getItem('intercept_best') || 0),
    integ: 5, mult: 1, streak: 0, threats: [], orbs: [], particles: [],
    spawn: 0, every: 1.2, t: 0, raf: null, last: 0, flash: 0
  };
  const particleSystems = [];

  function randDir() {
    const th = Math.random() * 6.28, ph = Math.acos(2 * Math.random() - 1);
    return new THREE.Vector3(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th));
  }

  function spawnThreat() {
    const dir = randDir();
    const m = new THREE.Mesh(threatGeo, new THREE.MeshBasicMaterial({ color: RED, wireframe: true }));
    m.position.copy(dir).multiplyScalar(9);
    m.userData = { speed: 0.9 + Math.random() * 0.5 + G.score * 0.004, dir: dir.clone().negate() };
    scene.add(m); G.threats.push(m);
  }
  function spawnOrb() {
    const m = new THREE.Mesh(orbGeo, new THREE.MeshBasicMaterial({ color: SIGNAL, wireframe: true, transparent: true, opacity: 0.9 }));
    m.position.copy(randDir()).multiplyScalar(R + 0.5);
    m.userData = { life: 5, spin: randDir() };
    scene.add(m); G.orbs.push(m);
  }

  function burst(pos, color) {
    const n = 14, p = new Float32Array(n * 3), v = [];
    for (let i = 0; i < n; i++) { p[i * 3] = pos.x; p[i * 3 + 1] = pos.y; p[i * 3 + 2] = pos.z; v.push(randDir().multiplyScalar(2 + Math.random() * 3)); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const ps = new THREE.Points(g, new THREE.PointsMaterial({ color, size: 0.12, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }));
    ps.userData = { v, life: 0.6 }; scene.add(ps); particleSystems.push(ps);
  }

  function setBest() { G.best = Math.max(G.best, G.score); localStorage.setItem('intercept_best', G.best); }

  function reset() {
    [...G.threats, ...G.orbs, ...particleSystems].forEach((o) => scene.remove(o));
    G.threats.length = 0; G.orbs.length = 0; particleSystems.length = 0;
    Object.assign(G, { mode: 'play', score: 0, integ: 5, mult: 1, streak: 0, spawn: 0, every: 1.2, t: 0, flash: 0 });
    center.style.display = 'none'; hud.style.display = 'flex';
    syncHud();
  }
  function gameOver() {
    G.mode = 'over'; setBest();
    big.textContent = 'GLOBE BREACHED';
    center.querySelectorAll('.g3-sub')[0].textContent = 'final score  ' + G.score + (G.score >= G.best ? '   ★ new best' : '');
    center.querySelectorAll('.g3-sub')[1].textContent = 'best  ' + G.best;
    center.querySelector('.g3-hint').textContent = 'click to play again';
    center.style.display = 'flex';
  }

  function syncHud() {
    elScore.firstChild.textContent = 'SCORE ' + G.score + ' ';
    elMult.textContent = G.mult > 1 ? 'x' + G.mult : '';
    let bars = ''; for (let i = 0; i < 5; i++) bars += i < G.integ ? '▰' : '▱';
    elBars.textContent = bars;
  }

  // ---- input ----
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pointerNDC(e) { const r = canvas.getBoundingClientRect(); ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1; ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1; }

  function onDown(e) {
    if (G.mode !== 'play') { reset(); return; }
    pointerNDC(e); ray.setFromCamera(ndc, camera);
    const hitT = ray.intersectObjects(G.threats, false)[0];
    if (hitT) {
      const m = hitT.object; scene.remove(m); G.threats.splice(G.threats.indexOf(m), 1);
      G.streak++; if (G.streak % 5 === 0) G.mult++;
      G.score += 10 * G.mult; burst(m.position, RED); syncHud(); return;
    }
    const hitO = ray.intersectObjects(G.orbs, false)[0];
    if (hitO) {
      const m = hitO.object; scene.remove(m); G.orbs.splice(G.orbs.indexOf(m), 1);
      G.score += 25 * G.mult; burst(m.position, SIGNAL); syncHud();
    }
  }
  function onKey(e) { if (e.key === 'Escape') close(); }
  // listen on the whole stage so clicks register even over the HUD / start
  // and game-over overlays (which sit above the canvas)
  stage.addEventListener('pointerdown', onDown);
  window.addEventListener('keydown', onKey);
  overlay.querySelector('.g3-close').addEventListener('click', close);

  // ---- loop ----
  const _c = new THREE.Vector3(0, 0, 0);
  function update(dt) {
    globe.rotation.y += dt * 0.05; atmosphere.rotation.y = globe.rotation.y; stars.rotation.y += dt * 0.004;

    if (G.mode === 'play') {
      G.t += dt; G.spawn += dt;
      G.every = Math.max(0.42, 1.2 - G.score * 0.002);
      if (G.spawn >= G.every) { G.spawn = 0; spawnThreat(); if (Math.random() < 0.35) spawnOrb(); }

      for (let i = G.threats.length - 1; i >= 0; i--) {
        const m = G.threats[i];
        m.position.addScaledVector(m.userData.dir, m.userData.speed * dt);
        m.rotation.x += dt * 2; m.rotation.y += dt * 2.4;
        if (m.position.distanceTo(_c) <= R + 0.18) {
          scene.remove(m); G.threats.splice(i, 1);
          G.integ--; G.streak = 0; G.mult = 1; G.flash = 0.35; burst(m.position, RED); syncHud();
          if (G.integ <= 0) gameOver();
        }
      }
      for (let i = G.orbs.length - 1; i >= 0; i--) {
        const m = G.orbs[i]; m.userData.life -= dt;
        m.rotation.x += dt * 1.5; m.rotation.y += dt * 1.8;
        m.material.opacity = Math.min(0.9, m.userData.life);
        if (m.userData.life <= 0) { scene.remove(m); G.orbs.splice(i, 1); }
      }
    }

    for (let i = particleSystems.length - 1; i >= 0; i--) {
      const ps = particleSystems[i]; ps.userData.life -= dt;
      const arr = ps.geometry.attributes.position.array, v = ps.userData.v;
      for (let k = 0; k < v.length; k++) { arr[k * 3] += v[k].x * dt; arr[k * 3 + 1] += v[k].y * dt; arr[k * 3 + 2] += v[k].z * dt; }
      ps.geometry.attributes.position.needsUpdate = true;
      ps.material.opacity = Math.max(0, ps.userData.life * 1.6);
      if (ps.userData.life <= 0) { scene.remove(ps); particleSystems.splice(i, 1); }
    }

    if (G.flash > 0) { G.flash -= dt; stage.style.boxShadow = `inset 0 0 120px rgba(244,97,94,${Math.max(0, G.flash)})`; }
    else stage.style.boxShadow = 'none';
  }

  function frame(now) {
    G.raf = requestAnimationFrame(frame);
    const dt = G.last ? Math.min((now - G.last) / 1000, 0.05) : 0.016; G.last = now;
    update(dt); renderer.render(scene, camera);
  }
  G.raf = requestAnimationFrame(frame);
  syncHud();

  function resize() {
    width = stage.clientWidth || 720; height = stage.clientHeight || 460;
    if (!width || !height) return;
    camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height, false);
  }
  window.addEventListener('resize', resize);
  resize();

  function close() {
    if (!OPEN) return; OPEN = false;
    cancelAnimationFrame(G.raf);
    stage.removeEventListener('pointerdown', onDown);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', resize);
    renderer.dispose();
    overlay.remove();
  }
}

let styled = false;
function injectStyle() {
  if (styled) return; styled = true;
  const s = document.createElement('style');
  s.textContent = `
    .g3-overlay{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;
      background:rgba(6,9,13,0.85);backdrop-filter:blur(6px);animation:g3In .25s ease;padding:20px;}
    @keyframes g3In{from{opacity:0}to{opacity:1}}
    .g3-panel{border:1px solid #1f2b3d;border-radius:14px;overflow:hidden;background:#080c12;
      box-shadow:0 30px 80px rgba(0,0,0,.55);width:760px;max-width:92vw;
      user-select:none;-webkit-user-select:none;}
    .g3-bar{display:flex;align-items:center;justify-content:space-between;padding:11px 14px;border-bottom:1px solid #16202e;}
    .g3-title{font-family:ui-monospace,monospace;font-size:13px;font-weight:600;color:#e8edf4;display:flex;align-items:center;gap:9px;letter-spacing:.02em;}
    .g3-muted{color:#5e6b7d;font-weight:500;}
    .g3-dot{width:8px;height:8px;border-radius:50%;background:#4ade80;box-shadow:0 0 8px #4ade80;}
    .g3-close{font-family:ui-monospace,monospace;font-size:12px;color:#9aa7b8;background:transparent;border:1px solid #1f2b3d;border-radius:7px;padding:4px 10px;cursor:pointer;transition:all .2s;}
    .g3-close:hover{color:#4ade80;border-color:#2f9e5c;}
    .g3-stage{position:relative;width:100%;aspect-ratio:16/10;background:#080c12;cursor:crosshair;}
    .g3-canvas{display:block;width:100%;height:100%;touch-action:none;}
    .g3-hud{position:absolute;inset:0;display:flex;justify-content:space-between;align-items:flex-start;padding:14px 16px;
      pointer-events:none;font-family:ui-monospace,monospace;font-size:13px;font-weight:600;color:#e8edf4;}
    .g3-mult{color:#4ade80;}
    .g3-int{color:#9aa7b8;}
    .g3-bars{color:#4ade80;letter-spacing:2px;}
    .g3-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;
      text-align:center;background:rgba(8,12,18,0.55);padding:20px;pointer-events:none;}
    .g3-big{font-family:"Space Grotesk",system-ui,sans-serif;font-weight:700;font-size:clamp(26px,5vw,42px);color:#4ade80;letter-spacing:-.02em;}
    .g3-sub{font-family:ui-monospace,monospace;font-size:13px;color:#9aa7b8;}
    .g3-hint{font-family:ui-monospace,monospace;font-size:12px;color:#5e6b7d;margin-top:10px;}`;
  document.head.appendChild(s);
}
