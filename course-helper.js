(() => {
  /*
    COURSE HELPER
    Desktop + mobile version

    Normal content slides:
    - Shows the visible text
    - Speeds up course narration
    - AUTO mode gives you time to read
    - Finishes normal media
    - Moves to the next slide

    Assessments/interactions:
    - AUTO stops
    - Does not answer questions
    - Does not alter SCORM completion data
  */

  // =========================================================
  // REMOVE AN OLD COPY
  // =========================================================

  if (window.__courseHelperTimer) {
    clearInterval(window.__courseHelperTimer);
  }

  if (window.__courseAutoTimer) {
    clearTimeout(window.__courseAutoTimer);
  }

  document.getElementById("course-helper-panel")?.remove();

  // =========================================================
  // SETTINGS
  // =========================================================

  const state = {
    courseSpeed: 3,

    // Approximate reading speed used by AUTO mode
    wordsPerMinute: 400,

    // Auto mode will never spend less/more than these
    minimumSeconds: 3,
    maximumSeconds: 25,

    auto: false,
    processing: false,
    minimized: false,

    savedWidth: 430,
    savedHeight: 560
  };

  // =========================================================
  // ACCESS PAGE + SAME-ORIGIN IFRAMES
  // =========================================================

  function getAllDocs() {
    const docs = [document];
    const seen = new Set([document]);

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

  // =========================================================
  // GENERAL HELPERS
  // =========================================================

  function cleanText(text) {
    return String(text || "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function isVisible(el, doc) {
    if (!el) return false;

    try {
      const style = doc.defaultView.getComputedStyle(el);

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
    const box = panel.querySelector("#ch-status");
    if (!box) return;

    box.textContent = message;

    const colours = {
      normal: "#8fd3ff",
      good: "#86efac",
      warn: "#ffd166",
      bad: "#ff9090"
    };

    box.style.color = colours[type] || colours.normal;
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // =========================================================
  // ASSESSMENT / QUIZ DETECTION
  // =========================================================

  function detectAssessment() {
    const phrases = [
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

    for (const doc of getAllDocs()) {
      try {
        const text = cleanText(doc.body?.innerText).toLowerCase();

        for (const phrase of phrases) {
          if (text.includes(phrase)) {
            reasons.push(phrase);
            break;
          }
        }

        const answerControls = [
          ...doc.querySelectorAll(
            'input[type="radio"],' +
            'input[type="checkbox"],' +
            '[role="radio"],' +
            '[role="checkbox"]'
          )
        ].filter(el => isVisible(el, doc));

        if (answerControls.length) {
          reasons.push("answer controls");
        }

        const buttons = [
          ...doc.querySelectorAll(
            'button,[role="button"],input[type="submit"]'
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

  function updateSafetyIndicator() {
    const result = detectAssessment();
    const box = panel.querySelector("#ch-safety");

    if (!box) return result;

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

  // =========================================================
  // COURSE AUDIO / VIDEO SPEED
  // =========================================================

  function applyCourseSpeed() {
    let found = 0;

    for (const doc of getAllDocs()) {
      try {
        doc.querySelectorAll("audio,video").forEach(media => {
          try {
            media.playbackRate = state.courseSpeed;
            media.defaultPlaybackRate = state.courseSpeed;
            found++;
          } catch {}
        });
      } catch {}
    }

    return found;
  }

  function setCourseSpeed(rate) {
    state.courseSpeed = Number(rate);

    const found = applyCourseSpeed();

    panel
      .querySelectorAll("[data-speed]")
      .forEach(button => {
        const active =
          Number(button.dataset.speed) === state.courseSpeed;

        button.style.background =
          active ? "#315978" : "#303030";

        button.style.borderColor =
          active ? "#8fd3ff" : "#666";
      });

    setStatus(
      found
        ? `Course speed: ${state.courseSpeed}×`
        : `Speed set to ${state.courseSpeed}×. Waiting for media.`,
      "good"
    );
  }

  // =========================================================
  // TEXT EXTRACTION
  // =========================================================

  function ignoreText(text) {
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
      "unmute"
    ].includes(text.toLowerCase().trim());
  }

  function extractVisibleText() {
    const collected = [];

    for (const doc of getAllDocs()) {
      let elements = [];

      try {
        elements = [
          ...doc.querySelectorAll(
            "p,li,h1,h2,h3,h4,h5,h6," +
            '[role="heading"],span,div'
          )
        ];
      } catch {
        continue;
      }

      for (const el of elements) {
        if (!isVisible(el, doc)) continue;

        if (
          ["SCRIPT", "STYLE", "NOSCRIPT"].includes(el.tagName)
        ) {
          continue;
        }

        let visibleChildren = 0;

        try {
          for (const child of el.children) {
            if (
              isVisible(child, doc) &&
              cleanText(child.innerText).length > 0
            ) {
              visibleChildren++;
            }
          }
        } catch {}

        // Reduce duplicate text from giant parent containers
        if (
          visibleChildren > 2 &&
          el.tagName !== "LI"
        ) {
          continue;
        }

        const text = cleanText(
          el.innerText || el.textContent
        );

        if (text.length < 3) continue;
        if (text.length > 1800) continue;
        if (ignoreText(text)) continue;

        collected.push(text);
      }
    }

    const unique = [];

    for (const text of collected) {
      if (!unique.includes(text)) {
        unique.push(text);
      }
    }

    return unique;
  }

  function showSlideText() {
    const paragraphs = extractVisibleText();

    const area = panel.querySelector("#ch-text");
    area.innerHTML = "";

    if (!paragraphs.length) {
      const empty = document.createElement("div");

      empty.textContent =
        "No readable slide text detected.";

      empty.style.color = "#aaa";

      area.appendChild(empty);

      return 0;
    }

    paragraphs.forEach(text => {
      const block = document.createElement("div");

      block.textContent = text;

      Object.assign(block.style, {
        padding: "9px",
        marginBottom: "7px",
        border: "1px solid #444",
        borderRadius: "6px",
        background: "#202020",
        color: "#fff",
        lineHeight: "1.45"
      });

      area.appendChild(block);
    });

    return paragraphs
      .join(" ")
      .split(/\s+/)
      .filter(Boolean)
      .length;
  }

  // =========================================================
  // READING TIME
  // =========================================================

  function calculateReadingDelay(words) {
    let seconds =
      (words / state.wordsPerMinute) * 60;

    seconds = Math.max(
      state.minimumSeconds,
      seconds
    );

    seconds = Math.min(
      state.maximumSeconds,
      seconds
    );

    return Math.round(seconds);
  }

  // =========================================================
  // FINISH ORDINARY MEDIA
  // =========================================================

  function finishMedia() {
    let count = 0;

    for (const doc of getAllDocs()) {
      try {
        doc.querySelectorAll("audio,video").forEach(media => {
          try {
            if (
              Number.isFinite(media.duration) &&
              media.duration > 0
            ) {
              media.currentTime =
                Math.max(
                  0,
                  media.duration - 0.05
                );

              count++;
            }
          } catch {}
        });
      } catch {}
    }

    return count;
  }

  // =========================================================
  // NAVIGATION
  // =========================================================

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
          const candidates = [
            ...doc.querySelectorAll(selector)
          ];

          for (const el of candidates) {
            if (
              isVisible(el, doc) &&
              !el.disabled &&
              el.getAttribute("aria-disabled") !== "true"
            ) {
              return el;
            }
          }
        } catch {}
      }

      try {
        const elements = [
          ...doc.querySelectorAll(
            'button,[role="button"],a'
          )
        ];

        for (const el of elements) {
          if (!isVisible(el, doc)) continue;

          const text = cleanText(
            el.innerText ||
            el.getAttribute("aria-label") ||
            el.textContent
          ).toLowerCase();

          if (
            next &&
            ["next", "continue", "next slide"].includes(text)
          ) {
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

  // =========================================================
  // AUTO MODE
  // =========================================================

  function updateAutoButton() {
    const button = panel.querySelector("#ch-auto");

    if (!button) return;

    if (state.auto) {
      button.textContent = "⏸ PAUSE AUTO";
      button.style.background = "#754b20";
      button.style.borderColor = "#ffd166";
    } else {
      button.textContent = "▶ AUTO START";
      button.style.background = "#24563a";
      button.style.borderColor = "#86efac";
    }
  }

  function stopAuto(reason = "") {
    state.auto = false;
    state.processing = false;

    if (window.__courseAutoTimer) {
      clearTimeout(window.__courseAutoTimer);
    }

    updateAutoButton();

    if (reason) {
      setStatus(reason, "warn");
    }
  }

  async function processCurrentSlide() {
    if (!state.auto || state.processing) return;

    state.processing = true;

    applyCourseSpeed();

    // Give animations/text time to appear
    await sleep(700);

    if (!state.auto) {
      state.processing = false;
      return;
    }

    let check = updateSafetyIndicator();

    if (check.blocked) {
      stopAuto(
        "Auto paused because a quiz or interaction was detected."
      );
      return;
    }

    // Show information immediately
    const words = showSlideText();
    const seconds = calculateReadingDelay(words);

    setStatus(
      words
        ? `${words} words shown. Moving on in about ${seconds}s.`
        : `No text detected. Moving on in about ${seconds}s.`,
      "good"
    );

    await new Promise(resolve => {
      window.__courseAutoTimer =
        setTimeout(resolve, seconds * 1000);
    });

    if (!state.auto) {
      state.processing = false;
      return;
    }

    // Check before doing anything else
    check = updateSafetyIndicator();

    if (check.blocked) {
      stopAuto(
        "Auto paused because an interaction appeared."
      );
      return;
    }

    // Finish ordinary narration
    finishMedia();

    // Some courses reveal interactions only after narration ends
    await sleep(800);

    if (!state.auto) {
      state.processing = false;
      return;
    }

    // Important second assessment check
    check = updateSafetyIndicator();

    if (check.blocked) {
      stopAuto(
        "Auto paused because a quiz or interaction appeared at the end of the slide."
      );
      return;
    }

    const next = findNavigationButton("next");

    if (!next) {
      stopAuto(
        "Auto paused because the Next button is not available."
      );
      return;
    }

    try {
      next.click();

      setStatus(
        "Moving to next slide...",
        "good"
      );
    } catch {
      stopAuto(
        "Auto paused because Next could not be clicked."
      );
      return;
    }

    state.processing = false;

    window.__courseAutoTimer =
      setTimeout(processCurrentSlide, 1100);
  }

  function toggleAuto() {
    if (state.auto) {
      stopAuto("Auto paused.");
      return;
    }

    const check = updateSafetyIndicator();

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

    setStatus(
      "Auto mode started.",
      "good"
    );

    processCurrentSlide();
  }

  // =========================================================
  // MANUAL CONTROLS
  // =========================================================

  function manualNext() {
    stopAuto();

    const next = findNavigationButton("next");

    if (!next) {
      setStatus(
        "Next button not available.",
        "warn"
      );
      return;
    }

    try {
      next.click();

      setStatus("Next.", "good");

      setTimeout(() => {
        applyCourseSpeed();
        showSlideText();
        updateSafetyIndicator();
      }, 900);
    } catch {
      setStatus(
        "Could not click Next.",
        "bad"
      );
    }
  }

  function manualBack() {
    stopAuto();

    const back = findNavigationButton("previous");

    if (!back) {
      setStatus(
        "Previous button not available.",
        "warn"
      );
      return;
    }

    try {
      back.click();

      setStatus("Previous.", "good");

      setTimeout(() => {
        applyCourseSpeed();
        showSlideText();
        updateSafetyIndicator();
      }, 900);
    } catch {
      setStatus(
        "Could not click Previous.",
        "bad"
      );
    }
  }

  function finishCurrentSlide() {
    const check = updateSafetyIndicator();

    if (check.blocked) {
      setStatus(
        "Finish blocked because a quiz or interaction is visible.",
        "warn"
      );
      return;
    }

    const count = finishMedia();

    setStatus(
      count
        ? "Current narration finished."
        : "No normal audio/video timeline found.",
      count ? "good" : "warn"
    );

    setTimeout(() => {
      updateSafetyIndicator();
      showSlideText();
    }, 700);
  }

  // =========================================================
  // CREATE PANEL
  // =========================================================

  const panel = document.createElement("div");

  panel.id = "course-helper-panel";

  Object.assign(panel.style, {
    position: "fixed",
    top: "15px",
    right: "15px",
    width: `${state.savedWidth}px`,
    height: `${state.savedHeight}px`,
    minWidth: "280px",
    minHeight: "170px",
    maxWidth: "calc(100vw - 16px)",
    maxHeight: "calc(100vh - 16px)",
    zIndex: "2147483647",
    background: "#111",
    color: "#fff",
    border: "1px solid #555",
    borderRadius: "10px",
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSize: "13px",
    boxShadow: "0 5px 24px rgba(0,0,0,.55)",
    overflow: "hidden",
    touchAction: "none"
  });

  panel.innerHTML = `
    <div
      id="ch-header"
      style="
        height:46px;
        box-sizing:border-box;
        display:flex;
        align-items:center;
        justify-content:space-between;
        padding:8px 10px;
        background:#181818;
        border-bottom:1px solid #444;
        cursor:move;
        user-select:none;
        touch-action:none;
      "
    >
      <strong style="font-size:15px;">
        Course Helper
      </strong>

      <div style="display:flex;gap:6px;">
        <button id="ch-minimize" title="Minimize">−</button>
        <button id="ch-close" title="Close">✕</button>
      </div>
    </div>

    <div
      id="ch-body"
      style="
        height:calc(100% - 46px);
        overflow:auto;
        box-sizing:border-box;
        padding:12px;
        touch-action:pan-y;
      "
    >

      <div
        id="ch-safety"
        style="
          font-weight:bold;
          text-align:center;
          padding:9px;
          margin-bottom:10px;
          border-radius:6px;
        "
      >
        Checking slide...
      </div>

      <button
        id="ch-auto"
        style="
          width:100%;
          font-size:16px;
          font-weight:bold;
          padding:13px;
          margin-bottom:10px;
        "
      >
        ▶ AUTO START
      </button>

      <div
        style="
          display:flex;
          gap:6px;
          margin-bottom:8px;
        "
      >
        <button id="ch-back" style="flex:1;">
          ◀ Back
        </button>

        <button id="ch-next" style="flex:1;">
          Next ▶
        </button>
      </div>

      <button
        id="ch-finish"
        style="
          width:100%;
          margin-bottom:12px;
        "
      >
        ⏭ Finish Current Narration
      </button>

      <div
        style="
          font-weight:bold;
          margin-bottom:6px;
        "
      >
        Course speed
      </div>

      <div
        style="
          display:flex;
          flex-wrap:wrap;
          gap:5px;
          margin-bottom:12px;
        "
      >
        <button data-speed="1">1×</button>
        <button data-speed="1.5">1.5×</button>
        <button data-speed="2">2×</button>
        <button data-speed="2.5">2.5×</button>
        <button data-speed="3">3×</button>
        <button data-speed="4">4×</button>
      </div>

      <details open>
        <summary
          style="
            cursor:pointer;
            font-weight:bold;
            padding:6px 0;
          "
        >
          Slide information
        </summary>

        <button
          id="ch-refresh-text"
          style="
            margin:6px 0 8px 0;
          "
        >
          ↻ Refresh text
        </button>

        <div
          id="ch-text"
          style="
            max-height:260px;
            overflow:auto;
            touch-action:pan-y;
          "
        ></div>
      </details>

      <div
        id="ch-status"
        style="
          margin-top:10px;
          background:#1b1b1b;
          border-radius:5px;
          padding:8px;
          min-height:18px;
        "
      >
        Ready
      </div>

      <div
        style="
          margin-top:9px;
          font-size:11px;
          color:#999;
          line-height:1.35;
        "
      >
        Auto mode pauses when quiz or assessment controls are detected.
      </div>
    </div>

    <div
      id="ch-resize"
      style="
        position:absolute;
        right:2px;
        bottom:2px;
        width:30px;
        height:30px;
        cursor:nwse-resize;
        border-right:4px solid #888;
        border-bottom:4px solid #888;
        box-sizing:border-box;
        touch-action:none;
      "
    ></div>
  `;

  document.body.appendChild(panel);

  // =========================================================
  // BUTTON STYLES
  // =========================================================

  panel.querySelectorAll("button").forEach(button => {
    Object.assign(button.style, {
      background: "#303030",
      color: "#fff",
      border: "1px solid #666",
      borderRadius: "6px",
      padding: "9px 10px",
      cursor: "pointer",
      fontSize: "13px",
      minHeight: "38px"
    });
  });

  // =========================================================
  // BUTTON EVENTS
  // =========================================================

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

  panel
    .querySelectorAll("[data-speed]")
    .forEach(button => {
      button.addEventListener("click", () => {
        setCourseSpeed(button.dataset.speed);
      });
    });

  // =========================================================
  // MINIMIZE
  // =========================================================

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

        panel.querySelector(
          "#ch-minimize"
        ).textContent = "□";

        state.minimized = true;
      } else {
        body.style.display = "block";

        panel.style.width =
          `${state.savedWidth}px`;

        panel.style.height =
          `${state.savedHeight}px`;

        panel.querySelector(
          "#ch-minimize"
        ).textContent = "−";

        state.minimized = false;
      }
    });

  // =========================================================
  // CLOSE
  // =========================================================

  panel
    .querySelector("#ch-close")
    .addEventListener("click", event => {
      event.stopPropagation();

      stopAuto();

      if (window.__courseHelperTimer) {
        clearInterval(window.__courseHelperTimer);
      }

      panel.remove();
    });

  // =========================================================
  // POINTER DRAGGING
  // Works with mouse + touchscreen
  // =========================================================

  const header = panel.querySelector("#ch-header");

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

    let x = event.clientX - dragX;
    let y = event.clientY - dragY;

    x = Math.max(
      0,
      Math.min(
        x,
        window.innerWidth - panel.offsetWidth
      )
    );

    y = Math.max(
      0,
      Math.min(
        y,
        window.innerHeight - panel.offsetHeight
      )
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

  // =========================================================
  // POINTER RESIZING
  // Mouse + touchscreen
  // =========================================================

  const resize =
    panel.querySelector("#ch-resize");

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
      280,
      Math.min(
        window.innerWidth - 8,
        startWidth + (event.clientX - startX)
      )
    );

    const height = Math.max(
      170,
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

  // =========================================================
  // KEEP SPEED + SAFETY UPDATED
  // =========================================================

  window.__courseHelperTimer =
    setInterval(() => {
      applyCourseSpeed();
      updateSafetyIndicator();
    }, 600);

  // =========================================================
  // START
  // =========================================================

  setCourseSpeed(3);
  showSlideText();
  updateSafetyIndicator();
  updateAutoButton();

  setStatus(
    "Ready. Press AUTO START or use the manual controls.",
    "good"
  );

  console.log("Course Helper loaded.");
})();
