'use strict';
(() => {
  const modules = { dd: TS.DD, pn: TS.PN, moscap: TS.MOSCAP, mosfet: TS.MOSFET, bjt: TS.BJT };
  const started = {};
  let active = null;

  function show(id) {
    if (!modules[id]) id = 'mosfet';
    document.querySelectorAll('section.tab').forEach(s => s.classList.toggle('active', s.id === 'tab-' + id));
    document.querySelectorAll('nav.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === id));
    active = id;
    if (!started[id]) { modules[id].init(); started[id] = true; }
    modules[id].dirty = true;
    if (location.hash !== '#' + id) history.replaceState(null, '', '#' + id);
  }

  TS.showTab = show;
  document.querySelectorAll('nav.tabs button').forEach(b => b.addEventListener('click', () => show(b.dataset.tab)));
  window.addEventListener('hashchange', () => show(location.hash.slice(1)));
  show(location.hash.slice(1) || 'mosfet');

  let last = performance.now();
  function loop(t) {
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    if (active && started[active]) modules[active].frame(dt);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
