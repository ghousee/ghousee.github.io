/* PIPELINE - a hidden easter-egg game.
   Unlocked by the Konami code or a triple-click on the logo dot (see site.js).
   Self-contained 2D canvas: no dependencies, works on any page, lazy-loaded
   only when triggered. Catch green data packets into the warehouse; avoid the
   corrupt red ones; don't drop data. Esc closes and fully cleans up. */

let OPEN = false;

export function launchGame() {
  if (OPEN) return;
  OPEN = true;
  injectStyle();

  const W = 720, H = 460;
  const overlay = document.createElement('div');
  overlay.className = 'pg-overlay';
  overlay.innerHTML = `
    <div class="pg-panel" role="dialog" aria-label="Pipeline mini game">
      <div class="pg-bar">
        <span class="pg-title"><span class="pg-dot"></span>PIPELINE<span class="pg-muted"> // catch the data</span></span>
        <button class="pg-close" aria-label="Close game">esc ✕</button>
      </div>
      <canvas class="pg-canvas" width="${W}" height="${H}"></canvas>
    </div>`;
  document.body.appendChild(overlay);

  const canvas = overlay.querySelector('.pg-canvas');
  const ctx = canvas.getContext('2d');
  const closeBtn = overlay.querySelector('.pg-close');

  const SIGNAL = '#4ade80', RED = '#f4615e', INK = '#e8edf4', FAINT = '#5e6b7d';
  const SOURCES = ['API', 'S3', 'MAIL', 'P2P'];

  const state = {
    mode: 'start',          // start | play | over
    score: 0, best: +(localStorage.getItem('pipeline_best') || 0),
    lives: 3, streak: 0, mult: 1,
    packets: [], particles: [],
    spawn: 0, spawnEvery: 0.95, fall: 150,
    collectorX: W / 2, keyLeft: false, keyRight: false,
    t: 0, raf: null, last: 0
  };

  const COLL_W = 96, COLL_H = 18, COLL_Y = H - 38;

  function reset() {
    Object.assign(state, {
      mode: 'play', score: 0, lives: 3, streak: 0, mult: 1,
      packets: [], particles: [], spawn: 0, spawnEvery: 0.95, fall: 150, t: 0
    });
  }

  function spawnPacket() {
    const corrupt = Math.random() < 0.16;
    state.packets.push({
      x: 30 + Math.random() * (W - 60), y: -16,
      vy: state.fall * (0.85 + Math.random() * 0.4),
      corrupt, label: corrupt ? 'ERR' : SOURCES[(Math.random() * SOURCES.length) | 0]
    });
  }

  function burst(x, y, color) {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2, s = 40 + Math.random() * 120;
      state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5, color });
    }
  }

  function loseLife(x, y) {
    state.lives--; state.streak = 0; state.mult = 1; burst(x, y, RED);
    if (state.lives <= 0) {
      state.mode = 'over';
      state.best = Math.max(state.best, state.score);
      localStorage.setItem('pipeline_best', state.best);
    }
  }

  // ---- input ----
  function pointerX(e) {
    const r = canvas.getBoundingClientRect();
    return ((e.clientX - r.left) / r.width) * W;
  }
  function onMove(e) { if (state.mode === 'play') state.collectorX = pointerX(e); }
  function onDown(e) {
    if (state.mode === 'start') reset();
    else if (state.mode === 'over') reset();
    else state.collectorX = pointerX(e);
  }
  function onKey(e) {
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'ArrowLeft') state.keyLeft = (e.type === 'keydown');
    if (e.key === 'ArrowRight') state.keyRight = (e.type === 'keydown');
    if (e.type === 'keydown') {
      if (state.mode === 'start' && (e.key === ' ' || e.key === 'Enter')) reset();
      else if (state.mode === 'over' && (e.key.toLowerCase() === 'r' || e.key === 'Enter')) reset();
      if ([' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) e.preventDefault();
    }
  }
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerdown', onDown);
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) close(); });

  // ---- update + draw ----
  function update(dt) {
    if (state.mode !== 'play') return;
    state.t += dt;
    state.fall = 150 + state.score * 0.45;
    state.spawnEvery = Math.max(0.4, 0.95 - state.score * 0.0015);

    if (state.keyLeft) state.collectorX -= 380 * dt;
    if (state.keyRight) state.collectorX += 380 * dt;
    state.collectorX = Math.max(COLL_W / 2, Math.min(W - COLL_W / 2, state.collectorX));

    state.spawn += dt;
    if (state.spawn >= state.spawnEvery) { state.spawn = 0; spawnPacket(); }

    for (let i = state.packets.length - 1; i >= 0; i--) {
      const p = state.packets[i];
      p.y += p.vy * dt;
      const caught = p.y + 12 >= COLL_Y && p.y - 12 <= COLL_Y + COLL_H &&
                     Math.abs(p.x - state.collectorX) <= COLL_W / 2 + 10;
      if (caught) {
        state.packets.splice(i, 1);
        if (p.corrupt) loseLife(p.x, COLL_Y);
        else {
          state.streak++; if (state.streak % 5 === 0) state.mult++;
          state.score += 10 * state.mult; burst(p.x, COLL_Y, SIGNAL);
        }
      } else if (p.y - 16 > H) {
        state.packets.splice(i, 1);
        if (!p.corrupt) loseLife(p.x, H - 6); // dropped good data
      }
    }

    for (let i = state.particles.length - 1; i >= 0; i--) {
      const q = state.particles[i];
      q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 240 * dt; q.life -= dt;
      if (q.life <= 0) state.particles.splice(i, 1);
    }
  }

  function rrect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    // backdrop grid
    ctx.fillStyle = '#0b1118'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(31,43,61,0.5)'; ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y <= H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // particles
    state.particles.forEach((q) => {
      ctx.globalAlpha = Math.max(0, q.life * 2); ctx.fillStyle = q.color;
      ctx.fillRect(q.x - 1.5, q.y - 1.5, 3, 3);
    });
    ctx.globalAlpha = 1;

    // packets
    ctx.font = '600 9px ui-monospace, monospace'; ctx.textAlign = 'center';
    state.packets.forEach((p) => {
      const c = p.corrupt ? RED : SIGNAL;
      ctx.fillStyle = p.corrupt ? 'rgba(244,97,94,0.16)' : 'rgba(74,222,128,0.16)';
      rrect(p.x - 16, p.y - 11, 32, 22, 5); ctx.fill();
      ctx.strokeStyle = c; ctx.lineWidth = 1.4; rrect(p.x - 16, p.y - 11, 32, 22, 5); ctx.stroke();
      ctx.fillStyle = c; ctx.fillText(p.label, p.x, p.y + 3);
    });

    // collector (warehouse)
    ctx.fillStyle = SIGNAL; ctx.strokeStyle = SIGNAL;
    rrect(state.collectorX - COLL_W / 2, COLL_Y, COLL_W, COLL_H, 5); ctx.fill();
    ctx.fillStyle = '#04130a'; ctx.font = '600 10px ui-monospace, monospace';
    ctx.fillText('WAREHOUSE', state.collectorX, COLL_Y + 13);

    // HUD
    ctx.textAlign = 'left'; ctx.fillStyle = INK; ctx.font = '600 13px ui-monospace, monospace';
    ctx.fillText('SCORE ' + state.score, 16, 24);
    ctx.fillStyle = state.mult > 1 ? SIGNAL : FAINT;
    ctx.fillText('x' + state.mult, 16, 42);
    ctx.textAlign = 'right'; ctx.fillStyle = FAINT;
    ctx.fillText('BEST ' + state.best, W - 16, 24);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i < state.lives ? SIGNAL : '#283446';
      ctx.beginPath(); ctx.arc(W - 22 - i * 18, 38, 5, 0, 7); ctx.fill();
    }
    ctx.textAlign = 'left';

    if (state.mode === 'start') overlayText('PIPELINE', 'green = ingest   ·   red = corrupt   ·   don’t drop data', 'move: mouse or ← →      ·      click / space to start');
    else if (state.mode === 'over') overlayText('DATA LOSS', 'final score  ' + state.score + (state.score >= state.best ? '   ★ new best' : ''), 'press R to retry   ·   Esc to close');
  }

  function overlayText(title, sub, hint) {
    ctx.fillStyle = 'rgba(10,14,20,0.74)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = SIGNAL; ctx.font = '700 40px "Space Grotesk", system-ui, sans-serif';
    ctx.fillText(title, W / 2, H / 2 - 18);
    ctx.fillStyle = INK; ctx.font = '500 15px ui-monospace, monospace';
    ctx.fillText(sub, W / 2, H / 2 + 14);
    ctx.fillStyle = FAINT; ctx.font = '500 12px ui-monospace, monospace';
    ctx.fillText(hint, W / 2, H / 2 + 40);
    ctx.textAlign = 'left';
  }

  function frame(now) {
    state.raf = requestAnimationFrame(frame);
    const dt = state.last ? Math.min((now - state.last) / 1000, 0.05) : 0.016;
    state.last = now;
    update(dt); draw();
  }
  state.raf = requestAnimationFrame(frame);

  function close() {
    if (!OPEN) return;
    OPEN = false;
    cancelAnimationFrame(state.raf);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerdown', onDown);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKey);
    overlay.remove();
  }
}

