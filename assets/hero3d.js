/* Hero background - an ambient 3D DATA PIPELINE that depicts what Ghouse builds:
   source nodes (APIs, S3, email, partners) emit particles that flow along edges
   into a central warehouse, which streams them out to a dashboard / front-end.
   Lazy-loaded by landing.js only when it can help (desktop, WebGL, motion ok).
   Exposes { pause, resume } so the render loop can stop offscreen / tab-hidden. */
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export function initHero3D(canvas) {
  const SIGNAL = new THREE.Color('#4ade80');
  const DIM = new THREE.Color('#2f9e5c');

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  const group = new THREE.Group();
  group.position.x = 0.6;            // nudge right; hero text sits left
  scene.add(group);

  // ---------- nodes ----------
  const WH = new THREE.Vector3(0.4, 0, 0);     // warehouse (centre)
  const DASH = new THREE.Vector3(5.0, 0, 0);   // dashboard / front-end (right)
  const srcY = [2.5, 0.9, -0.9, -2.5];
  const sources = srcY.map((y) => new THREE.Vector3(-5.0, y, (Math.random() - 0.5) * 0.6));

  // source nodes: small wireframe octahedra
  const srcGeo = new THREE.OctahedronGeometry(0.26, 0);
  sources.forEach((p) => {
    const m = new THREE.Mesh(srcGeo, new THREE.MeshBasicMaterial({ color: DIM, wireframe: true, transparent: true, opacity: 0.85 }));
    m.position.copy(p); m.userData.spin = 0.3 + Math.random() * 0.4; group.add(m);
  });

  // warehouse: a database-style cylinder + glowing wireframe shell
  const warehouse = new THREE.Group();
  warehouse.position.copy(WH);
  const dbBody = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 1.5, 32), new THREE.MeshBasicMaterial({ color: 0x10243a }));
  const dbWire = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 0.86, 1.5, 20, 4, true), new THREE.MeshBasicMaterial({ color: SIGNAL, wireframe: true, transparent: true, opacity: 0.4 }));
  warehouse.add(dbBody, dbWire);
  group.add(warehouse);

  // dashboard: a front-end panel (subdivided wireframe plane + faint back)
  const dash = new THREE.Group();
  dash.position.copy(DASH);
  dash.add(new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.7), new THREE.MeshBasicMaterial({ color: 0x0e1a2a, transparent: true, opacity: 0.85, side: THREE.DoubleSide })));
  dash.add(new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.7, 4, 3), new THREE.MeshBasicMaterial({ color: DIM, wireframe: true, transparent: true, opacity: 0.55, side: THREE.DoubleSide })));
  // a couple of "bars" to suggest a chart
  for (let i = 0; i < 3; i++) {
    const h = 0.4 + i * 0.28;
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.28, h), new THREE.MeshBasicMaterial({ color: SIGNAL, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
    bar.position.set(-0.55 + i * 0.5, -0.85 + h / 2, 0.02); dash.add(bar);
  }
  group.add(dash);

  // ---------- edges (curved) ----------
  const edges = [];
  sources.forEach((p) => {
    const ctrl = new THREE.Vector3((p.x + WH.x) / 2, p.y * 0.35, p.z * 0.5);
    edges.push(new THREE.QuadraticBezierCurve3(p.clone(), ctrl, WH.clone()));
  });
  const whOut = new THREE.QuadraticBezierCurve3(WH.clone(), new THREE.Vector3((WH.x + DASH.x) / 2, 0.15, 0), DASH.clone());
  edges.push(whOut);

  // draw faint edge lines
  edges.forEach((curve, i) => {
    const pts = curve.getPoints(24);
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const isOut = i === edges.length - 1;
    group.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: isOut ? SIGNAL : DIM, transparent: true, opacity: isOut ? 0.4 : 0.22 })));
  });

  // ---------- flowing particles ----------
  const PER_IN = 12, PER_OUT = 20;
  const particles = [];
  edges.forEach((curve, i) => {
    const isOut = i === edges.length - 1;
    const count = isOut ? PER_OUT : PER_IN;
    for (let k = 0; k < count; k++) particles.push({ curve, t: Math.random(), speed: (isOut ? 0.28 : 0.18) + Math.random() * 0.12 });
  });
  const pPos = new Float32Array(particles.length * 3);
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const pts = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: SIGNAL, size: 0.12, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
  group.add(pts);

  // ---------- interaction ----------
  const target = { x: 0, y: 0 };
  function onPointer(e) { target.x = (e.clientX / window.innerWidth - 0.5); target.y = (e.clientY / window.innerHeight - 0.5); }
  window.addEventListener('pointermove', onPointer);

  function resize() {
    const w = canvas.clientWidth || canvas.parentElement.clientWidth;
    const h = canvas.clientHeight || canvas.parentElement.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h, false);
  }
  window.addEventListener('resize', resize); resize();

  // ---------- loop ----------
  const _v = new THREE.Vector3();
  let raf = null, last = 0, running = false;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016; last = now;

    // particles travel their curve, wrap around
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.t += p.speed * dt;
      if (p.t > 1) p.t -= 1;
      p.curve.getPoint(p.t, _v);
      pPos[i * 3] = _v.x; pPos[i * 3 + 1] = _v.y; pPos[i * 3 + 2] = _v.z;
    }
    pGeo.attributes.position.needsUpdate = true;

    // alive: spin sources, pulse warehouse
    group.children.forEach((c) => { if (c.userData.spin) { c.rotation.x += c.userData.spin * dt; c.rotation.y += c.userData.spin * dt; } });
    const s = 1 + Math.sin(now * 0.002) * 0.04; warehouse.scale.set(s, 1, s);
    dbWire.rotation.y += dt * 0.25;

    // gentle cursor parallax
    group.rotation.y += (target.x * 0.4 - group.rotation.y) * 0.04;
    group.rotation.x += (target.y * 0.25 - group.rotation.x) * 0.04;

    renderer.render(scene, camera);
  }

  function resume() { if (!running) { running = true; last = 0; raf = requestAnimationFrame(frame); } }
  function pause() { if (running) { running = false; cancelAnimationFrame(raf); } }

  return { resume, pause };
}
