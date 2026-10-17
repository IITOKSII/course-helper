(() => {
  'use strict';
  // Recovery build: do not read, scan or change the lesson during installation.
  if (typeof window.__chPCStop === 'function') {
    try { window.__chPCStop(); } catch {}
  }
  const old = document.getElementById('course-helper-recovery');
  if (old) old.remove();
  const panel = document.createElement('section');
  panel.id = 'course-helper-recovery';
  panel.style.cssText = 'position:fixed;right:16px;top:16px;z-index:2147483647;width:290px;padding:16px;border:1px solid #8ca1ba;border-radius:12px;background:#172435;color:white;font:14px/1.5 system-ui;box-shadow:0 8px 24px #0008';
  panel.innerHTML = '<b>Course Helper · recovery 18</b><p id="chr-status" role="status">Installed. Paused. No course scanning until Start.</p><button id="chr-start">Start auto</button> <button id="chr-stop">Pause</button> <button id="chr-close">Close</button><p style="font-size:12px">Complete information pop-ups manually in this recovery build. Auto uses the course Next button.</p>';
  (document.body || document.documentElement).appendChild(panel);
  const status = text => { panel.querySelector('#chr-status').textContent = text; };
  let timer = null, running = false, busy = false, clicks = 0;
  const shown = el => {
    if (!el || !el.isConnected || !el.getClientRects().length) return false;
    const css = getComputedStyle(el);
    return css.visibility !== 'hidden' && css.display !== 'none';
  };
  const disabled = el => el.disabled || el.hasAttribute('disabled') ||
    el.getAttribute('aria-disabled') === 'true' ||
    !!el.closest('.disabled,.is-disabled,.cs-disabled,[aria-disabled="true"]');
  const pause = message => {
    running = false;
    clearTimeout(timer);
    timer = null;
    if (message) status(message);
  };
  function tick() {
    if (!running || busy) return;
    busy = true;
    try {
      // No recursive frame traversal, whole-page text extraction, or animations.
      const next = document.getElementById('next');
      if (!next) {
        pause('Next not found in this frame. Run the helper in the lesson frame.');
        return;
      }
      const question = document.querySelector('input[type="radio"],[role="radio"],.quiz input,.question input');
      if (shown(question)) {
        pause('Question detected. Complete it manually, then restart Auto.');
        return;
      }
      if (!shown(next) || disabled(next)) {
        status('Auto: waiting for the course Next button to unlock.');
        return;
      }
      // Only inspect a small, bounded set of course timeline controls.
      const sliders = document.querySelectorAll('[role="slider"],input[type="range"]');
      for (let i = 0; i < Math.min(sliders.length, 12); i++) {
        const el = sliders[i];
        const name = el.id + ' ' + (el.getAttribute('aria-label') || '');
        if (!/seek|timeline|progress|scrub/i.test(name) || /volume/i.test(name) || !shown(el)) continue;
        const value = Number(el.getAttribute('aria-valuenow') ?? el.value);
        const max = Number(el.getAttribute('aria-valuemax') ?? el.max);
        if (Number.isFinite(value) && max > 0 && value < max - 0.01) {
          status('Auto: waiting for the course timeline.');
          return;
        }
      }
      const tracks = document.querySelectorAll('audio,video');
      for (let i = 0; i < Math.min(tracks.length, 8); i++) {
        const m = tracks[i];
        if (!m.paused && !m.ended) {
          status('Auto: waiting for narration to finish.');
          return;
        }
      }
      next.click();
      clicks++;
      status('Auto: Next clicked (' + clicks + '). Complete any required pop-ups if the course stays on this slide.');
    } catch (error) {
      pause('Auto stopped: ' + error.message);
    } finally {
      busy = false;
      if (running) timer = setTimeout(tick, 3000);
    }
  }
  panel.querySelector('#chr-start').onclick = () => {
    if (running) return;
    running = true;
    status('Auto starting. Pause stops all checks.');
    timer = setTimeout(tick, 1500);
  };
  panel.querySelector('#chr-stop').onclick = () => pause('Paused. No course scanning.');
  function cleanup() {
    pause();
    panel.remove();
    if (window.__chPCStop === cleanup) delete window.__chPCStop;
  }
  panel.querySelector('#chr-close').onclick = cleanup;
  window.__chPCStop = cleanup;
})();
