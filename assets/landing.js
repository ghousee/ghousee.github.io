/* Landing-only enhancement: lazily mount the 3D hero, but ONLY when it can
   help - large screen, WebGL available, motion allowed. Otherwise the page
   keeps the clean CSS grid backdrop and nothing is downloaded. three.js is
   never fetched unless these checks pass. */

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
  } catch (e) {
    return false;
  }
}

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const bigEnough = window.innerWidth >= 720;
const lowMemory = navigator.deviceMemory && navigator.deviceMemory <= 2;

// site-wide ambient data-pipeline backdrop (behind all content)
// Runs on phones too (with a lighter config inside pipeline-bg.js); still
// skipped under reduced-motion, low memory, or no WebGL.
const pipeCanvas = document.getElementById('pipe-bg');
if (pipeCanvas && !reduce && !lowMemory && webglAvailable()) {
  const mount = () =>
    import('./pipeline-bg.js?v=3')
      .then(({ initPipelineBG }) => initPipelineBG(pipeCanvas))
      .catch(() => { /* WebGL/three failed - keep the static CSS grid backdrop */ });
  // wait until the browser is idle (and the intro has had a beat) so first
  // paint and scrolling are never blocked
  if ('requestIdleCallback' in window) requestIdleCallback(mount, { timeout: 1500 });
  else setTimeout(mount, 800);
}

// 3D journey timeline: enhance the flat timeline when eligible. Mounts only
// once it nears the viewport, so it costs nothing until scrolled to. The flat
// horizontal track remains the fallback for everyone else.
const tl = document.querySelector('.tl');
if (tl && !reduce && bigEnough && !lowMemory && webglAvailable()) {
  let mounted = false;
  const io = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !mounted) {
      mounted = true; io.disconnect();
      import('./journey3d.js?v=4').then(({ initJourney3D }) => initJourney3D(tl)).catch(() => {});
    }
  }, { rootMargin: '400px' });
  io.observe(tl);
}
