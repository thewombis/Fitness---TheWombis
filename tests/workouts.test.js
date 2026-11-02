"use strict";

/* Checks for the workout library and its animated form demos:
   1. All 35 exercises resolve to real start/peak poses, and every pose
      is 10 points inside the 120x120 viewBox.
   2. Props are stored as an even number of points (consecutive pairs
      form one drawn segment each: wall, chair, table, straps, bar).
   3. The player renders the polished solid figure (clothed torso,
      tapered limb polygons, head with hair, ground shadow) — not the
      old stick-figure line segments — keeps the 1700 ms loop, the
      caption sync, the pause control, and reduced-motion support.
   4. Release wiring stays in step: APP_RELEASE, the What's New note
      key, and the service-worker cache version all agree.
   Run: node tests/workouts.test.js */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "workouts.js"), "utf8");

const sandbox = {
  console: console,
  document: {
    addEventListener: function () {},
    documentElement: { lang: "en" },
    querySelectorAll: function () { return []; },
    getElementById: function () { return null; }
  }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(src, sandbox, { filename: "workouts.js" });

const POSES = sandbox.POSES;
const EXERCISES = sandbox.EXERCISES;
assert.ok(POSES && EXERCISES, "POSES and EXERCISES are defined");
assert.strictEqual(EXERCISES.length, 35, "35 exercises");

// 1. Every exercise resolves; every pose is well-formed.
Object.keys(POSES).forEach(function (name) {
  const pose = POSES[name];
  assert.strictEqual(pose.p.length, 10, name + " has 10 points");
  pose.p.forEach(function (pt) {
    assert.ok(Array.isArray(pt) && pt.length === 2, name + " point shape");
    assert.ok(pt[0] >= 0 && pt[0] <= 120 && pt[1] >= 0 && pt[1] <= 120,
      name + " point inside viewBox: " + pt);
  });
  // 2. Props pair up into segments.
  if (pose.props) {
    assert.strictEqual(pose.props.length % 2, 0, name + " props pair into segments");
    pose.props.forEach(function (pt) {
      assert.ok(pt[0] >= 0 && pt[0] <= 120 && pt[1] >= 0 && pt[1] <= 120,
        name + " prop point inside viewBox: " + pt);
    });
  }
});
const groups = {};
EXERCISES.forEach(function (ex) {
  assert.ok(POSES[ex.a], ex.name + " start pose " + ex.a);
  assert.ok(POSES[ex.b], ex.name + " peak pose " + ex.b);
  assert.ok(ex.start && ex.peak && ex.sets, ex.name + " has captions and sets");
  groups[ex.group] = (groups[ex.group] || 0) + 1;
});
assert.deepStrictEqual(groups, { Push: 9, Pull: 6, "Legs & Core": 13, "Full-Body": 7 });

// 3. Polished-figure rendering markers, and the behaviours kept.
["wk-shirt", "wk-shorts", "data-el=\"torso\"", "data-el=\"shadow\"",
 "data-el=\"hair\"", "data-el=\"shoeNear\"", "setPoly", "wk-prop-fill",
 "data-el=\"shoulder\"", "data-el=\"nose\"", "<ellipse class=\"wk-head\""
].forEach(function (needle) {
  assert.ok(src.indexOf(needle) !== -1, "workouts.js renders: " + needle);
});
assert.ok(src.indexOf("wk-eye") === -1, "no cartoon eye dot on the face");
assert.ok(src.indexOf('class="wk-fig seg"') === -1, "old stick-figure segments are gone");
assert.ok(/var cycle = 1700/.test(src), "1700 ms loop timing kept");
assert.ok(src.indexOf('wkText("wk.pause")') !== -1, "pause control kept");
assert.ok(src.indexOf('wkText("wk.play")') !== -1, "play control kept");
assert.ok(src.indexOf("cap-on") !== -1, "caption highlighting kept");
assert.ok(src.indexOf("prefers-reduced-motion") !== -1, "reduced-motion honoured");
assert.ok(src.indexOf("renderFigure") !== -1, "frame renderer present");

// 4. Release wiring: app release, What's New key, service worker.
const appSrc = fs.readFileSync(path.join(root, "app.js"), "utf8");
const swSrc = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const release = Number((appSrc.match(/var APP_RELEASE = (\d+)/) || [])[1]);
assert.ok(release >= 16, "APP_RELEASE bumped to at least 16, got " + release);
assert.ok(appSrc.indexOf('"wn.v' + release + 'a"') !== -1, "What's New key for release " + release);
assert.ok(swSrc.indexOf("calorie-counter-v" + release) !== -1,
  "service worker cache matches release " + release);
const dict = require("../i18n.js");
assert.ok(dict.I18N["wn.v" + release + "a"], "wn.v" + release + "a exists in dictionary");
assert.strictEqual(dict.I18N["wn.v" + release + "a"].length, 8, "What's New note in all 8 languages");

console.log("workouts.test.js: all tests passed (35 exercises, " +
  Object.keys(POSES).length + " poses, release " + release + ")");
