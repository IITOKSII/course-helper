(() => {
  "use strict";

  const PANEL_ID = "course-helper-panel";

  if (typeof window.__courseHelperDestroy === "function") {
    try {
      window.__courseHelperDestroy();
    } catch {}
  }

  document.getElementById(PANEL_ID)?.remove();

  const state = {
    speed: 3,
    auto: false,
    processing: false,
    minimized: false,
    savedWidth: Math.min(430, Math.max(310, window.innerWidth - 20)),
    savedHeight: Math.min(580, Math.max(430, window.innerHeight - 20)),
    wordsPerMinute: 400,
    minimumSeconds: 3,
    maximumSeconds: 25,
    questionClips: []
  };

  const timers = {
    speed: null,
    auto: null,
    observer: null
  };

  let panel;

  function cleanText(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function getAllDocs() {
    const docs = [document];
    const seen = new Set(docs);

    function scan(doc) {
      let frames = [];

      try {
        frames = [...doc.querySelectorAll("iframe")];
      } catch {
        return;
      }

      for (const frame of frames) {
        try {
          const child = frame.contentDocument;

          if (child && !seen.has(child)) {
            seen.add(child);
            docs.push(child);
            scan(child);
          }
        } catch {}
      }
    }

    scan(document);
    return docs;
  }

  function isInsideHelper(el) {
    try {
      return !!el.closest(`#${PANEL_ID}`);
    } catch {
      return false;
    }
  }

  function isVisible(el, doc) {
    if (!el || isInsideHelper(el)) return false;

    try {
      const view = doc.defaultView || window;
      const style = view.getComputedStyle(el);

      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        Number(style.opacity || 1) === 0
      ) {
        return false;
      }

      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    } catch {
      return true;
    }
  }

  function setStatus(message, type = "normal") {
    const box = panel?.querySelector("#ch-status");
    if (!box) return;

    const colours = {
      normal: "#8fd3ff",
      good: "#86efac",
      warn: "#ffd166",
      bad: "#ff9090"
    };

    box.textContent = message;
    box.style.color = colours[type] || colours.normal;
  }

  function applySpeed() {
    let found = 0;

    for (const doc of getAllDocs()) {
      try {
        doc.querySelectorAll("audio,video").forEach(media => {
          if (isInsideHelper(media)) return;

          try {
            media.playbackRate = state.speed;
            media.defaultPlaybackRate = state.speed;
            found++;
          } catch {}
        });
      } catch {}
    }

    return found;
  }

  function setSpeed(speed) {
    state.speed = Number(speed);
    const found = applySpeed();

    panel.querySelectorAll("[data-speed]").forEach(button => {
      const active = Number(button.dataset.speed) === state.speed;
      button.style.background = active ? "#315978" : "#303030";
      button.style.borderColor = active ? "#8fd3ff" : "#666";
    });

    setStatus(
      found
        ? `Course speed: ${state.speed}×`
        : `Speed set to ${state.speed}×. Waiting for course media.`,
      "good"
    );
  }

  function ignoredText(text) {
    return [
      "home",
      "menu",
      "exit",
      "next",
      "previous",
      "back",
      "play",
      "pause",
      "volume",
      "mute",
      "unmute",
      "course helper",
      "copy questions",
      "copy all"
    ].includes(cleanText(text).toLowerCase());
  }

  function extractVisibleText(options = {}) {
    const mode = options.mode || "slide";
    const collected = [];

    const selectors =
      mode === "questions"
        ? [
            "legend",
            "label",
            "p",
            "li",
            "h1",
            "h2",
            "h3",
            "h4",
            "h5",
            "h6",
            '[role="heading"]',
            '[role="radiogroup"]',
            '[role="group"]',
            '[aria-live]',
            "span",
            "div"
          ].join(",")
        : [
            "p",
            "li",
            "h1",
            "h2",
            "h3",
            "h4",
            "h5",
            "h6",
            '[role="heading"]',
            "span",
            "div"
          ].join(",");

    for (const doc of getAllDocs()) {
      let elements = [];

      try {
        elements = [...doc.querySelectorAll(selectors)];
      } catch {
        continue;
      }

      for (const el of elements) {
        if (!isVisible(el, doc)) continue;
        if (["SCRIPT", "STYLE", "NOSCRIPT"].includes(el.tagName)) continue;

        let visibleChildren = 0;

        try {
          for (const child of el.children) {
            if (isVisible(child, doc) && cleanText(child.innerText).length > 0) {
              visibleChildren++;
            }
          }
        } catch {}

        if (
          visibleChildren > (mode === "questions" ? 4 : 2) &&
          el.tagName !== "LI"
        ) {
          continue;
        }

        const text = cleanText(el.innerText || el.textContent);

        if (text.length < 3) continue;
        if (text.length > (mode === "questions" ? 2400 : 1800)) continue;
        if (ignoredText(text)) continue;

        collected.push(text);
      }
    }

    const unique = [];

    for (const text of collected) {
      const alreadyIncluded = unique.some(existing => {
        if (existing === text) return true;
        if (existing.length > 80 && existing.includes(text)) return true;
        if (text.length > 80 && text.includes(existing)) return true;
        return false;
      });

      if (!alreadyIncluded) unique.push(text);
    }

    return unique;
  }

  function showSlideText() {
    const area = panel.querySelector("#ch-text");
    const paragraphs = extractVisibleText({ mode: "slide" });

    area.textContent = "";

    if (!paragraphs.length) {
      const empty = document.createElement("div");
      empty.textContent = "No readable slide text detected.";
      empty.style.color = "#aaa";
      area.appendChild(empty);
      return 0;
    }

    for (const text of paragraphs) {
      const block = document.createElement("div");
      block.textContent = text;

      Object.assign(block.style, {
        padding: "9px",
        marginBottom: "7px",
        border: "1px solid #444",
        borderRadius: "6px",
        background: "#202020",
        color: "#fff",
        lineHeight: "1.45",
        whiteSpace: "pre-wrap"
      });

      area.appendChild(block);
    }

    return paragraphs.join(" ").split(/\s+/).filter(Boolean).length;
  }

  function getAssessmentSignals() {
    const phraseSignals = [
      "knowledge check",
      "knowledge quiz",
      "select the correct",
      "select an answer",
      "select your answer",
      "choose the correct",
      "choose an answer",
      "which of the following",
      "true or false",
      "submit answer",
      "check answer",
      "try again",
      "correct answer",
      "incorrect answer",
      "assessment",
      "quiz"
    ];

    const reasons = [];
    const visibleText = extractVisibleText({
      mode: "questions"
    })
      .join("\n")
      .toLowerCase();

    for (const phrase of phraseSignals) {
      if (visibleText.includes(phrase)) {
        reasons.push(phrase);
        break;
      }
    }

    for (const doc of getAllDocs()) {
      try {
        const answerControls = [
          ...doc.querySelectorAll(
            'input[type="radio"],input[type="checkbox"],[role="radio"],[role="checkbox"]'
          )
        ].filter(el => isVisible(el, doc));

        if (answerControls.length) {
          reasons.push("answer controls");
        }

        const buttons = [
          ...doc.querySelectorAll(
            'button,[role="button"],input[type="submit"],a'
          )
        ];

        for (const button of buttons) {
          if (!isVisible(button, doc)) continue;

          const label = cleanText(
            button.innerText ||
              button.value ||
              button.getAttribute("aria-label") ||
              button.textContent
          ).toLowerCase();

          if (
            label.includes("submit") ||
            label.includes("check answer") ||
            label.includes("try again")
          ) {
            reasons.push(label);
            break;
          }
        }
      } catch {}
    }

    return {
      blocked: reasons.length > 0,
      reasons: [...new Set(reasons)]
    };
  }

  function updateSafety() {
    const result = getAssessmentSignals();
    const box = panel.querySelector("#ch-safety");

    if (result.blocked) {
      box.textContent = "⚠ QUIZ / INTERACTION DETECTED";
      box.style.background = "#563a20";
      box.style.color = "#ffd166";
    } else {
      box.textContent = "✓ CONTENT SLIDE";
      box.style.background = "#203a29";
      box.style.color = "#86efac";
    }

    return result;
  }

  function getMediaSnapshot() {
    const items = [];

    for (const doc of getAllDocs()) {
      try {
        doc.querySelectorAll("audio,video").forEach(media => {
          if (isInsideHelper(media)) return;

          items.push({
            element: media,
            src: media.currentSrc || media.src || "",
            currentTime: media.currentTime || 0,
            duration: media.duration || 0,
            paused: media.paused,
            ended: media.ended
          });
        });
      } catch {}
    }

    return items;
  }

  function getActiveNarration() {
    const active = [];

    for (const doc of getAllDocs()) {
      try {
        doc.querySelectorAll("audio,video").forEach(media => {
          if (isInsideHelper(media)) return;

          try {
            if (
              Number.isFinite(media.duration) &&
              media.duration > 0.2 &&
              !media.ended &&
              media.currentTime < media.duration - 0.12
            ) {
              active.push(media);
            }
          } catch {}
        });
      } catch {}
    }

    return active;
  }

  function finishNarration(mediaItems = getActiveNarration()) {
    let count = 0;

    for (const media of mediaItems) {
      try {
        if (Number.isFinite(media.duration) && media.duration > 0) {
          media.currentTime = Math.max(0, media.duration - 0.03);
          count++;
        }
      } catch {}
    }

    return count;
  }

  function newNarrationStarted(before) {
    const current = getMediaSnapshot();

    for (const now of current) {
      const old = before.find(item => item.element === now.element);

      if (!old) {
        if (!now.paused && !now.ended && now.duration > 0) return true;
        continue;
      }

      if (now.src && old.src && now.src !== old.src) return true;

      if (
        old.duration > 0 &&
        old.currentTime > old.duration - 0.5 &&
        now.currentTime < 1.5 &&
        !now.paused &&
        !now.ended
      ) {
        return true;
      }
    }

    return false;
  }

  function isDisabled(el) {
    return (
      !!el.disabled ||
      el.getAttribute("aria-disabled") === "true" ||
      el.getAttribute("disabled") !== null ||
      /\bdisabled\b/i.test(el.className || "")
    );
  }

  function findNavigationButton(direction) {
    const next = direction === "next";

    const selectors = next
      ? [
          '[aria-label="Next"]',
          '[aria-label*="next" i]',
          '[title*="next" i]',
          'button[class*="next" i]',
          '[class*="next-button" i]',
          "#next",
          ".next"
        ]
      : [
          '[aria-label="Previous"]',
          '[aria-label*="previous" i]',
          '[aria-label*="back" i]',
          '[title*="previous" i]',
          'button[class*="prev" i]',
          '[class*="previous" i]',
          "#previous",
          ".previous"
        ];

    for (const doc of getAllDocs()) {
      for (const selector of selectors) {
        try {
          for (const el of doc.querySelectorAll(selector)) {
            if (isVisible(el, doc) && !isDisabled(el)) return el;
          }
        } catch {}
      }

      try {
        for (const el of doc.querySelectorAll('button,[role="button"],a')) {
          if (!isVisible(el, doc) || isDisabled(el)) continue;

          const text = cleanText(
            el.innerText ||
              el.getAttribute("aria-label") ||
              el.textContent
          ).toLowerCase();

          if (next && ["next", "continue", "next slide"].includes(text)) {
            return el;
          }

          if (
            !next &&
            ["back", "previous", "previous slide"].includes(text)
          ) {
            return el;
          }
        }
      } catch {}
    }

    return null;
  }

  function readingDelay(words) {
    const seconds = Math.max(
      state.minimumSeconds,
      Math.min(
        state.maximumSeconds,
        (words / state.wordsPerMinute) * 60
      )
    );

    return Math.round(seconds);
  }

  function updateAutoButton() {
    const button = panel.querySelector("#ch-auto");
    button.textContent = state.auto ? "⏸ PAUSE AUTO" : "▶ AUTO START";
    button.style.background = state.auto ? "#754b20" : "#24563a";
    button.style.borderColor = state.auto ? "#ffd166" : "#86efac";
  }

  function stopAuto(reason = "") {
    state.auto = false;
    state.processing = false;

    if (timers.auto) {
      clearTimeout(timers.auto);
      timers.auto = null;
    }

    updateAutoButton();

    if (reason) setStatus(reason, "warn");
  }

  async function processCurrentSlide() {
    if (!state.auto || state.processing) return;

    state.processing = true;
    applySpeed();
    await sleep(700);

    if (!state.auto) {
      state.processing = false;
      return;
    }

    let check = updateSafety();

    if (check.blocked) {
      stopAuto(
        "Auto paused because a quiz or interaction was detected."
      );
      return;
    }

    const words = showSlideText();
    const seconds = readingDelay(words);

    setStatus(
      words
        ? `${words} words shown. Moving on in about ${seconds}s.`
        : `No text detected. Moving on in about ${seconds}s.`,
      "good"
    );

    await new Promise(resolve => {
      timers.auto = setTimeout(resolve, seconds * 1000);
    });

    if (!state.auto) {
      state.processing = false;
      return;
    }

    check = updateSafety();

    if (check.blocked) {
      stopAuto("Auto paused because an interaction appeared.");
      return;
    }

    finishNarration();
    await sleep(800);

    if (!state.auto) {
      state.processing = false;
      return;
    }

    check = updateSafety();

    if (check.blocked) {
      stopAuto(
        "Auto paused because a quiz or interaction appeared at the end of the slide."
      );
      return;
    }

    const next = findNavigationButton("next");

    if (!next) {
      stopAuto(
        "Auto paused because the course Next button is not available."
      );
      return;
    }

    try {
      next.click();
      setStatus("Moving to next slide...", "good");
    } catch {
      stopAuto("Auto paused because Next could not be clicked.");
      return;
    }

    state.processing = false;
    timers.auto = setTimeout(processCurrentSlide, 1100);
  }

  function toggleAuto() {
    if (state.auto) {
      stopAuto("Auto paused.");
      return;
    }

    const check = updateSafety();

    if (check.blocked) {
      setStatus(
        "Auto cannot start while a quiz or interaction is visible.",
        "warn"
      );
      return;
    }

    state.auto = true;
    state.processing = false;
    updateAutoButton();
    setStatus("Auto mode started.", "good");
    processCurrentSlide();
  }

  async function manualNext() {
    stopAuto();

    let check = updateSafety();

    if (check.blocked) {
      setStatus(
        "Quiz / interaction detected. Complete it before continuing.",
        "warn"
      );
      return;
    }

    const activeMedia = getActiveNarration();

    if (activeMedia.length) {
      const before = getMediaSnapshot();
      finishNarration(activeMedia);
      setStatus("Finishing current narration...", "good");
      await sleep(350);

      check = updateSafety();

      if (check.blocked) {
        setStatus("Interaction appeared. Stopped here.", "warn");
        showSlideText();
        return;
      }

      for (let i = 0; i < 10; i++) {
        await sleep(120);

        if (newNarrationStarted(before)) {
          applySpeed();
          showSlideText();
          setStatus("Next paragraph / narration started.", "good");
          return;
        }

        check = updateSafety();

        if (check.blocked) {
          setStatus("Interaction appeared. Stopped here.", "warn");
          showSlideText();
          return;
        }
      }

      applySpeed();
      showSlideText();

      setStatus(
        "Narration finished. Press Next again to move to the next slide.",
        "good"
      );

      return;
    }

    const next = findNavigationButton("next");

    if (!next) {
      setStatus("Course Next button is not available yet.", "warn");
      return;
    }

    try {
      next.click();
      setStatus("Moving to next slide...", "good");
      await sleep(850);
      applySpeed();
      showSlideText();
      updateSafety();
    } catch {
      setStatus("Could not click the course Next button.", "bad");
    }
  }

  async function manualBack() {
    stopAuto();

    const back = findNavigationButton("previous");

    if (!back) {
      setStatus("Previous button not available.", "warn");
      return;
    }

    try {
      back.click();
      setStatus("Previous.", "good");
      await sleep(850);
      applySpeed();
      showSlideText();
      updateSafety();
    } catch {
      setStatus("Could not click Previous.", "bad");
    }
  }

  function finishCurrentSlide() {
    const check = updateSafety();

    if (check.blocked) {
      setStatus(
        "Finish blocked because a quiz or interaction is visible.",
        "warn"
      );
      return;
    }

    const count = finishNarration();

    setStatus(
      count
        ? "Current narration finished."
        : "No normal audio/video timeline found.",
      count ? "good" : "warn"
    );

    setTimeout(() => {
      updateSafety();
      showSlideText();
    }, 700);
  }

  function formatQuestionsForCopy(items) {
    const stamp = new Date().toLocaleString();

    return [
      `Course Helper questions - ${stamp}`,
      "",
      ...items
    ].join("\n\n");
  }

  function getQuestionText() {
    const visible = extractVisibleText({ mode: "questions" });
    const safety = getAssessmentSignals();

    let selected = visible;

    if (safety.blocked) {
      selected = visible.filter(text => {
        const lower = text.toLowerCase();

        return (
          lower.includes("?") ||
          lower.includes("select") ||
          lower.includes("choose") ||
          lower.includes("which of the following") ||
          lower.includes("true or false") ||
          lower.includes("submit") ||
          lower.includes("check answer") ||
          text.length <= 700
        );
      });
    }

    if (!selected.length) selected = visible;

    return selected.slice(0, 24);
  }

  async function copyText(text) {
    if (
      navigator.clipboard?.writeText &&
      window.isSecureContext
    ) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");

    Object.assign(textarea.style, {
      position: "fixed",
      left: "0",
      top: "0",
      width: "1px",
      height: "1px",
      opacity: "0",
      zIndex: "2147483647"
    });

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    let ok = false;

    try {
      ok = document.execCommand("copy");
    } finally {
      textarea.remove();
    }

    return ok;
  }

  function renderQuestionCollection() {
    const area = panel.querySelector("#ch-question-list");
    area.textContent = "";

    if (!state.questionClips.length) {
      const empty = document.createElement("div");
      empty.textContent = "No questions collected yet.";
      empty.style.color = "#aaa";
      area.appendChild(empty);
      return;
    }

    state.questionClips.forEach((clip, index) => {
      const block = document.createElement("div");
      block.textContent = `${index + 1}. ${clip}`;

      Object.assign(block.style, {
        padding: "7px",
        marginBottom: "6px",
        border: "1px solid #444",
        borderRadius: "6px",
        background: "#202020",
        whiteSpace: "pre-wrap"
      });

      area.appendChild(block);
    });
  }

  async function copyQuestions() {
    const items = getQuestionText();

    if (!items.length) {
      setStatus(
        "No visible question text detected to copy.",
        "warn"
      );
      return;
    }

    for (const item of items) {
      if (!state.questionClips.includes(item)) {
        state.questionClips.push(item);
      }
    }

    renderQuestionCollection();

    const text = formatQuestionsForCopy(items);

    try {
      const ok = await copyText(text);

      setStatus(
        ok
          ? `Copied ${items.length} visible question item${
              items.length === 1 ? "" : "s"
            }.`
          : "Question text collected. If copy did not work, use Copy all.",
        ok ? "good" : "warn"
      );
    } catch {
      setStatus(
        "Question text collected. Clipboard was blocked by this browser.",
        "warn"
      );
    }
  }

  async function copyAllCollected() {
    if (!state.questionClips.length) {
      setStatus("No collected questions to copy yet.", "warn");
      return;
    }

    try {
      const ok = await copyText(
        formatQuestionsForCopy(state.questionClips)
      );

      setStatus(
        ok
          ? "Copied all collected questions."
          : "Copy was blocked.",
        ok ? "good" : "warn"
      );
    } catch {
      setStatus(
        "Clipboard was blocked by this browser.",
        "warn"
      );
    }
  }

  function clearCollectedQuestions() {
    state.questionClips = [];
    renderQuestionCollection();
    setStatus("Question collection cleared.", "good");
  }

  function createPanel() {
    panel = document.createElement("div");
    panel.id = PANEL_ID;

    const width = `${state.savedWidth}px`;
    const height = `${state.savedHeight}px`;

    Object.assign(panel.style, {
      position: "fixed",
      top: "max(10px, env(safe-area-inset-top))",
      right: "max(10px, env(safe-area-inset-right))",
      width,
      height,
      minWidth: "300px",
      minHeight: "46px",
      maxWidth: "calc(100vw - 20px)",
      maxHeight: "calc(100vh - 20px)",
      zIndex: "2147483647",
      background: "#111",
      color: "#fff",
      border: "1px solid #555",
      borderRadius: "12px",
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: "14px",
      boxShadow: "0 5px 24px rgba(0,0,0,.55)",
      overflow: "hidden",
      touchAction: "none"
    });

    panel.innerHTML = `
      <div id="ch-header" style="height:46px;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:#181818;border-bottom:1px solid #444;cursor:move;user-select:none;touch-action:none;">
        <strong style="font-size:15px;">Course Helper</strong>
        <div style="display:flex;gap:6px;">
          <button id="ch-minimize" title="Minimize">−</button>
          <button id="ch-close" title="Close">✕</button>
        </div>
      </div>

      <div id="ch-body" style="height:calc(100% - 46px);overflow:auto;box-sizing:border-box;padding:12px;padding-bottom:calc(12px + env(safe-area-inset-bottom));touch-action:pan-y;-webkit-overflow-scrolling:touch;">
        <div id="ch-safety" style="font-weight:bold;text-align:center;padding:9px;margin-bottom:10px;border-radius:6px;">Checking slide...</div>

        <button id="ch-auto" style="width:100%;font-size:16px;font-weight:bold;padding:13px;margin-bottom:10px;">▶ AUTO START</button>

        <div style="display:flex;gap:6px;margin-bottom:8px;">
          <button id="ch-back" style="flex:1;">◀ Back</button>
          <button id="ch-next" style="flex:1;">Next ▶</button>
        </div>

        <button id="ch-finish" style="width:100%;margin-bottom:12px;">⏭ Finish Current Narration</button>

        <div style="font-weight:bold;margin-bottom:6px;">Course speed</div>

        <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px;">
          <button data-speed="1">1×</button>
          <button data-speed="1.5">1.5×</button>
          <button data-speed="2">2×</button>
          <button data-speed="2.5">2.5×</button>
          <button data-speed="3">3×</button>
          <button data-speed="4">4×</button>
        </div>

        <details open style="margin-bottom:12px;">
          <summary style="cursor:pointer;font-weight:bold;padding:6px 0;">Slide information</summary>
          <button id="ch-refresh-text" style="margin:6px 0 8px 0;">↻ Refresh text</button>
          <div id="ch-text" style="max-height:230px;overflow:auto;touch-action:pan-y;-webkit-overflow-scrolling:touch;"></div>
        </details>

        <details open>
          <summary style="cursor:pointer;font-weight:bold;padding:6px 0;">Question collection</summary>

          <div style="display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 8px 0;">
            <button id="ch-copy-questions">Copy questions</button>
            <button id="ch-copy-all">Copy all</button>
            <button id="ch-clear-questions">Clear</button>
          </div>

          <div id="ch-question-list" style="max-height:180px;overflow:auto;touch-action:pan-y;-webkit-overflow-scrolling:touch;"></div>
        </details>

        <div id="ch-status" style="margin-top:10px;background:#1b1b1b;border-radius:5px;padding:8px;min-height:18px;">Ready</div>

        <div style="margin-top:9px;font-size:11px;color:#999;line-height:1.35;">
          Auto pauses when quiz or assessment controls are detected. Copy only collects visible text for your notes.
        </div>
      </div>

      <div id="ch-resize" style="position:absolute;right:2px;bottom:2px;width:30px;height:30px;cursor:nwse-resize;border-right:4px solid #888;border-bottom:4px solid #888;box-sizing:border-box;touch-action:none;"></div>
    `;

    document.body.appendChild(panel);

    panel.querySelectorAll("button").forEach(button => {
      Object.assign(button.style, {
        background: "#303030",
        color: "#fff",
        border: "1px solid #666",
        borderRadius: "7px",
        padding: "9px 10px",
        cursor: "pointer",
        fontSize: "14px",
        minHeight: "40px",
        WebkitAppearance: "none"
      });
    });
  }

  function bindButtons() {
    panel
      .querySelector("#ch-auto")
      .addEventListener("click", toggleAuto);

    panel
      .querySelector("#ch-next")
      .addEventListener("click", manualNext);

    panel
      .querySelector("#ch-back")
      .addEventListener("click", manualBack);

    panel
      .querySelector("#ch-finish")
      .addEventListener("click", finishCurrentSlide);

    panel
      .querySelector("#ch-copy-questions")
      .addEventListener("click", copyQuestions);

    panel
      .querySelector("#ch-copy-all")
      .addEventListener("click", copyAllCollected);

    panel
      .querySelector("#ch-clear-questions")
      .addEventListener("click", clearCollectedQuestions);

    panel
      .querySelector("#ch-refresh-text")
      .addEventListener("click", () => {
        const words = showSlideText();

        setStatus(
          words
            ? `Slide text refreshed: ${words} words.`
            : "No readable text detected.",
          words ? "good" : "warn"
        );
      });

    panel.querySelectorAll("[data-speed]").forEach(button => {
      button.addEventListener("click", () => {
        setSpeed(button.dataset.speed);
      });
    });

    panel
      .querySelector("#ch-close")
      .addEventListener("click", event => {
        event.stopPropagation();
        destroy();
      });

    const body = panel.querySelector("#ch-body");

    panel
      .querySelector("#ch-minimize")
      .addEventListener("click", event => {
        event.stopPropagation();

        if (!state.minimized) {
          state.savedWidth = panel.offsetWidth;
          state.savedHeight = panel.offsetHeight;
          body.style.display = "none";
          panel.style.height = "46px";
          panel.querySelector("#ch-minimize").textContent = "□";
          state.minimized = true;
        } else {
          body.style.display = "block";
          panel.style.width = `${state.savedWidth}px`;
          panel.style.height = `${state.savedHeight}px`;
          panel.querySelector("#ch-minimize").textContent = "−";
          state.minimized = false;
        }
      });
  }

  function bindMoveAndResize() {
    const header = panel.querySelector("#ch-header");
    const resize = panel.querySelector("#ch-resize");

    let dragging = false;
    let dragPointer = null;
    let dragX = 0;
    let dragY = 0;

    header.addEventListener("pointerdown", event => {
      if (event.target.closest("button")) return;

      const rect = panel.getBoundingClientRect();

      dragging = true;
      dragPointer = event.pointerId;
      dragX = event.clientX - rect.left;
      dragY = event.clientY - rect.top;

      panel.style.right = "auto";
      panel.style.left = `${rect.left}px`;
      panel.style.top = `${rect.top}px`;

      try {
        header.setPointerCapture(event.pointerId);
      } catch {}

      event.preventDefault();
    });

    header.addEventListener("pointermove", event => {
      if (
        !dragging ||
        event.pointerId !== dragPointer
      ) {
        return;
      }

      const maxX = Math.max(
        0,
        window.innerWidth - panel.offsetWidth
      );

      const maxY = Math.max(
        0,
        window.innerHeight - panel.offsetHeight
      );

      const x = Math.max(
        0,
        Math.min(maxX, event.clientX - dragX)
      );

      const y = Math.max(
        0,
        Math.min(maxY, event.clientY - dragY)
      );

      panel.style.left = `${x}px`;
      panel.style.top = `${y}px`;
      event.preventDefault();
    });

    function endDrag(event) {
      if (
        dragPointer !== null &&
        event.pointerId !== dragPointer
      ) {
        return;
      }

      dragging = false;
      dragPointer = null;
    }

    header.addEventListener("pointerup", endDrag);
    header.addEventListener("pointercancel", endDrag);

    let resizing = false;
    let resizePointer = null;
    let startX = 0;
    let startY = 0;
    let startWidth = 0;
    let startHeight = 0;

    resize.addEventListener("pointerdown", event => {
      if (state.minimized) return;

      resizing = true;
      resizePointer = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      startWidth = panel.offsetWidth;
      startHeight = panel.offsetHeight;

      try {
        resize.setPointerCapture(event.pointerId);
      } catch {}

      event.preventDefault();
      event.stopPropagation();
    });

    resize.addEventListener("pointermove", event => {
      if (
        !resizing ||
        event.pointerId !== resizePointer
      ) {
        return;
      }

      const width = Math.max(
        300,
        Math.min(
          window.innerWidth - 8,
          startWidth + (event.clientX - startX)
        )
      );

      const height = Math.max(
        46,
        Math.min(
          window.innerHeight - 8,
          startHeight + (event.clientY - startY)
        )
      );

      panel.style.width = `${width}px`;
      panel.style.height = `${height}px`;
      panel.style.maxWidth = "none";
      panel.style.maxHeight = "none";

      state.savedWidth = width;
      state.savedHeight = height;

      event.preventDefault();
    });

    function endResize(event) {
      if (
        resizePointer !== null &&
        event.pointerId !== resizePointer
      ) {
        return;
      }

      resizing = false;
      resizePointer = null;
    }

    resize.addEventListener("pointerup", endResize);
    resize.addEventListener("pointercancel", endResize);
  }

  function destroy() {
    stopAuto();

    if (timers.speed) {
      clearInterval(timers.speed);
      timers.speed = null;
    }

    if (timers.observer) {
      try {
        timers.observer.disconnect();
      } catch {}

      timers.observer = null;
    }

    document.getElementById(PANEL_ID)?.remove();

    if (window.__courseHelperDestroy === destroy) {
      window.__courseHelperDestroy = null;
    }
  }

  function startObserver() {
    try {
      timers.observer = new MutationObserver(() => {
        if (state.auto || !panel?.isConnected) return;
        applySpeed();
      });

      timers.observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    } catch {}
  }

  createPanel();
  bindButtons();
  bindMoveAndResize();
  renderQuestionCollection();

  timers.speed = setInterval(() => {
    applySpeed();
    updateSafety();
  }, 700);

  window.__courseHelperDestroy = destroy;

  startObserver();
  setSpeed(3);
  showSlideText();
  updateSafety();
  updateAutoButton();

  setStatus(
    "Ready. Press AUTO START, use Next, or Copy questions.",
    "good"
  );

  console.log("Course Helper loaded.");
})();