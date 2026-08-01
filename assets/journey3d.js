/* Journey timeline, 3D enhancement.
   Reads the existing flat .tl-track milestones and re-presents them as glowing
   nodes floating along a flowing data-path. Clicking a node (or its floating
   label) updates the shared .tl-detail panel below. If anything here fails, the
   caller never adds .is3d, so the flat horizontal timeline stays as the
   fallback. three.js is loaded from the same pinned CDN, lazily. */
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export function initJourney3D(tl) {
  const track = tl.querySelector('.tl-track');
  const detail = tl.querySelector('.tl-detail');
  const srcNodes = [...tl.querySelectorAll('.tl-node')];
  if (!track || !detail || srcNodes.length < 2) return;

  const SIGNAL = new THREE.Color('#4ade80');
  const data = srcNodes.map((n) => ({
    id: n.dataset.target,
    year: (n.querySelector('.tl-year') || {}).textContent || '',
    role: (n.querySelector('.tl-role') || {}).textContent || ''
  }));
  const N = data.length;

  // ---- DOM: stage + canvas + labels ----
  const stage = document.createElement('div');
  stage.className = 'tl-stage';
  const canvas = document.createElement('canvas');
  canvas.className = 'tl-canvas';
  const labelLayer = document.createElement('div');
  labelLayer.className = 'tl-labels';
  stage.appendChild(canvas);
  stage.appendChild(labelLayer);
  tl.insertBefore(stage, detail);
  const hint = document.createElement('div');
  hint.className = 'tl-hint3d';
  hint.textContent = 'click a milestone';
  tl.insertBefore(hint, detail);

  let width = stage.clientWidth || 900, height = stage.clientHeight || 360;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height, false);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
  camera.position.set(0, 0, 10);

  // ---- node positions along a gentle 3D path ----
  const spanX = Math.min(4.4, 1.5 * (N - 1));
  const pts = data.map((d, i) => {
    const t = N > 1 ? i / (N - 1) : 0.5;
    return new THREE.Vector3(
      -spanX + t * 2 * spanX,
      Math.sin(t * Math.PI * 1.4) * 0.5,
      Math.cos(t * Math.PI * 1.1) * 0.7
    );
  });
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.6);

  // flowing tube
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 120, 0.025, 8, false),
    new THREE.MeshBasicMaterial({ color: SIGNAL, transparent: true, opacity: 0.18 })
  );
  scene.add(tube);

  // particles flowing along the path (data moving through the journey)
  const PN = 46;
  const pPos = new Float32Array(PN * 3);
  const pT = new Float32Array(PN);
  for (let i = 0; i < PN; i++) pT[i] = Math.random();
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({
    color: SIGNAL, size: 0.09, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false
  }));
  scene.add(particles);

  // faint stars for depth
  const SN = 160, sPos = new Float32Array(SN * 3);
  for (let i = 0; i < SN; i++) { sPos[i*3]=(Math.random()-0.5)*26; sPos[i*3+1]=(Math.random()-0.5)*16; sPos[i*3+2]=-4-Math.random()*16; }
  const sGeo = new THREE.BufferGeometry(); sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  scene.add(new THREE.Points(sGeo, new THREE.PointsMaterial({ color: 0x9fb2c8, size: 0.05, transparent: true, opacity: 0.55 })));

  // ---- milestone nodes ----
  const coreGeo = new THREE.IcosahedronGeometry(0.42, 0);
  const ringGeo = new THREE.TorusGeometry(0.6, 0.014, 8, 44);
  const nodes = pts.map((p, i) => {
    const g = new THREE.Group();
    const core = new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({ color: 0x13243a }));
    const wire = new THREE.Mesh(new THREE.IcosahedronGeometry(0.46, 0), new THREE.MeshBasicMaterial({ color: SIGNAL, wireframe: true, transparent: true, opacity: 0.5 }));
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: SIGNAL, transparent: true, opacity: 0 }));
    g.add(core); g.add(wire); g.add(ring);
    g.position.copy(p);
    g.userData = { i, core, wire, ring, base: p.clone() };
    scene.add(g);
    return g;
  });

  // ---- floating HTML labels (clickable + keyboard accessible) ----
  const labels = data.map((d, i) => {
    const b = document.createElement('button');
    b.className = 'tl-label';
    b.type = 'button';
    b.innerHTML = `<span class="y">${d.year}</span><span class="r">${d.role}</span>`;
    b.addEventListener('click', () => select(i, true));
    labelLayer.appendChild(b);
    return b;
  });

  // ---- selection (drives the shared detail panel) ----
  let active = Math.max(0, srcNodes.findIndex((n) => n.classList.contains('active')));
  if (active < 0) active = N - 1;
  let camTargetX = 0;

  function select(i, user) {
    active = i;
    const id = data[i].id;
    detail.parentElement.querySelectorAll('.tl-content').forEach((c) => c.classList.toggle('active', c.id === id));
    labels.forEach((l, k) => l.classList.toggle('active', k === i));
    // keep the hidden flat track in sync (so fallback + a11y state match)
    srcNodes.forEach((n, k) => n.classList.toggle('active', k === i));
    camTargetX = nodes[i].position.x * 0.15;
  }

  // ---- interaction: hover + click on the 3D nodes ----
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let hover = -1;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

  function pick(e) {
    const r = canvas.getBoundingClientRect();
    ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(nodes, true)[0];
    return hit ? hit.object.parent.userData.i : -1;
  }
  canvas.addEventListener('pointermove', (e) => {
    const r = stage.getBoundingClientRect();
    pointer.tx = ((e.clientX - r.left) / r.width - 0.5);
    pointer.ty = ((e.clientY - r.top) / r.height - 0.5);
    hover = pick(e);
    canvas.style.cursor = hover >= 0 ? 'pointer' : 'default';
  });
  canvas.addEventListener('pointerdown', (e) => { const i = pick(e); if (i >= 0) select(i, true); });

  // ---- loop ----
  const _v = new THREE.Vector3();
  let raf = null, last = 0, running = false, t = 0;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016; last = now; t += dt;

    // particles flow along the path
    for (let i = 0; i < PN; i++) {
      pT[i] = (pT[i] + dt * 0.06) % 1;
      curve.getPointAt(pT[i], _v);
      pPos[i*3] = _v.x; pPos[i*3+1] = _v.y; pPos[i*3+2] = _v.z;
    }
    pGeo.attributes.position.needsUpdate = true;

    // node motion: gentle bob + spin; active one lifts, brightens, rings
    nodes.forEach((g, i) => {
      const on = i === active, hv = i === hover;
      g.position.y = g.userData.base.y + Math.sin(t * 1.1 + i) * 0.06;
      g.userData.wire.rotation.x += dt * 0.5; g.userData.wire.rotation.y += dt * 0.7;
      const target = on ? 1.32 : hv ? 1.15 : 1;
      g.scale.lerp(_v.set(target, target, target), 0.15);
      g.userData.core.material.color.lerp(on ? SIGNAL : new THREE.Color(0x13243a), 0.12);
      g.userData.ring.material.opacity += ((on ? 0.7 : 0) - g.userData.ring.material.opacity) * 0.1;
      g.userData.ring.rotation.z += dt * (on ? 0.8 : 0.2);
      g.userData.ring.lookAt(camera.position);
    });

    // camera parallax + soft focus on the active node
    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;
    camera.position.x += (camTargetX + pointer.x * 1.0 - camera.position.x) * 0.06;
    camera.position.y += (-pointer.y * 0.6 - camera.position.y) * 0.06;
    camera.lookAt(camTargetX * 0.4, 0, 0);

    renderer.render(scene, camera);

    // project labels onto the node positions
    for (let i = 0; i < N; i++) {
      _v.copy(nodes[i].position); _v.project(camera);
      const x = (_v.x * 0.5 + 0.5) * width;
      const y = (-_v.y * 0.5 + 0.5) * height + 60;
      labels[i].style.transform = `translate(-50%,-50%) translate(${x}px, ${y}px)`;
      labels[i].style.opacity = _v.z < 1 ? '' : '0';
    }
  }
  function start() { if (!running) { running = true; last = 0; raf = requestAnimationFrame(frame); } }
  function stop() { if (running) { running = false; cancelAnimationFrame(raf); } }

  function resize() {
    width = stage.clientWidth || width; height = stage.clientHeight || height;
    if (!width || !height) return;
    camera.aspect = width / height; camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }
  window.addEventListener('resize', resize);

  // pause when offscreen / tab hidden
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((en) => { en[0].isIntersecting && document.visibilityState === 'visible' ? start() : stop(); }, { threshold: 0.05 }).observe(stage);
  } else start();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') stop(); else start(); });

  // go live
  tl.classList.add('is3d');
  resize();
  select(active, false);
  start();
}