let styled = false;
function injectStyle() {
  if (styled) return; styled = true;
  const s = document.createElement('style');
  s.textContent = `
    .pg-overlay{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;
      background:rgba(6,9,13,0.82);backdrop-filter:blur(6px);animation:pgIn .25s ease;padding:20px;}
    @keyframes pgIn{from{opacity:0}to{opacity:1}}
    .pg-panel{border:1px solid #1f2b3d;border-radius:14px;overflow:hidden;background:#0b1118;
      box-shadow:0 30px 80px rgba(0,0,0,.5);max-width:92vw;}
    .pg-bar{display:flex;align-items:center;justify-content:space-between;padding:11px 14px;border-bottom:1px solid #16202e;}
    .pg-title{font-family:ui-monospace,monospace;font-size:13px;font-weight:600;color:#e8edf4;display:flex;align-items:center;gap:9px;letter-spacing:.02em;}
    .pg-muted{color:#5e6b7d;font-weight:500;}
    .pg-dot{width:8px;height:8px;border-radius:50%;background:#4ade80;box-shadow:0 0 8px #4ade80;}
    .pg-close{font-family:ui-monospace,monospace;font-size:12px;color:#9aa7b8;background:transparent;border:1px solid #1f2b3d;border-radius:7px;padding:4px 10px;cursor:pointer;transition:all .2s;}
    .pg-close:hover{color:#4ade80;border-color:#2f9e5c;}
    .pg-canvas{display:block;width:720px;max-width:92vw;height:auto;touch-action:none;}`;
  document.head.appendChild(s);
}
