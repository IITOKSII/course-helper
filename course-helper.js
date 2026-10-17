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
    keyboard: false,
    lastExpandedHeight: 540,
    pendingNarration: false,
    epoch: 0,
    delays: new Set(),
    lastSlide: '',
    busy: false,
    scormState: 'Unknown',
    popupCloseIds: new Set(['62CBQWEhsiU']),
    teachCleanup: null
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
    min-height: 48px;
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
        <button id="ch-teach-close">Teach pop-up X</button>
      </details>

      <details>
        <summary>Quiz help (visible questions)</summary>
        <p>Quizzes are detected when visible. Auto pauses for questions. Review answers and submit yourself.</p>
        <button id="ch-copy">Copy visible question text</button>
        <button id="ch-suggest">Find lesson clues</button>
        <button id="ch-preview">Upcoming quizzes</button>
        <div id="ch-preview-result" role="status" style="white-space:pre-wrap;font-size:12px;margin-top:8px"></div>
        <div id="ch-clues" style="white-space:pre-wrap;font-size:12px;line-height:1.45;margin-top:8px"></div>
      </details>

      <details><summary>Completion and diagnostics</summary>
        <button id="ch-check">Check completion</button>
        <button id="ch-diagnose">Diagnostics</button>
        <div id="ch-diagnostic-result" role="status" style="white-space:pre-wrap;font-size:12px;margin-top:8px"></div>
      </details>
      <p id="ch-status" role="status" style="font-size:12px;color:#c7d5e5">
        Ready. Resize by dragging the bottom-right corner.
      </p>
    </div>
  `;


  // Scoped styles: preserve host page appearance and provide visible focus states.
  const theme = document.createElement('style');
  theme.id = 'course-helper-pc-theme';
  theme.textContent = `
    #course-helper-pc { color-scheme: dark; font-family: Inter, system-ui, -apple-system, "Segoe UI", sans-serif !important; line-height: 1.5; border-radius: 16px !important; border: 1px solid #66758a !important; box-shadow: 0 18px 48px rgba(0,0,0,.48) !important; }
    #course-helper-pc, #course-helper-pc * { box-sizing: border-box; }
    #course-helper-pc button, #course-helper-pc select { font: inherit; background: #2b384b; color: #fff; border: 1px solid #62758c; border-radius: 9px; padding: 9px 12px; min-height: 40px; cursor: pointer; transition: background .15s ease, border-color .15s ease; }
    #course-helper-pc button:hover { background: #3b4d64; }
    #course-helper-pc button:active { background: #475e79; }
    #course-helper-pc :is(button,select,input,summary):focus-visible { outline: 3px solid #7bd4fa; outline-offset: 3px; }
    #course-helper-pc #ch-head { background: #202d41 !important; border-bottom: 1px solid #46586d; height: 48px; }
    #course-helper-pc #ch-auto { background: #1b6a63; border-color: #65c7ba; }
    #course-helper-pc #ch-auto:hover { background: #247e75; }
    #course-helper-pc #ch-paragraph { background: #34577e; border-color: #8ab4e2; }
    #course-helper-pc #ch-alert { font-weight: 650; letter-spacing: .01em; }
    #course-helper-pc details { background: #202a39; border: 1px solid #465467; border-radius: 10px; padding: 12px; margin: 12px 0; }
    #course-helper-pc summary { cursor: pointer; padding: 4px 0; font-weight: 650; }
    #course-helper-pc input[type="range"] { accent-color: #7bd4fa; min-height: 28px; }
    #course-helper-pc input[type="checkbox"] { accent-color: #7bd4fa; width: 17px; height: 17px; vertical-align: middle; }
    #course-helper-pc #ch-status { padding: 10px; border-radius: 9px; background: #263449; color: #f0f6ff !important; font-size: 13px !important; }
    #course-helper-pc #ch-text { font-size: 14px; line-height: 1.65 !important; }
    #course-helper-pc #ch-head button { min-width: 38px; min-height: 32px; padding: 3px 9px; }
    @media (prefers-reduced-motion: reduce) { #course-helper-pc button { transition: none; } }
  `;
  document.head.appendChild(theme);
  panel.setAttribute('aria-label', 'Course Helper');
  panel.setAttribute('role', 'region');
  panel.querySelector('#ch-min').setAttribute('aria-label', 'Minimize or restore Course Helper');
  panel.querySelector('#ch-close').setAttribute('aria-label', 'Close Course Helper');
  panel.querySelector('#ch-rate').setAttribute('aria-label', 'Reading speed in words per minute');
  panel.querySelector('#ch-speed').setAttribute('aria-label', 'Media playback speed');
  panel.querySelector('#ch-alert').setAttribute('aria-live', 'polite');
  panel.querySelector('#ch-status').setAttribute('aria-live', 'polite');
  // Distinct navigation controls are easier to identify at a glance.
  panel.querySelector('#ch-next').title = 'Advance to the next slide when available';
  panel.querySelector('#ch-paragraph').title = 'Finish the current accessible narration';

  document.body.append(panel);

  const $ = id => panel.querySelector('#' + id);

  const later = (fn, ms) => { const id = setTimeout(() => { state.delays.delete(id); if (panel.isConnected) fn(); }, ms); state.delays.add(id); return id; };

  const docs = () => {
    const out = [];
    const visit = doc => {
      if (!doc || out.includes(doc)) return;
      out.push(doc);
      for (const frame of doc.querySelectorAll('iframe,frame')) {
        try { visit(frame.contentDocument); } catch {}
      }
    };
    visit(document);
    return out;
  };

  const visible = el => {
    if (panel.contains(el) || !el.getClientRects().length) return false;
    const view = el.ownerDocument.defaultView;
    if (!view || view.getComputedStyle(el).visibility === 'hidden') return false;
    try {
      const frame = view.frameElement;
      if (frame && !visible(frame)) return false;
    } catch {}
    return true;
  };

  const label = el =>
    (
      el.getAttribute('aria-label') ||
      el.getAttribute('title') ||
      el.getAttribute('data-tooltip') ||
      el.innerText ||
      el.textContent ||
      el.value ||
      ''
    ).trim().toLowerCase();

  function assessment() {
    for (const doc of docs()) {
      const quizText = [...doc.querySelectorAll('main, article, [role=main], .slide, .question, .quiz')]
        .filter(el => visible(el) && !panel.contains(el))
        .map(el => el.innerText || '').join(' ').slice(0,18000).toLowerCase();

      const answerInputs = [...doc.querySelectorAll('input[type=radio],input[type=checkbox],[role=radio],[role=checkbox]')].some(visible);
      const actionButtons = [...doc.querySelectorAll('button,[role=button],input[type=submit]')]
        .filter(visible).some(el => /^(submit|check answer|try again|show answer|submit answer)/i.test(label(el)));
      const questionPhrases = /(select the correct|which of the following|choose the correct|true or false|submit answer|check answer)/.test(quizText);
      // Labels and course-menu mentions alone do not block progress.
      if (answerInputs || actionButtons || questionPhrases) return true;
    }

    return false;
  }

  function readCompletion() {
    // Read-only status; do not manipulate SCORM progress.
    const lines = [];
    const seen = new Set();
    let current = window;
    for (let depth = 0; depth < 6 && current; depth++) {
      try {
        for (const key of ['API_1484_11', 'API']) {
          const api = current[key];
          if (!api || seen.has(api)) continue;
          seen.add(api);
          try {
            if (key === 'API_1484_11' && typeof api.GetValue === 'function') {
              lines.push('SCORM 2004 completion: ' + (api.GetValue('cmi.completion_status') || 'unknown'));
              lines.push('SCORM 2004 success: ' + (api.GetValue('cmi.success_status') || 'unknown'));
            } else if (key === 'API' && typeof api.LMSGetValue === 'function') {
              lines.push('SCORM 1.2 lesson status: ' + (api.LMSGetValue('cmi.core.lesson_status') || 'unknown'));
            }
          } catch { lines.push('SCORM API located but status was inaccessible'); }
        }
        if (current.parent === current) break;
        current = current.parent;
      } catch { break; }
    }
    const visibleStatus = docs().flatMap(d => [...d.querySelectorAll('[role=status],.completion-status,.course-status')])
      .filter(visible).map(el => (el.innerText || '').trim()).filter(Boolean).slice(0,5);
    if (visibleStatus.length) lines.push('Visible status: ' + visibleStatus.join(' | ').slice(0,350));
    if (!lines.length) lines.push('No accessible completion status. Verify in the learner dashboard.');
    return lines.join('\n');
  }

  function upcomingQuiz() {
    const results = [];
    for (const doc of docs()) {
      for (const el of doc.querySelectorAll('nav a,aside a,[role=navigation] a,.toc li,.menu li')) {
        if (!visible(el)) continue;
        const t = (el.innerText || '').trim();
        if (t.length < 160 && /(quiz|knowledge check|assessment|test)/i.test(t)) results.push(t);
      }
    }
    return [...new Set(results)].slice(0,6);
  }

  function diagnose() {
    return [
      'Helper: timeline-wait build 2026-10-17.5',
      'Accessible documents: ' + docs().length,
      'Media found: ' + media().length,
      ...media().map(m => 'Media: ' + m.tagName + ' time=' + m.currentTime + '/' + m.duration + ' paused=' + m.paused + ' ended=' + m.ended),
      'Navigation controls: ' + docs().flatMap(d => [...d.querySelectorAll('button,a,[role=button],#next,#next-btn')]).filter(visible).filter(e => /next|continue|prev/i.test(label(e) + ' ' + e.id)).map(e => JSON.stringify({label:label(e),id:e.id,disabled:!!e.disabled,ariaDisabled:e.getAttribute('aria-disabled')})).slice(0,12).join(' | '),
      'Words shown: ' + refresh(),
      'Quiz or interaction: ' + (assessment() ? 'possibly detected' : 'not detected'),
      'Slide signature: ' + (slideSignature() ? 'available' : 'not available'),
      readCompletion()
    ].join('\n');
  }

  function status(message) {
    $('ch-status').textContent = message;
  }

  function refresh() {
    const chunks = [];

    for (const doc of docs()) {
      for (const el of doc.querySelectorAll('main p,article p,[role=main] p,.slide p,h1,h2,h3,.slide-object-text,.slide-object-textbox')) {
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

  function slideSignature() {
    return docs().map(doc => [...doc.querySelectorAll('main,article,[role=main],.slide,.slide-object-text,.slide-object-textbox')]
      .filter(visible).map(el => (el.innerText || '').trim().slice(0,800)).join('|')).join('||');
  }

  function media() {
    return docs()
      .flatMap(d => [...d.querySelectorAll('audio,video')])
      .filter(m => !panel.contains(m));
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

    if (count) state.pendingNarration = true;
    status(
      count
        ? `Finished ${count} media segment(s).`
        : 'No accessible media timeline. Use the platform controls.'
    );

    later(refresh, 450);
    return count > 0;
  }

  function controlDisabled(el) {
    return !!el.disabled || el.getAttribute('disabled') !== null ||
      el.getAttribute('aria-disabled') === 'true' ||
      !!el.closest('[aria-disabled="true"],.disabled,.is-disabled,.cs-disabled');
  }
  function timelinePending() {
    for (const doc of docs()) {
      for (const el of doc.querySelectorAll('[role="slider"],[role="progressbar"],input[type="range"]')) {
        if (!visible(el)) continue;
        const name = [el.id, label(el), el.className].join(' ');
        if (!/seek|timeline|progress|scrub/i.test(name) || /volume/i.test(name)) continue;
        const rawValue = el.getAttribute('aria-valuenow') ?? (el.tagName === 'INPUT' ? el.value : null);
        const rawMax = el.getAttribute('aria-valuemax') ?? (el.tagName === 'INPUT' ? el.max : null);
        if (rawValue === null || rawMax === null || rawMax === '') continue;
        const value = Number(rawValue), max = Number(rawMax);
        if (Number.isFinite(value) && max > 0 && value < max - Math.max(0.01, max * 0.001)) return true;
      }
    }
    return false;
  }

  function nav(dir) {
    if (assessment()) {
      stop('Question or interaction detected. Complete it manually.');
      return false;
    }
    const terms = dir === 'next' ? ['next','continue','next slide'] : ['back','previous','previous slide'];
    const candidates = [];
    for (const doc of docs()) {
      for (const el of doc.querySelectorAll('button,a,[role="button"],input[type="button"],#next,#prev,#next-btn,#prev-btn,[data-action="next"],[data-action="previous"]')) {
        if (!visible(el) || controlDisabled(el)) continue;
        const name = label(el);
        const controlId = (el.id || '').toLowerCase();
        const known = dir === 'next' ? /^(next|next-btn|next-button|next_slide)$/ : /^(prev|previous|prev-btn|previous-button)$/;
        const normalized = name.replace(/[▶►◀◄→←]/g, '').trim();
        if (!known.test(controlId) && !terms.some(t => normalized === t || normalized.startsWith(t + ' ') || normalized.startsWith(t + ' ('))) continue;
        const context = el.closest('main,article,[role=main],.slide,.content,.player');
        candidates.push({el, score: (context ? 10 : 0) + (name === terms[0] ? 2 : 0)});
      }
    }
    candidates.sort((a,b)=>b.score-a.score);
    if (!candidates.length) {
      status('No available ' + dir + ' control. Use course navigation.');
      return false;
    }
    if (candidates.length > 1 && candidates[0].score === candidates[1].score) {
      status('Several navigation buttons found. Use the course Next/Back control to avoid the wrong action.');
      return false;
    }
    const before = slideSignature();
    candidates[0].el.click();
    state.pendingNarration = false;
    later(() => {
      refresh();
      if (before && slideSignature() === before) {
        status('Navigation attempted but slide change not confirmed. Check course page.');
        if (state.auto) stop('Auto paused: the course did not confirm a slide change. Open Diagnostics.');
      } else {
        status('Slide content changed. Check LMS progress separately.');
      }
    }, 2500);
    return true;
  }

  function stop(reason) {
    state.auto = false;
    clearTimeout(state.timer);
    state.epoch++;

    $('ch-auto').textContent = 'Start auto';

    if (reason) {
      status(reason);
    }
  }

  // Verified from the user's Chapter 02, slide 20 DOM. Keep this mapping
  // scoped to this exact activity; generic Rectangle labels are not enough.
  const screeningInfoIds = [
    '5Yf4v0ZEHzB', '60IE5Judeh1', '6iTVaNjoxjp', '5bYJcTGpH9B',
    '6qlRbDy2a3S', '5gNe0ZiHI6a', '5YT3xfkofN0', '5aywoV9m4Fk',
    '5lhh9PFHrxy', '6nW3CBlmFjW', '6IMFvZXbiYL'
  ];
  function lessonControl(doc, id) {
    const visual = [...doc.querySelectorAll('[data-model-id="' + id + '"]')]
      .filter(visible);
    return visual.find(e => e.classList.contains('slide-object-stategroup')) ||
      visual[0] || [...doc.querySelectorAll('[id="acc-' + id + '"]')].find(visible);
  }
  function clickLessonControl(el) {
    // Storyline attaches click handling to rendered SVG shapes as well as groups.
    const target = el.querySelector('.eventable') || el;
    target.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent('click', {
      bubbles: true, cancelable: true, view: el.ownerDocument.defaultView
    }));
  }
  function createInfoSequence() {
    // Discover rendered click-information icons, never arbitrary rectangles.
    let doc = null;
    let infoIds = [];
    for (const candidate of docs()) {
      const ids = [...candidate.querySelectorAll('[data-acc-text]')]
        .filter(e => visible(e) && /^(click\s*icon|info(?:rmation)?(?:\s*icon)?)(?:\s+\d+)?$/i.test(e.getAttribute('data-acc-text').trim()))
        .map(e => e.closest('.slide-object-stategroup[data-model-id]') || e.closest('[data-model-id]'))
        .filter(Boolean).map(e => e.getAttribute('data-model-id'));
      const unique = [...new Set(ids)];
      if (unique.length) { doc = candidate; infoIds = unique; break; }
    }
    if (!doc) {
      doc = docs().find(d => screeningInfoIds.every(id => lessonControl(d, id)));
      if (doc) infoIds = screeningInfoIds;
    }
    if (!doc) return null;
    let index = 0;
    let phase = 'open';
    let deadline = 0;
    let beforeText = new Set();
    const findClose = () => {
      for (const id of state.popupCloseIds) { const el = lessonControl(doc, id); if (el) return el; }
      return [...doc.querySelectorAll('button,[role=button],[data-acc-text]')].filter(visible).find(e => /^(close(?:\s+(?:window|popup|pop-up|dialog|layer))?|[×✕✖])$/i.test(e.getAttribute('data-acc-text') || label(e)));
    };
    const textLines = () => [...doc.querySelectorAll('.slide-object')]
      .filter(visible).map(e => (e.innerText || e.textContent || '').trim())
      .filter(t => t.length > 25 && t.length < 12000);
    return () => {
      const now = Date.now();
      const close = findClose();
      if (phase === 'done') return false;
      if (phase === 'open') {
        if (index >= infoIds.length) { phase = 'done'; return false; }
        if (!close) {
          const button = lessonControl(doc, infoIds[index]);
          if (!button) { stop('Information button disappeared. Check the course slide.'); return true; }
          beforeText = new Set(textLines());
          clickLessonControl(button);
        }
        phase = 'wait-open';
        deadline = now + 10000;
        status('Auto: opening information ' + (index + 1) + '/' + infoIds.length + '…');
        return true;
      }
      if (phase === 'wait-open') {
        if (!close) {
          if (now > deadline) stop('Pop-up close control not recognised. With it open, click Teach pop-up X, then its X. Restart Auto.');
          return true;
        }
        const text = [...new Set(textLines().filter(t => !beforeText.has(t)))].join(' ');
        const words = text.split(/\s+/).filter(Boolean).length;
        deadline = now + Math.max(8000, Math.ceil(words / state.wpm * 60000));
        phase = 'read';
        $('ch-text').textContent = text || 'Information pop-up open. Allowing reading time.';
        return true;
      }
      if (phase === 'read') {
        if (!close) { stop('Pop-up closed before Auto finished. Restart Auto to continue.'); return true; }
        status('Auto: information ' + (index + 1) + '/' + infoIds.length + '; ' + Math.max(0, Math.ceil((deadline - now) / 1000)) + 's to read.');
        if (now >= deadline) {
          clickLessonControl(close);
          phase = 'wait-close';
          deadline = now + 5000;
        }
        return true;
      }
      if (phase === 'wait-close') {
        if (close) {
          if (now > deadline) stop('Pop-up X did not close the information. Close it manually.');
          return true;
        }
        index++;
        phase = 'open';
        return true;
      }
      return true;
    };
  }

  function cycle() {
    if (!state.auto) return;
    const epoch = state.epoch;
    let signature = slideSignature();
    let started = Date.now();
    let observedMedia = new Set();
    let nextWaitStarted = null;
    let infoSequence = null;

    const check = () => {
      if (!state.auto || epoch !== state.epoch) return;
      if (assessment()) {
        stop('Quiz or interaction detected. Complete it manually.');
        return;
      }
      if (!infoSequence) infoSequence = createInfoSequence();
      if (infoSequence && infoSequence()) {
        if (state.auto) state.timer = setTimeout(check, 500);
        return;
      }
      const current = slideSignature();
      if (current !== signature) {
        signature = current;
        // Animated captions change text without starting a new slide.
        // Reset only when an actual navigation cycle begins.
        if (nextWaitStarted !== null) nextWaitStarted = null;
      }
      const words = refresh();
      // Visible video and playing/previously played audio belong to the active
      // slide. Do not wait for hidden, untouched media from other slides.
      const tracks = media().filter(m =>
        visible(m) || (!m.paused && !m.ended) ||
        (m.currentTime > 0 && !m.ended) || observedMedia.has(m)
      );
      tracks.forEach(m => observedMedia.add(m));
      const readingMs = Math.max(3000, Math.ceil(words / state.wpm * 60000));
      const elapsed = Date.now() - started;
      if (tracks.length) {
        if (!tracks.every(m => m.ended || (Number.isFinite(m.duration) && m.duration > 0 && m.currentTime >= m.duration - 0.15))) {
          status('Auto: waiting for slide media to finish. Play it if paused.');
          state.timer = setTimeout(check, 500);
          return;
        }
        // Give the course time to enable Next after its media-ended handler.
        if (elapsed < 1000) {
          state.timer = setTimeout(check, 500);
          return;
        }
      } else if (!words && elapsed < 3000) {
        status('Auto: waiting for slide content to load…');
        state.timer = setTimeout(check, 500);
        return;
      } else if (elapsed < readingMs) {
        status('Auto: reading slide; ' + Math.ceil((readingMs - elapsed) / 1000) + 's remaining.');
        state.timer = setTimeout(check, 500);
        return;
      }
      if (timelinePending()) {
        status('Auto: waiting for the course timeline to finish.');
        state.timer = setTimeout(check, 500);
        return;
      }
      if (nav('next')) {
        state.timer = setTimeout(cycle, 2800);
      } else {
        // Storyline may lock Next for the entire timeline. Keep Auto armed
        // until the real course control unlocks or the user pauses/closes.
        status('Auto: waiting for the course Next button to unlock. Pause auto to stop.');
        state.timer = setTimeout(check, 500);
      }
    };
    check();
  }

  $('ch-prev').onclick = () => {
    stop();
    state.pendingNarration = false;
    nav('previous');
  };

  $('ch-paragraph').onclick = () => {
    stop();
    finish();
  };

  $('ch-next').onclick = () => {
    stop();
    if (assessment()) return status('Quiz or interaction detected. Complete it manually.');
    if (state.pendingNarration) {
      state.pendingNarration = false;
      nav('next');
    } else if (!finish()) nav('next');
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
  $('ch-teach-close').onclick = () => {
    stop();
    if (state.teachCleanup) state.teachCleanup();
    const targets = docs();
    const capture = e => {
      if (panel.contains(e.target)) return;
      const el = e.target.closest('[data-model-id],button,[role=button]');
      const id = el?.getAttribute('data-model-id');
      if (!id) { status('No course object ID found. Click the pop-up X itself.'); return; }
      state.popupCloseIds.add(id);
      state.teachCleanup();
      status('Pop-up X learned for this session. Click Start auto to continue.');
    };
    state.teachCleanup = () => { targets.forEach(d => d.removeEventListener('click', capture, true)); state.teachCleanup = null; };
    targets.forEach(d => d.addEventListener('click', capture, true));
    status('Now click the X on the open course information pop-up.');
  };


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

  $('ch-preview').onclick = () => {
    const hits = upcomingQuiz();
    $('ch-preview-result').textContent = hits.length
      ? 'Possible quizzes in visible navigation:\n• ' + hits.join('\n• ')
      : 'No upcoming quiz visible in accessible course navigation; not a guarantee.';
  };
  $('ch-check').onclick = () => { $('ch-diagnostic-result').textContent = readCompletion(); };
  $('ch-diagnose').onclick = () => { $('ch-diagnostic-result').textContent = diagnose(); };

  $('ch-suggest').onclick = () => {
    const text = docs().map(d => d.body?.innerText || '').join('\n');
    const lines = text.split('\n').map(x=>x.trim()).filter(x=>x.length>20 && x.length<500);
    const hints = lines.filter(x => /(because|therefore|means|defined|refers to|is the|are the|important|remember|correct)/i.test(x)).slice(0,12);
    $('ch-clues').textContent = hints.length ? 'Possible lesson clues (not verified answers):\n• ' + hints.join('\n• ') : 'No answer clues found in visible lesson text. Use Copy visible question text to research the answer.';
  };

  $('ch-copy').onclick = async () => {
    let text = docs().flatMap(d => [...d.querySelectorAll('main,article,[role=main],.slide,.question')].filter(visible).map(e => e.innerText || '')).join('\n').slice(0,15000);

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
    if (!minimized) {
      state.lastExpandedHeight = panel.getBoundingClientRect().height;
    }
    minimized = !minimized;
    $('ch-body').style.display = minimized ? 'none' : 'block';
    panel.style.resize = minimized ? 'none' : 'both';
    panel.style.height = minimized
      ? '48px'
      : Math.min(state.lastExpandedHeight, innerHeight * 0.9) + 'px';
    $('ch-min').textContent = minimized ? '□' : '−';
    $('ch-min').title = minimized ? 'Restore panel' : 'Minimize panel';
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
      $('ch-next').click();
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
    if (state.teachCleanup) state.teachCleanup();
    state.pendingNarration = false;
    clearInterval(state.tick);
    for (const id of state.delays) clearTimeout(id);
    state.delays.clear();
    document.removeEventListener('keydown', keys, true);
    panel.remove();
    document.getElementById('course-helper-pc-theme')?.remove();
    delete window.__chPCStop;
  }

  $('ch-close').onclick = cleanup;
  window.__chPCStop = cleanup;

  refresh();
  speed();

  status('Ready · build 17.5. Auto waits for timeline and Next unlock.');
})();
