"use strict";

/* Unit tests for the recipe math in recipes.js, including a cross-check
   that its MICRO_KEYS stay in sync with MICROS in app.js and that a
   recipe log entry scales correctly through the app's own
   scaledNutrients(). Run: node tests/recipes.test.js */
const assert = require("assert");
const Recipes = require("../recipes.js");
const loadApp = require("./harness").loadApp;

const recipe = {
  name: "Test stew",
  servings: 2,
  ingredients: [
    { name: "A", brand: "", grams: 150, disp: null, serving: null,
      per100: { kcal: 200, protein: 10, carbs: 20, fat: 8, micros: { fiber: 4, iron: 2, calcium: 100 } } },
    { name: "B", brand: "", grams: 100, disp: null, serving: null,
      per100: { kcal: 50, protein: 2, carbs: 5, fat: 1, micros: { fiber: 1, potassium: 300 } } }
  ]
};

// Totals: A contributes 1.5x its per-100 values, B contributes 1x.
const totals = Recipes.recipeTotals(recipe);
assert.strictEqual(totals.kcal, 350);
assert.strictEqual(totals.protein, 17);
assert.strictEqual(totals.carbs, 35);
assert.strictEqual(totals.fat, 13);
assert.strictEqual(totals.micros.fiber, 7);
assert.strictEqual(totals.micros.iron, 3);
assert.strictEqual(totals.micros.calcium, 150);
assert.strictEqual(totals.micros.potassium, 300);
assert.strictEqual(totals.micros.vitC, 0); // missing micro data reads as 0

// Per serving divides by the servings count.
const per = Recipes.recipePerServing(recipe);
assert.strictEqual(per.kcal, 175);
assert.strictEqual(per.protein, 8.5);
assert.strictEqual(per.micros.fiber, 3.5);

// A servings count of 0 or missing falls back to 1 (no divide-by-zero).
assert.strictEqual(Recipes.recipePerServing({ servings: 0, ingredients: recipe.ingredients }).kcal, 350);
assert.strictEqual(Recipes.recipePerServing({ ingredients: recipe.ingredients }).kcal, 350);

// Empty recipe totals are zero.
assert.strictEqual(Recipes.recipeTotals({ servings: 1, ingredients: [] }).kcal, 0);

// Log entries: per100 holds one serving, grams = 100 * qty, so the app's
// scaledNutrients() reproduces qty servings — including fractions.
const app = loadApp();
[[1, 175], [0.5, 87.5], [2.5, 437.5]].forEach(function (pair) {
  const entry = Recipes.recipeEntry(recipe, pair[0], "Lunch", "test-id");
  assert.strictEqual(entry.meal, "Lunch");
  assert.strictEqual(entry.recipeServing, true);
  const scaled = app.scaledNutrients(entry.per100, entry.grams);
  assert.ok(Math.abs(scaled.kcal - pair[1]) < 1e-9, "qty " + pair[0] + " kcal " + scaled.kcal);
  assert.ok(Math.abs(scaled.micros.fiber - per.micros.fiber * pair[0]) < 1e-9);
});

// MICRO_KEYS must mirror the app's MICROS list exactly. (JSON comparison:
// app.MICROS lives in the vm realm, so deepStrictEqual's prototype check
// would fail on structurally identical arrays.)
const appKeys = app.MICROS.map(function (m) { return m.key; }).sort();
assert.strictEqual(JSON.stringify(Recipes.MICRO_KEYS.slice().sort()), JSON.stringify(appKeys));

console.log("recipes.test.js: all tests passed");
