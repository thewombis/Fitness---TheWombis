"use strict";

/* End-to-end smoke tests: boot the app (init + renderAll) against a fake
   DOM and drive the six new features' core flows — favorites/recents,
   copy-from-yesterday, recipe save/log, fasting start/end, reminder
   check, and a language switch. Run: node tests/smoke.test.js */
const assert = require("assert");
const harness = require("./harness");

const app = harness.loadAppWithDom();
app._fireDomReady(); // runs init(): applyTheme/Language, renderAll, listeners

/* ---------- Quick re-log: favorites & recents ---------- */
const food = {
  name: "Greek Yogurt", brand: "TestBrand", source: "USDA",
  per100: { kcal: 97, protein: 9, carbs: 4, fat: 5, micros: app.emptyMicros() },
  serving: { amount: 170, unit: "g", label: "container" }
};
const snap = app.foodSnapshot(food, 170, { qty: 1, unit: "serving" });
assert.strictEqual(app.isFavorite(food), false);
assert.strictEqual(app.toggleFavorite(snap), true);
assert.strictEqual(app.isFavorite(food), true);
assert.ok(JSON.parse(app._store["cc-favorites-v1"]).length === 1, "favorite persisted");

app.pushRecent(snap);
app.pushRecent(snap); // re-logging the same food must not duplicate it
assert.strictEqual(app.recents.length, 1);
for (let i = 0; i < 25; i++) {
  app.pushRecent(app.foodSnapshot({ name: "Food " + i, brand: "", per100: food.per100, serving: null }, 100, null));
}
assert.strictEqual(app.recents.length, 20, "recents capped at 20");
assert.strictEqual(app.recents[0].name, "Food 24", "most recent first");

// One-tap log from a snapshot adds an entry at the saved serving.
app.document.getElementById("meal-select").value = "Breakfast";
const before = app.dayEntries().length;
app.logSnapshot(snap);
assert.strictEqual(app.dayEntries().length, before + 1);
const logged = app.dayEntries()[app.dayEntries().length - 1];
assert.strictEqual(logged.grams, 170);
assert.strictEqual(logged.servingLabel, "container");

/* ---------- Copy yesterday ---------- */
const today = app.todayStr();
const yesterday = app.shiftDate(today, -1);
app.state.entries[yesterday] = [
  { id: "y1", name: "Eggs", brand: "", meal: "Breakfast", grams: 100, per100: food.per100 },
  { id: "y2", name: "Soup", brand: "", meal: "Lunch", grams: 200, per100: food.per100 }
];
app.saveState();
const todayBefore = (app.state.entries[today] || []).length;
app.copyFromYesterday("Breakfast");
assert.strictEqual(app.state.entries[today].length, todayBefore + 1, "per-meal copy");
app.copyFromYesterday(null);
assert.strictEqual(app.state.entries[today].length, todayBefore + 3, "whole-day copy");
// Copied entries are deep copies with fresh ids.
assert.notStrictEqual(app.state.entries[today][todayBefore].id, "y1");

/* ---------- Recipe builder ---------- */
app.myRecipes.push({
  id: "r-test", name: "Test stew", servings: 2,
  ingredients: [{ name: "A", brand: "", grams: 200, disp: null, serving: null, per100: { kcal: 100, protein: 5, carbs: 10, fat: 2, micros: app.emptyMicros() } }]
});
app.saveRecipes();
assert.strictEqual(JSON.parse(app._store["cc-recipes-v1"])[0].name, "Test stew");
const rEntry = app.window.Recipes.recipeEntry(app.myRecipes[0], 0.5, "Dinner", "e1");
assert.strictEqual(app.scaledNutrients(rEntry.per100, rEntry.grams).kcal, 50);
assert.strictEqual(app.entryAmountText(rEntry), "0.5 servings (recipe)");

/* ---------- Fasting ---------- */
app.startFast();
assert.ok(app.fastingStore.current, "fast running after start");
assert.ok(JSON.parse(app._store["cc-fasting-v1"]).current, "fast persisted (reload-safe)");
app.endFast();
assert.strictEqual(app.fastingStore.current, null);
assert.strictEqual(app.fastingStore.history.length, 1, "completed fast recorded");

/* ---------- Reminders ---------- */
app.reminderCfg.enabled = true;
app.reminderCfg.lunch = "00:00"; // time has passed
app.reminderCfg.dinner = "23:59"; // not yet
app.reminderCfg.lastFired = {};
app.state.entries[today] = []; // nothing logged
app.saveState();
app.checkReminders();
assert.strictEqual(app.reminderCfg.lastFired.Lunch, today, "lunch reminder fired once");
assert.ok(!app.reminderCfg.lastFired.Dinner, "dinner not fired early");
app.checkReminders(); // second check must not re-fire
assert.strictEqual(app.reminderBannerMsgs.length, 1, "exactly one banner message");

/* ---------- Voice transcript parsing ---------- */
function veq(actual, expected) { assert.strictEqual(JSON.stringify(actual), JSON.stringify(expected)); }
veq(app.parseVoiceTranscript("two eggs"), { qty: 2, query: "eggs" });
veq(app.parseVoiceTranscript("2 chicken breasts"), { qty: 2, query: "chicken breasts" });
veq(app.parseVoiceTranscript("chicken salad"), { qty: null, query: "chicken salad" });
veq(app.parseVoiceTranscript("half avocado"), { qty: 0.5, query: "avocado" });

/* ---------- Language switch ---------- */
app.state.settings.language = "es";
app.applyLanguage();
app.renderAll();
assert.strictEqual(app.document.documentElement.lang, "es");
assert.strictEqual(app.t("tab.home"), "Inicio");
assert.strictEqual(app.mealLabel("Lunch"), "Almuerzo");
assert.strictEqual(app.entryAmountText(rEntry), "0.5 raciones (receta)");
app.state.settings.language = "en";
app.applyLanguage();
app.renderAll();
assert.strictEqual(app.t("tab.home"), "Home");

console.log("smoke.test.js: all tests passed");
