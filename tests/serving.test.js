"use strict";

/* Regression tests for the app's existing serving parser and nutrition
   scaling (the behavior shipped in service worker v9), plus a
   data-compatibility check: a state blob saved by the previous version
   must load unchanged, with entries and serving snapshots intact.
   Run: node tests/serving.test.js */
const assert = require("assert");
const loadApp = require("./harness").loadApp;

// Structural equality via JSON: values returned from the vm sandbox have
// sandbox-realm prototypes, which deepStrictEqual would reject.
function eq(actual, expected) {
  assert.strictEqual(JSON.stringify(actual), JSON.stringify(expected));
}

const app = loadApp();

/* ---------- parseAmountUnit ---------- */
eq(app.parseAmountUnit("355 mL"), { amount: 355, unit: "ml" });
eq(app.parseAmountUnit("1 L"), { amount: 1000, unit: "ml" });
eq(app.parseAmountUnit("33 cl"), { amount: 330, unit: "ml" });
eq(app.parseAmountUnit("12 fl oz"), { amount: 355, unit: "ml" });
eq(app.parseAmountUnit("500 g"), { amount: 500, unit: "g" });
eq(app.parseAmountUnit("1.5 kg"), { amount: 1500, unit: "g" });
eq(app.parseAmountUnit("8 oz"), { amount: 227, unit: "g" });
assert.strictEqual(app.parseAmountUnit(""), null);
assert.strictEqual(app.parseAmountUnit(null), null);
assert.strictEqual(app.parseAmountUnit("no amount here"), null);

/* ---------- offServing ---------- */
// Fresca-shaped product: quantity carries the size, packaging the word.
eq(
  app.offServing({ serving_size: "", serving_quantity: null, quantity: "355 mL", packaging: "can, box" }),
  { amount: 355, unit: "ml", label: "can" }
);
// Explicit serving size wins.
eq(
  app.offServing({ serving_size: "250 g", quantity: "500 g" }),
  { amount: 250, unit: "g", label: null }
);
// serving_quantity on a drink container is treated as ml.
eq(
  app.offServing({ serving_quantity: 330, packaging: "bottle" }),
  { amount: 330, unit: "ml", label: "bottle" }
);
// Multi-pack quantity "6 x 355 mL" resolves to the unit size.
eq(
  app.offServing({ quantity: "6 x 355 mL", packaging: "can" }),
  { amount: 355, unit: "ml", label: "can" }
);
assert.strictEqual(app.offServing({}), null);

/* ---------- usdaServing ---------- */
eq(app.usdaServing({ servingSize: 240, servingSizeUnit: "ml" }), { amount: 240, unit: "ml", label: null });
eq(app.usdaServing({ servingSize: 30, servingSizeUnit: "g" }), { amount: 30, unit: "g", label: null });
assert.strictEqual(app.usdaServing({ servingSize: 1, servingSizeUnit: "cup" }), null);
assert.strictEqual(app.usdaServing({}), null);

/* ---------- scaledNutrients / entryAmountText ---------- */
const per100 = { kcal: 200, protein: 10, carbs: 20, fat: 5, micros: app.emptyMicros() };
per100.micros.fiber = 4;
const scaled = app.scaledNutrients(per100, 150);
assert.strictEqual(scaled.kcal, 300);
assert.strictEqual(scaled.micros.fiber, 6);

// A logged can shows the friendly serving text, not raw grams.
const canEntry = {
  grams: 355, dispQty: 1, dispUnit: "serving",
  servingLabel: "can", servingAmount: 355, servingUnit: "ml"
};
assert.strictEqual(app.entryAmountText(canEntry), "1 can · 12 fl oz");
assert.strictEqual(app.entryAmountText({ grams: 240, dispQty: 12, dispUnit: "oz" }), "12 fl oz");
assert.strictEqual(app.entryAmountText({ grams: 100 }), "100 g");

/* ---------- Existing-data compatibility ----------
   A state blob in the exact shape the previous version saved must load
   with every field intact, including serving snapshots on entries. */
const v9State = {
  settings: {
    target: 2100, unit: "lb", language: "en", goal: "maintain", onboarded: true,
    theme: "ocean", waterGoalMl: 2500, currentWeightKg: 80, targetWeightKg: 75
  },
  entries: {
    "2026-11-01": [{
      id: "1730000000000-1", name: "Fresca", brand: "Fresca", meal: "Lunch", grams: 355,
      per100: { kcal: 3, protein: 0, carbs: 1, fat: 0, micros: app.emptyMicros() },
      dispQty: 1, dispUnit: "serving", servingLabel: "can", servingAmount: 355, servingUnit: "ml"
    }]
  },
  weights: [{ date: "2026-11-01", kg: 80 }],
  water: { "2026-11-01": 500 },
  planner: { mealsPerDay: 3, ingredients: ["eggs"] }
};
const seeded = loadApp({ "calorie-counter-test-v1": JSON.stringify(v9State) });
assert.strictEqual(seeded.state.settings.target, 2100);
assert.strictEqual(seeded.state.settings.theme, "ocean");
const kept = seeded.state.entries["2026-11-01"][0];
assert.strictEqual(kept.name, "Fresca");
assert.strictEqual(kept.servingLabel, "can");
assert.strictEqual(kept.servingAmount, 355);
assert.ok(Math.abs(seeded.totalsFor("2026-11-01").kcal - 3 * 3.55) < 1e-9);
assert.strictEqual(seeded.state.water["2026-11-01"], 500);
eq(seeded.state.planner.ingredients, ["eggs"]);

console.log("serving.test.js: all tests passed");
