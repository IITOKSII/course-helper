function getMediaSnapshot() {
  const items = [];

  for (const doc of getAllDocs()) {
    try {
      doc.querySelectorAll("audio,video").forEach(media => {
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
        try {
          const duration = media.duration;

          if (
            Number.isFinite(duration) &&
            duration > 0.2 &&
            !media.ended &&
            media.currentTime < duration - 0.12
          ) {
            active.push(media);
          }
        } catch {}
      });
    } catch {}
  }

  return active;
}

function finishNarrationChunk(mediaItems) {
  let count = 0;

  for (const media of mediaItems) {
    try {
      if (
        Number.isFinite(media.duration) &&
        media.duration > 0
      ) {
        media.currentTime = Math.max(
          0,
          media.duration - 0.03
        );

        count++;
      }
    } catch {}
  }

  return count;
}

function newNarrationStarted(before) {
  const current = getMediaSnapshot();

  for (const now of current) {
    /*
      Brand-new audio/video element.
    */
    const old = before.find(
      x => x.element === now.element
    );

    if (!old) {
      if (
        !now.paused &&
        !now.ended &&
        now.duration > 0
      ) {
        return true;
      }

      continue;
    }

    /*
      Same element, but course changed the audio source.
    */
    if (
      now.src &&
      old.src &&
      now.src !== old.src
    ) {
      return true;
    }

    /*
      Some SCORM players reuse one audio element and
      reset its playhead for the next narration segment.
    */
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

async function manualNext() {
  stopAuto();

  /*
    Never use Smart Next to skip through an assessment.
  */

  let check = updateSafetyIndicator();

  if (check.blocked) {
    setStatus(
      "Quiz / interaction detected. Complete it before continuing.",
      "warn"
    );

    return;
  }

  const activeMedia = getActiveNarration();

  /*
    FIRST PRIORITY:
    If narration is currently available, finish that
    narration section instead of changing slides.
  */

  if (activeMedia.length) {
    const before = getMediaSnapshot();

    finishNarrationChunk(activeMedia);

    setStatus(
      "Finishing current narration...",
      "good"
    );

    /*
      Give the SCORM timeline time to react.
    */

    await sleep(350);

    check = updateSafetyIndicator();

    if (check.blocked) {
      setStatus(
        "Interaction appeared. Stopped here.",
        "warn"
      );

      showSlideText();

      return;
    }

    /*
      Wait briefly to see whether the course starts
      another narration section.
    */

    let nextChunk = false;

    for (let i = 0; i < 10; i++) {
      await sleep(120);

      if (newNarrationStarted(before)) {
        nextChunk = true;
        break;
      }

      const assessment = updateSafetyIndicator();

      if (assessment.blocked) {
        setStatus(
          "Interaction appeared. Stopped here.",
          "warn"
        );

        showSlideText();

        return;
      }
    }

    applyCourseSpeed();
    showSlideText();

    if (nextChunk) {
      setStatus(
        "Next paragraph / narration started.",
        "good"
      );

      return;
    }

    /*
      Important:
      Do NOT automatically leave the slide.

      This prevents a single click from accidentally
      finishing a whole-slide audio track and also
      immediately skipping the slide.
    */

    setStatus(
      "Narration finished. Press Next again to move to the next slide.",
      "good"
    );

    return;
  }

  /*
    There is no unfinished narration.
    Now Next can actually change slides.
  */

  check = updateSafetyIndicator();

  if (check.blocked) {
    setStatus(
      "Quiz / interaction detected. Complete it before continuing.",
      "warn"
    );

    return;
  }

  const next = findNavigationButton("next");

  if (!next) {
    setStatus(
      "Course Next button is not available yet.",
      "warn"
    );

    return;
  }

  try {
    next.click();

    setStatus(
      "Moving to next slide...",
      "good"
    );

    await sleep(850);

    applyCourseSpeed();
    showSlideText();
    updateSafetyIndicator();

  } catch {
    setStatus(
      "Could not click the course Next button.",
      "bad"
    );
  }
}