
(() => {
  'use strict';

  if (typeof window.__chPCStop === 'function') {
    window.__chPCStop();
  }

  const state = {
    auto: false,
    speed: 3,
    wpm: 600,
    timer: null,
    tick: null,
    keyboard: false
  };

  const panel = document.createElement('section');
  panel.id = 'course-helper-pc';

  panel.style.cssText = `
    all: initial;
    position: fixed;
    top: 20px;
    right: 20px;
    width: 390px;
    height: 540px;
    min-width: 260px;
    min-height: 65px;
    max-width: 95vw;
    max-height: 90vh;
    z-index: 2147483647;
    background: #17191e;
    color: #fff;
    border: 1px solid #7e8999;
    border-radius: 10px;
    resize: both;
    overflow: hidden;
    box-shadow: 0 8px 30px #0009;
    font: 14px Arial, sans-serif;
  `;

  panel.innerHTML = `
    <div id="ch-head" style="display:flex;justify-content:space-between;align-items:center;background:#2a3341;padding:12px;cursor:move;user-select:none">
      <b>Course Helper PC</b>
      <span>
        <button id="ch-min">−</button>
        <button id="ch-close">×</button>
      </span>
    </div>

    <div id="ch-body" style="height:calc(100% - 48px);overflow:auto;padding:12px;box-sizing:border-box">
      <div id="ch-alert" role="status" style="padding:10px;background:#394258;margin-bottom:10px;border-radius:6px">
        Checking current lesson…
      </div>

      <div style="display:flex;gap:7px;flex-wrap:wrap">
        <button id="ch-prev">◀ Back</button>
        <button id="ch-paragraph">Finish paragraph</button>
        <button id="ch-next">Next ▶</button>
      </div>

      <button id="ch-auto" style="width:100%;margin-top:10px;padding:10px;font-weight:bold">
        Start auto
      </button>

      <p>
        <label>
          Reading rate <output id="ch-rate-label">600</output> wpm
          <input id="ch-rate" type="range" min="200" max="1200" step="100" value="600" style="width:100%">
        </label>
      </p>

      <p>
        Media speed
        <select id="ch-speed">
          <option>1</option>
          <option>1.5</option>
          <option>2</option>
          <option selected>3</option>
          <option>4</option>
        </select> ×
      </p>

      <label>
        <input id="ch-keys" type="checkbox">
        Keyboard: Alt+→ next, Alt+← back, Alt+↓ finish
      </label>

      <details open>
        <summary>Visible slide text</summary>
        <div id="ch-text" style="margin-top:8px;white-space:pre-wrap;line-height:1.5;max-height:220px;overflow:auto"></div>
        <button id="ch-refresh">Refresh text</button>
      </details>

      <details>
        <summary>Quiz help</summary>
        <p>Quizzes are detected when visible. Auto pauses for questions. Review answers and submit yourself.</p>
        <button id="ch-copy">Copy visible question text</button>
      </details>

      <p id="ch-status" role="status" style="font-size:12px;color:#c7d5e5">
        Ready. Resize by dragging the bottom-right corner.
      </p>
    </div>
  `;

  document.body.append(panel);

  const $ = id => panel.querySelector('#' + id);

  const docs = () => {
    const out = [document];

    for (const f of document.querySelectorAll('iframe')) {
      try {
        if (f.contentDocument) {
          out.push(f.contentDocument);
        }
      } catch {}
    }

    return out;
  };

  const visible = el =>
    !!el.getClientRects().length &&
    getComputedStyle(el).visibility !== 'hidden';

  const label = el =>
    (
      el.getAttribute('aria-label') ||
      el.innerText ||
      el.textContent ||
      el.value ||
      ''
    ).trim().toLowerCase();

  function assessment() {
    for (const doc of docs()) {
      const quizText = (doc.body?.innerText || '')
        .slice(0, 18000)
        .toLowerCase();

      if (/(knowledge check|knowledge quiz|submit answer|check answer|select the correct|which of the following|quiz|assessment)/.test(quizText)) {
        return true;
      }

      if ([...doc.querySelectorAll('input[type=radio],input[type=checkbox],[role=radio],[role=checkbox]')].some(visible)) {
        return true;
      }
    }

    return false;
  }

  function status(message) {
    $('ch-status').textContent = message;
  }

  function refresh() {
    const chunks = [];

    for (const doc of docs()) {
      for (const el of doc.querySelectorAll('main p,article p,[role=main] p,.slide p,h1,h2,h3')) {
        if (visible(el) && !panel.contains(el)) {
          let t = (el.innerText || '').trim();

          if (
            t.length > 15 &&
            t.length < 2500 &&
            !chunks.includes(t)
          ) {
            chunks.push(t);
          }
        }
      }
    }

    $('ch-text').textContent =
      chunks.slice(0, 30).join('\n\n') ||
      'No readable text detected in this slide.';

    return chunks.join(' ').split(/\s+/).filter(Boolean).length;
  }

  function media() {
    return docs()
      .flatMap(d => [...d.querySelectorAll('audio,video')])
      .filter(visible);
  }

  function speed() {
    for (const m of media()) {
      try {
        m.playbackRate = state.speed;
      } catch {}
    }
  }

  function finish() {
    if (assessment()) {
      stop('Quiz or interaction detected. Complete it manually.');
      return false;
    }

    let count = 0;

    for (const m of media()) {
      try {
        if (
          Number.isFinite(m.duration) &&
          m.duration > 0
        ) {
          m.currentTime = Math.max(0, m.duration - .05);
          count++;
        }
      } catch {}
    }

    status(
      count
        ? `Finished ${count} media segment(s).`
        : 'No accessible media timeline. Use the platform controls.'
    );

    setTimeout(refresh, 450);
    return count > 0;
  }

  function nav(dir) {
    if (assessment()) {
      stop('Question or interaction detected. Auto stopped.');
      return false;
    }

    const terms = dir === 'next'
      ? ['next', 'continue', 'next slide']
      : ['back', 'previous', 'previous slide'];

    for (const doc of docs()) {
      const all = [
        ...doc.querySelectorAll(
          'button,a,[role=button],input[type=button]'
        )
      ];

      const button = all.find(
        x =>
          visible(x) &&
          !x.disabled &&
          terms.some(
            t => label(x) === t || label(x).startsWith(t + ' ')
          )
      );

      if (button) {
        button.click();

        status(
          `Selected ${dir}. Completion is not guaranteed until the LMS confirms it.`
        );

        setTimeout(refresh, 650);
        return true;
      }
    }

    status(`No accessible ${dir} control found.`);
    return false;
  }

  function stop(reason) {
    state.auto = false;
    clearTimeout(state.timer);

    $('ch-auto').textContent = 'Start auto';

    if (reason) {
      status(reason);
    }
  }

  function cycle() {
    if (!state.auto) return;

    if (assessment()) {
      stop('Quiz or interaction detected. Complete it manually.');
      return;
    }

    let words = refresh();

    let seconds = Math.max(
      3,
      Math.min(
        25,
        Math.ceil(words / state.wpm * 60)
      )
    );

    status(
      `Reading ${words} words; next attempt in ${seconds}s.`
    );

    state.timer = setTimeout(() => {
      if (!state.auto) return;

      if (assessment()) {
        stop('Quiz detected.');
        return;
      }

      finish();

      state.timer = setTimeout(() => {
        if (!state.auto) return;

        if (nav('next')) {
          state.timer = setTimeout(cycle, 1200);
        } else {
          stop('Next unavailable. Check course completion.');
        }
      }, 650);

    }, seconds * 1000);
  }

  $('ch-prev').onclick = () => {
    stop();
    nav('previous');
  };

  $('ch-paragraph').onclick = () => {
    stop();
    finish();
  };

  $('ch-next').onclick = () => {
    stop();

    if (!finish()) {
      nav('next');
    }
  };

  $('ch-auto').onclick = () => {
    if (state.auto) {
      stop('Paused');
      return;
    }

    state.auto = true;
    $('ch-auto').textContent = 'Pause auto';
    cycle();
  };

  $('ch-refresh').onclick = refresh;

  $('ch-rate').oninput = e => {
    state.wpm = +e.target.value;
    $('ch-rate-label').textContent = state.wpm;
  };

  $('ch-speed').onchange = e => {
    state.speed = +e.target.value;
    speed();
  };

  $('ch-keys').onchange = e => {
    state.keyboard = e.target.checked;
  };

  $('ch-copy').onclick = async () => {
    let text = docs()
      .map(d => d.body?.innerText || '')
      .join('\n')
      .slice(0, 15000);

    try {
      await navigator.clipboard.writeText(text);
      status(
        'Visible text copied. Clipboard may persist after closing.'
      );
    } catch {
      status('Clipboard access blocked.');
    }
  };

  let minimized = false;

  $('ch-min').onclick = () => {
    minimized = !minimized;

    $('ch-body').style.display =
      minimized ? 'none' : 'block';

    panel.style.height =
      minimized ? '48px' : '540px';
  };

  let drag = null;
  const head = $('ch-head');

  head.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;

    const rect = panel.getBoundingClientRect();

    drag = {
      dx: e.clientX - rect.left,
      dy: e.clientY - rect.top,
      id: e.pointerId
    };

    head.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  head.addEventListener('pointermove', e => {
    if (!drag || drag.id !== e.pointerId) return;

    panel.style.right = 'auto';

    panel.style.left =
      Math.max(
        0,
        Math.min(
          innerWidth - panel.offsetWidth,
          e.clientX - drag.dx
        )
      ) + 'px';

    panel.style.top =
      Math.max(
        0,
        Math.min(
          innerHeight - panel.offsetHeight,
          e.clientY - drag.dy
        )
      ) + 'px';
  });

  head.addEventListener('pointerup', () => drag = null);
  head.addEventListener('pointercancel', () => drag = null);

  function keys(e) {
    if (
      !state.keyboard ||
      !e.altKey ||
      e.ctrlKey ||
      e.metaKey ||
      e.repeat ||
      e.target.closest?.(
        'input,textarea,select,[contenteditable]'
      )
    ) {
      return;
    }

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      stop();
      nav('next');
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      stop();
      nav('previous');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      stop();
      finish();
    }
  }

  document.addEventListener('keydown', keys, true);

  state.tick = setInterval(() => {
    $('ch-alert').textContent = assessment()
      ? 'QUIZ / INTERACTION DETECTED. Auto will pause.'
      : 'CONTENT SLIDE. Quiz not currently detected.';

    speed();
  }, 1000);

  function cleanup() {
    stop();
    clearInterval(state.tick);
    document.removeEventListener('keydown', keys, true);
    panel.remove();
    delete window.__chPCStop;
  }

  $('ch-close').onclick = cleanup;
  window.__chPCStop = cleanup;

  refresh();
  speed();

  status(
    'Ready. Resize by dragging the bottom-right corner.'
  );
})();
