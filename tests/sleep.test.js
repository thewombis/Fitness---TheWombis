"use strict";

/* Unit tests for the sleep math in sleep.js.
   Run: node tests/sleep.test.js */
const assert = require("assert");
const Sleep = require("../sleep.js");

// Default target is 8 hours, as specified.
assert.strictEqual(Sleep.DEFAULT_TARGET_MIN, 480);
assert.strictEqual(Sleep.MAX_MIN, 24 * 60);

// Hours + minutes combine; strings from form fields are accepted.
assert.strictEqual(Sleep.toMinutes(7, 30), 450);
assert.strictEqual(Sleep.toMinutes("7", "30"), 450);
assert.strictEqual(Sleep.toMinutes(0, 45), 45);
assert.strictEqual(Sleep.toMinutes(8, 0), 480);
assert.strictEqual(Sleep.toMinutes("", ""), 0);
assert.strictEqual(Sleep.toMinutes(null, undefined), 0);

// Totals clamp to a single day and never go negative.
assert.strictEqual(Sleep.toMinutes(30, 0), 24 * 60);
assert.strictEqual(Sleep.toMinutes(-2, 0), 0);
assert.strictEqual(Sleep.toMinutes(7, 90), 510); // minutes over 59 still count

// Validity: a loggable night is 1 minute .. 24 hours.
assert.strictEqual(Sleep.isValid(1), true);
assert.strictEqual(Sleep.isValid(480), true);
assert.strictEqual(Sleep.isValid(24 * 60), true);
assert.strictEqual(Sleep.isValid(0), false);
assert.strictEqual(Sleep.isValid(-5), false);
assert.strictEqual(Sleep.isValid(24 * 60 + 1), false);
assert.strictEqual(Sleep.isValid("abc"), false);
assert.strictEqual(Sleep.isValid(NaN), false);

// Formatting matches the fasting history style ("7h 30m").
assert.strictEqual(Sleep.formatDuration(450), "7h 30m");
assert.strictEqual(Sleep.formatDuration(480), "8h 00m");
assert.strictEqual(Sleep.formatDuration(45), "0h 45m");
assert.strictEqual(Sleep.formatDuration(0), "0h 00m");
assert.strictEqual(Sleep.formatDuration(24 * 60), "24h 00m");

// Averages round to whole minutes and ignore junk; empty -> null.
assert.strictEqual(Sleep.average([450, 480]), 465);
assert.strictEqual(Sleep.average([451, 480]), 466);
assert.strictEqual(Sleep.average([420]), 420);
assert.strictEqual(Sleep.average([]), null);
assert.strictEqual(Sleep.average(null), null);
assert.strictEqual(Sleep.average([450, "x", 480]), 465);

console.log("sleep.test.js: all tests passed");
