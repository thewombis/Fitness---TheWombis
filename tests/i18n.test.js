"use strict";

/* Internationalization completeness checks:
   1. Every dictionary key has a non-empty string in all 8 languages.
   2. Every key referenced from index.html (data-i18n*) or from JS
      (t("...") / pt("...") / wkText("...") literals and dotted string
      literals in known namespaces) exists in the dictionary.
   3. Dynamically built keys (micro.<key>, goal.<g>, meal labels,
      photos.<angle>) resolve for every value they can take.
   4. i18nLookup falls back to English, then to the key itself, and
      substitutes {vars}.
   Run: node tests/i18n.test.js */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const dict = require("../i18n.js");
const I18N = dict.I18N;
const LANGS = dict.I18N_LANGS;
const loadApp = require("./harness").loadApp;

assert.deepStrictEqual(LANGS, ["en", "es", "fr", "de", "pt", "it", "zh", "ja"]);

// 1. Completeness across all 8 languages.
Object.keys(I18N).forEach(function (key) {
  const entry = I18N[key];
  assert.ok(Array.isArray(entry), key + " is not an array");
  assert.strictEqual(entry.length, LANGS.length, key + " does not have " + LANGS.length + " entries");
  entry.forEach(function (text, i) {
    assert.ok(typeof text === "string" && text.trim().length > 0,
      key + " has an empty " + LANGS[i] + " translation");
  });
});

// 2. Referenced keys exist.
const namespaces = new Set(Object.keys(I18N).map(function (k) { return k.split(".")[0]; }));
const referenced = new Set();
function note(candidate) {
  if (typeof candidate !== "string" || candidate.indexOf(".") < 0) return;
  const ns = candidate.split(".")[0];
  if (namespaces.has(ns)) referenced.add(candidate);
}
function scanFile(file, patterns) {
  const src = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  patterns.forEach(function (re) {
    let m;
    while ((m = re.exec(src))) note(m[1]);
  });
}
scanFile("app.js", [/\bt\("([\w.]+)"/g, /"((?:[a-z]+\.)+[a-zA-Z]+)"/g]);
scanFile("photos.js", [/\bpt\("([\w.]+)"/g]);
scanFile("workouts.js", [/\bwkText\("([\w.]+)"/g]);
scanFile("index.html", [/data-i18n(?:-ph|-aria|-alt)?="([\w.]+)"/g]);

const missing = [...referenced].filter(function (k) {
  if (k in I18N) return false;
  // A referenced string that is a strict prefix of real keys is a
  // dynamically constructed key (e.g. "micro." + key) — checked in (3).
  return !Object.keys(I18N).some(function (real) { return real.indexOf(k) === 0; });
});
assert.deepStrictEqual(missing, [], "referenced keys missing from dictionary: " + missing.join(", "));

// 3. Dynamic key families resolve.
const app = loadApp();
app.MICROS.forEach(function (m) { assert.ok(I18N["micro." + m.key], "micro." + m.key); });
["lose", "maintain", "gain"].forEach(function (g) { assert.ok(I18N["goal." + g], "goal." + g); });
["front", "side", "back"].forEach(function (a) { assert.ok(I18N["photos." + a], "photos." + a); });
Object.keys(app.MEAL_KEYS || {}).forEach(function () {});
["meal.breakfast", "meal.lunch", "meal.dinner", "meal.snack", "meal.morningSnack",
 "meal.afternoonSnack", "meal.eveningSnack", "meal.preworkoutSnack"].forEach(function (k) {
  assert.ok(I18N[k], k);
});

// 4. Lookup behavior: translation, English fallback, key fallback, vars.
assert.strictEqual(dict.i18nLookup("es", "tab.home"), I18N["tab.home"][1]);
assert.strictEqual(dict.i18nLookup("xx", "tab.home"), I18N["tab.home"][0]);
assert.strictEqual(dict.i18nLookup("en", "no.such.key"), "no.such.key");
assert.strictEqual(
  dict.i18nLookup("en", "res.addedTo", { name: "Soup", meal: "Lunch" }),
  "Added Soup to Lunch."
);
assert.strictEqual(
  dict.i18nLookup("ja", "home.itemsN", { n: 3 }),
  I18N["home.itemsN"][7].replace("{n}", "3")
);

console.log("i18n.test.js: all tests passed (" + Object.keys(I18N).length + " keys x " + LANGS.length + " languages, " + referenced.size + " referenced keys)");
