"use strict";

/* Fasting timer math: pure functions with no DOM access, shared by
   app.js in the browser and by the node unit tests. A live fast is just
   { start: epochMs, targetHours } — everything else (elapsed, progress)
   is derived from the stored start time, so a page reload mid-fast is
   handled naturally. */
(function (root) {
  var TARGETS = [12, 14, 16, 18, 20];

  function elapsedMs(start, now) {
    var d = Number(now) - Number(start);
    return d > 0 ? d : 0;
  }

  function targetMs(targetHours) {
    return Number(targetHours) * 3600 * 1000;
  }

  function progress(start, targetHours, now) {
    var t = targetMs(targetHours);
    if (!(t > 0)) return 0;
    var p = elapsedMs(start, now) / t;
    return p > 1 ? 1 : p;
  }

  function completeFast(start, end, targetHours) {
    var dur = elapsedMs(start, end);
    return {
      start: Number(start),
      end: Number(end),
      targetHours: Number(targetHours),
      durationMs: dur,
      met: dur >= targetMs(targetHours)
    };
  }

  function pad(n) { return String(n).padStart(2, "0"); }

  /* "13:24:05" — for the live ticking clock. */
  function formatElapsed(ms) {
    var totalSec = Math.floor(Math.max(0, Number(ms)) / 1000);
    var h = Math.floor(totalSec / 3600);
    var m = Math.floor((totalSec % 3600) / 60);
    var sec = totalSec % 60;
    return pad(h) + ":" + pad(m) + ":" + pad(sec);
  }

  /* "13h 24m" — for history entries. */
  function formatDuration(ms) {
    var mins = Math.floor(Math.max(0, Number(ms)) / 60000);
    return Math.floor(mins / 60) + "h " + pad(mins % 60) + "m";
  }

  var api = {
    TARGETS: TARGETS,
    elapsedMs: elapsedMs,
    targetMs: targetMs,
    progress: progress,
    completeFast: completeFast,
    formatElapsed: formatElapsed,
    formatDuration: formatDuration
  };
  root.Fasting = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
