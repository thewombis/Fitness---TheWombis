"use strict";

/* Sleep math: pure functions with no DOM access, shared by app.js in
   the browser and by the node unit tests. Sleep is stored as whole
   minutes per night (plus an optional 1–5 quality rating); everything
   else — display text, averages — is derived from those minutes. */
(function (root) {
  var DEFAULT_TARGET_MIN = 480; // 8 hours
  var MAX_MIN = 24 * 60;

  /* Hours + minutes form fields -> total minutes, clamped to 0..24h. */
  function toMinutes(hours, minutes) {
    var h = Math.round(Number(hours) || 0);
    var m = Math.round(Number(minutes) || 0);
    var total = h * 60 + m;
    if (total < 0) return 0;
    if (total > MAX_MIN) return MAX_MIN;
    return total;
  }

  /* A loggable night is more than nothing and at most a full day. */
  function isValid(totalMin) {
    var n = Number(totalMin);
    return isFinite(n) && n > 0 && n <= MAX_MIN;
  }

  function pad(n) { return String(n).padStart(2, "0"); }

  /* "7h 30m" — matches the fasting history format. */
  function formatDuration(totalMin) {
    var mins = Math.round(Math.max(0, Number(totalMin) || 0));
    return Math.floor(mins / 60) + "h " + pad(mins % 60) + "m";
  }

  /* Mean of an array of minute values, rounded; null when empty. */
  function average(values) {
    if (!values || !values.length) return null;
    var sum = 0, n = 0;
    values.forEach(function (v) {
      var x = Number(v);
      if (isFinite(x)) { sum += x; n++; }
    });
    return n ? Math.round(sum / n) : null;
  }

  var api = {
    DEFAULT_TARGET_MIN: DEFAULT_TARGET_MIN,
    MAX_MIN: MAX_MIN,
    toMinutes: toMinutes,
    isValid: isValid,
    formatDuration: formatDuration,
    average: average
  };
  root.Sleep = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
