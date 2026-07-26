/* Shared site behaviour - used by the landing page and every case study.
   Intentionally tiny and dependency-free. The 3D hero loads separately and
   lazily; nothing here blocks first paint. */
(function () {
  // resolve the assets dir from this script's own URL so lazy imports work
  // from any page (landing or work/*.html)
  const ASSET_BASE = (document.currentScript && document.currentScript.src || '').replace(/[^/]*$/, '');

  // ---- hidden arcade (lazy-loaded only when summoned) ----
  let summoning = false;
  function summonGame() {
    if (summoning) return; summoning = true;
    import(ASSET_BASE + 'arcade.js')
      .then((m) => { summoning = false; m.openArcade(); })
      .catch(() => { summoning = false; });
  }

  // trigger 1: the Konami code
  const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let kIdx = 0;
  window.addEventListener('keydown', (e) => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    kIdx = (key === KONAMI[kIdx]) ? kIdx + 1 : (key === KONAMI[0] ? 1 : 0);
    if (kIdx === KONAMI.length) { kIdx = 0; summonGame(); }
  });

  // trigger 2: single click/tap the logo dot (touch-friendly). stopPropagation
  // + preventDefault so it doesn't follow the brand link on case-study pages.
  const dot = document.querySelector('.brand .dot');
  if (dot) {
    dot.style.cursor = 'pointer';
    dot.title = 'play';
    dot.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); summonGame(); });
  }

  // current year in footer
  const yr = document.getElementById('yr');
  if (yr) yr.textContent = new Date().getFullYear();

  // scroll reveal (no-op gracefully if IntersectionObserver is missing)
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealEls.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('in'));
  }

  // interactive journey timeline: click a milestone to expand its detail
  const tlNodes = document.querySelectorAll('.tl-node');
  if (tlNodes.length) {
    tlNodes.forEach((node) => {
      node.addEventListener('click', () => {
        const id = node.dataset.target;
        tlNodes.forEach((n) => {
          const on = n === node;
          n.classList.toggle('active', on);
          if (on) n.setAttribute('aria-selected', 'true'); else n.removeAttribute('aria-selected');
        });
        document.querySelectorAll('.tl-content').forEach((c) => c.classList.toggle('active', c.id === id));
      });
    });
  }

  // project / decision card glow + subtle 3D tilt follows the cursor
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('.card').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      card.style.setProperty('--my', (e.clientY - r.top) + 'px');
      if (fine && !reduceMotion) {
        const rx = ((e.clientY - r.top) / r.height - 0.5) * -6;
        const ry = ((e.clientX - r.left) / r.width - 0.5) * 6;
        card.style.transform = `perspective(800px) translateY(-3px) rotateX(${rx}deg) rotateY(${ry}deg)`;
      }
    });
    card.addEventListener('pointerleave', () => { card.style.transform = ''; });
  });
})();
