"use strict";

/* Unit tests for the fasting math in fasting.js.
   Run: node tests/fasting.test.js */
const assert = require("assert");
const Fasting = require("../fasting.js");

const H = 3600 * 1000;
const start = 1762000000000;

// Presets are exactly the ones the task specifies.
assert.deepStrictEqual(Fasting.TARGETS, [12, 14, 16, 18, 20]);

// Elapsed never goes negative (clock skew safety).
assert.strictEqual(Fasting.elapsedMs(start, start + H), H);
assert.strictEqual(Fasting.elapsedMs(start, start - 5000), 0);

// Progress is a 0..1 fraction of the target and caps at 1.
assert.strictEqual(Fasting.progress(start, 16, start + 8 * H), 0.5);
assert.strictEqual(Fasting.progress(start, 16, start + 40 * H), 1);
assert.strictEqual(Fasting.progress(start, 16, start), 0);
assert.strictEqual(Fasting.progress(start, 0, start + H), 0);

// Completion records duration and whether the target was met.
const met = Fasting.completeFast(start, start + 17 * H, 16);
assert.strictEqual(met.met, true);
assert.strictEqual(met.durationMs, 17 * H);
assert.strictEqual(met.targetHours, 16);
const early = Fasting.completeFast(start, start + 10 * H, 16);
assert.strictEqual(early.met, false);
const exact = Fasting.completeFast(start, start + 16 * H, 16);
assert.strictEqual(exact.met, true);

// Reload mid-fast: state is just the stored start + target, so elapsed
// derived after a "reload" (recomputing from the same start) is exact.
const stored = { start: start, targetHours: 18 };
const later = start + 5 * H + 30 * 60000;
assert.strictEqual(Fasting.formatElapsed(Fasting.elapsedMs(stored.start, later)), "05:30:00");

// Formatting.
assert.strictEqual(Fasting.formatElapsed(13 * H + 24 * 60000 + 5000), "13:24:05");
assert.strictEqual(Fasting.formatElapsed(0), "00:00:00");
assert.strictEqual(Fasting.formatElapsed(59 * 1000), "00:00:59");
assert.strictEqual(Fasting.formatDuration(13 * H + 24 * 60000), "13h 24m");
assert.strictEqual(Fasting.formatDuration(45 * 60000), "0h 45m");

console.log("fasting.test.js: all tests passed");
