/* Hidden arcade menu - shown when the easter egg is summoned (Konami code or
   triple-click the logo dot). Lets you pick a game; each game module is
   lazy-loaded only when chosen. WebGL games are hidden if WebGL is unavailable
   (the 2D game always works). */

let OPEN = false;

function webglOK() {
  try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl'))); }
  catch (e) { return false; }
}

export function openArcade() {
  if (OPEN) return;
  OPEN = true;
  injectStyle();
  const gl = webglOK();

  const games = [
    { id: '3d', tag: '3D', name: 'DATA INTERCEPT', desc: 'Defend the globe from corrupt packets before they breach.', mod: './game3d.js', fn: 'launchGame3D', needsGL: true },
    { id: 'rk', tag: '3D', name: 'LAUNCH', desc: 'Fly a rocket through an endless asteroid field. Grab the data orbs.', mod: './game-rocket.js', fn: 'launchRocket', needsGL: true },
    { id: '2d', tag: '2D', name: 'PIPELINE', desc: 'Catch falling data packets into the warehouse. Don’t drop data.', mod: './game.js', fn: 'launchGame', needsGL: false }
  ].filter((g) => gl || !g.needsGL);

  const overlay = document.createElement('div');
  overlay.className = 'ar-overlay';
  overlay.innerHTML = `
    <div class="ar-panel" role="dialog" aria-label="Hidden arcade">
      <div class="ar-bar">
        <span class="ar-title"><span class="ar-dot"></span>ARCADE<span class="ar-muted"> // you found the secret</span></span>
        <button class="ar-close" aria-label="Close">esc ✕</button>
      </div>
      <div class="ar-grid">
        ${games.map((g) => `
          <button class="ar-card" data-id="${g.id}">
            <span class="ar-tag">${g.tag}</span>
            <span class="ar-name">${g.name}</span>
            <span class="ar-desc">${g.desc}</span>
            <span class="ar-go">play ▸</span>
          </button>`).join('')}
      </div>
    </div>`;
  document.body.appendChild(overlay);

  function close() { if (!OPEN) return; OPEN = false; window.removeEventListener('keydown', onKey); overlay.remove(); }
  function onKey(e) { if (e.key === 'Escape') close(); }
  window.addEventListener('keydown', onKey);
  overlay.querySelector('.ar-close').addEventListener('click', close);
  overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) close(); });

  overlay.querySelectorAll('.ar-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      const g = games.find((x) => x.id === btn.dataset.id);
      close();
      import(g.mod).then((m) => m[g.fn]()).catch(() => {});
    });
  });
}

let styled = false;
function injectStyle() {
  if (styled) return; styled = true;
  const s = document.createElement('style');
  s.textContent = `
    .ar-overlay{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;
      background:rgba(6,9,13,0.82);backdrop-filter:blur(6px);animation:arIn .25s ease;padding:20px;}
    @keyframes arIn{from{opacity:0}to{opacity:1}}
    .ar-panel{border:1px solid #1f2b3d;border-radius:14px;overflow:hidden;background:#0b1118;
      box-shadow:0 30px 80px rgba(0,0,0,.55);width:680px;max-width:92vw;}
    .ar-bar{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #16202e;}
    .ar-title{font-family:ui-monospace,monospace;font-size:13px;font-weight:600;color:#e8edf4;display:flex;align-items:center;gap:9px;}
    .ar-muted{color:#5e6b7d;font-weight:500;}
    .ar-dot{width:8px;height:8px;border-radius:50%;background:#4ade80;box-shadow:0 0 8px #4ade80;}
    .ar-close{font-family:ui-monospace,monospace;font-size:12px;color:#9aa7b8;background:transparent;border:1px solid #1f2b3d;border-radius:7px;padding:4px 10px;cursor:pointer;transition:all .2s;}
    .ar-close:hover{color:#4ade80;border-color:#2f9e5c;}
    .ar-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:16px;}
    .ar-grid .ar-card:first-child{grid-column:1 / -1;}
    .ar-card{display:flex;flex-direction:column;align-items:flex-start;gap:6px;text-align:left;cursor:pointer;
      border:1px solid #1f2b3d;border-radius:12px;background:#111824;padding:18px;transition:transform .18s ease,border-color .18s ease;}
    .ar-card:hover{transform:translateY(-3px);border-color:#4ade80;}
    .ar-tag{font-family:ui-monospace,monospace;font-size:10px;color:#04130a;background:#4ade80;border-radius:5px;padding:2px 7px;font-weight:700;letter-spacing:.04em;}
    .ar-name{font-family:"Space Grotesk",system-ui,sans-serif;font-weight:600;font-size:18px;color:#e8edf4;}
    .ar-desc{font-family:Inter,system-ui,sans-serif;font-size:13px;color:#9aa7b8;line-height:1.5;}
    .ar-go{font-family:ui-monospace,monospace;font-size:12px;color:#4ade80;margin-top:4px;}
    @media (max-width:560px){.ar-grid{grid-template-columns:1fr;}.ar-grid .ar-card:first-child{grid-column:auto;}}`;
  document.head.appendChild(s);
}
