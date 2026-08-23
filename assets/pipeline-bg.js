/* Site-wide DYNAMIC data-pipeline backdrop.
   One persistent, fixed full-viewport 3D scene you travel through as you scroll:
   sources at the top feed a conduit, data streaks past the camera, and each
   stage pulses as you reach it. Flow reacts to scroll speed. Content still
   paints instantly as HTML on top and is never gated behind this. Mounted only
   when eligible (WebGL, motion allowed, not tiny/low-power). three.js from the
   same pinned CDN. */
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export function initPipelineBG(canvas) {
  const SIGNAL = new THREE.Color('#4ade80');
  const TEAL = new THREE.Color('#2fd6a6');
  let width = window.innerWidth, height = window.innerHeight;
  const small = width < 720; // phones: lighter particle counts + pixel ratio

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.4 : 1.75));
  renderer.setSize(width, height, false);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0e14, 0.03);
  const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 100);
  camera.position.set(0, 6, 12);

  // ---- conduit (top -> bottom) ----
  const stagePts = [
    new THREE.Vector3(0, 8, 0),
    new THREE.Vector3(-2.0, 3.6, 1.2),
    new THREE.Vector3(1.6, -0.6, -1.0),
    new THREE.Vector3(-1.1, -4.4, 1.0),
    new THREE.Vector3(0, -8.4, 0)
  ];
  const curve = new THREE.CatmullRomCurve3(stagePts, false, 'catmullrom', 0.5);

  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 200, 0.035, 8, false),
    new THREE.MeshBasicMaterial({ color: SIGNAL, transparent: true, opacity: 0.22 })
  );
  scene.add(tube);

  // ---- stage nodes (pulse as you reach them) ----
  const nodes = stagePts.map((p, i) => {
    const core = i === 2 ? 0.6 : 0.42;
    const g = new THREE.Group();
    const mCore = new THREE.Mesh(new THREE.IcosahedronGeometry(core, 0), new THREE.MeshBasicMaterial({ color: 0x12283c }));
    const mWire = new THREE.Mesh(new THREE.IcosahedronGeometry(core + 0.05, 0), new THREE.MeshBasicMaterial({ color: SIGNAL, wireframe: true, transparent: true, opacity: 0.45 }));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(core + 0.5, 0.02, 8, 40), new THREE.MeshBasicMaterial({ color: TEAL, transparent: true, opacity: 0 }));
    g.add(mCore); g.add(mWire); g.add(ring);
    g.position.copy(p);
    g.userData = { mCore, mWire, ring, pulse: 0 };
    scene.add(g);
    return g;
  });

  // ---- conduit particles (flow down the path) ----
  const PN = small ? 110 : 220;
  const pPos = new Float32Array(PN * 3);
  const pT = new Float32Array(PN);
  for (let i = 0; i < PN; i++) pT[i] = Math.random();
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({
    color: SIGNAL, size: 0.1, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false
  }));
  scene.add(particles);

  // ---- foreground streaks (fly past the camera for depth + speed) ----
  const FN = small ? 42 : 90;
  const fPos = new Float32Array(FN * 3);
  const fOff = []; // {x, y, z}
  for (let i = 0; i < FN; i++) fOff.push({ x: (Math.random() - 0.5) * 22, y: (Math.random() - 0.5) * 22, z: 2 + Math.random() * 8 });
  const fGeo = new THREE.BufferGeometry();
  fGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3));
  const streaks = new THREE.Points(fGeo, new THREE.PointsMaterial({
    color: TEAL, size: 0.14, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false
  }));
  scene.add(streaks);

  // ---- stars ----
  const SN = (small ? 80 : 150), sPos = new Float32Array(SN * 3);
  for (let i = 0; i < SN; i++) { sPos[i*3]=(Math.random()-0.5)*34; sPos[i*3+1]=(Math.random()-0.5)*26; sPos[i*3+2]=-8-Math.random()*16; }
  const sGeo = new THREE.BufferGeometry(); sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  scene.add(new THREE.Points(sGeo, new THREE.PointsMaterial({ color: 0x9fb2c8, size: 0.05, transparent: true, opacity: 0.45 })));

  // ---- scroll + parallax state ----
  let scrollP = 0, scrollTarget = 0, prevTarget = 0, vel = 0;
  const pointer = { x: 0, tx: 0, y: 0, ty: 0 };
  function onScroll() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    scrollTarget = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
  }
  function onPointer(e) { pointer.tx = (e.clientX / window.innerWidth - 0.5); pointer.ty = (e.clientY / window.innerHeight - 0.5); }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('pointermove', onPointer, { passive: true });
  onScroll(); prevTarget = scrollTarget; scrollP = scrollTarget;

  // ---- loop ----
  const _v = new THREE.Vector3();
  let raf = null, last = 0, running = false, t = 0;
  const topY = 6, botY = -8;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016; last = now; t += dt;

    // scroll easing + velocity (drives flow speed = reactive feel)
    scrollP += (scrollTarget - scrollP) * 0.07;
    vel += (Math.abs(scrollTarget - prevTarget) / Math.max(dt, 0.001) - vel) * 0.1;
    prevTarget = scrollTarget;
    const boost = 1 + Math.min(vel * 6, 6);

    // conduit particles flow down (faster when scrolling)
    const flow = dt * 0.06 * boost;
    for (let i = 0; i < PN; i++) {
      pT[i] = (pT[i] + flow) % 1;
      curve.getPointAt(pT[i], _v);
      pPos[i*3] = _v.x; pPos[i*3+1] = _v.y; pPos[i*3+2] = _v.z;
    }
    pGeo.attributes.position.needsUpdate = true;

    // camera travels down the pipeline as you scroll
    const camY = topY - scrollP * (topY - botY);
    camera.position.y += (camY - camera.position.y) * 0.1;
    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;
    camera.position.x += (pointer.x * 2.4 - camera.position.x) * 0.05;
    camera.rotation.z = pointer.x * 0.04;
    camera.lookAt(pointer.x * 1.0, camera.position.y - 1.6 - pointer.y * 1.2, 0);

    // foreground streaks fly downward past the camera (always-on motion)
    const fSpeed = (3 + vel * 30) * dt;
    for (let i = 0; i < FN; i++) {
      const o = fOff[i];
      o.y -= fSpeed;
      if (o.y < -12) { o.y += 24; o.x = (Math.random() - 0.5) * 22; }
      fPos[i*3] = camera.position.x + o.x; fPos[i*3+1] = camera.position.y + o.y; fPos[i*3+2] = o.z;
    }
    fGeo.attributes.position.needsUpdate = true;

    // nodes: spin, and pulse the stage nearest the current scroll position
    const activeStage = Math.round(scrollP * (nodes.length - 1));
    nodes.forEach((g, i) => {
      g.userData.mWire.rotation.x += dt * 0.5; g.userData.mWire.rotation.y += dt * 0.7;
      const on = i === activeStage;
      g.userData.pulse += ((on ? 1 : 0) - g.userData.pulse) * 0.08;
      const s = 1 + g.userData.pulse * 0.4 + (on ? Math.sin(t * 3) * 0.05 : 0);
      g.scale.setScalar(s);
      g.userData.mCore.material.color.lerp(on ? SIGNAL : new THREE.Color(0x12283c), 0.08);
      g.userData.ring.material.opacity += ((on ? 0.7 : 0) - g.userData.ring.material.opacity) * 0.08;
      g.userData.ring.rotation.z += dt * (on ? 0.9 : 0.2);
      g.userData.ring.lookAt(camera.position);
    });
    tube.material.opacity = 0.18 + Math.min(vel * 2, 0.25);

    renderer.render(scene, camera);
  }
  function start() { if (!running) { running = true; last = 0; raf = requestAnimationFrame(frame); } }
  function stop() { if (running) { running = false; cancelAnimationFrame(raf); } }

  function resize() {
    width = window.innerWidth; height = window.innerHeight;
    camera.aspect = width / height; camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => { document.visibilityState === 'hidden' ? stop() : start(); });

  document.body.classList.add('pipe-on');
  canvas.classList.add('ready');
  start();
}
