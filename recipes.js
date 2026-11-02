"use strict";

/* Recipe math for the recipe builder: pure functions with no DOM access,
   shared by app.js in the browser and by the node unit tests.
   An ingredient is { per100: {kcal, protein, carbs, fat, micros}, grams }.
   A recipe is { name, servings, ingredients: [...] }.
   MICRO_KEYS must stay in sync with MICROS in app.js (a test checks this). */
(function (root) {
  var MICRO_KEYS = ["fiber", "iron", "calcium", "vitA", "vitC", "vitD", "b12", "folate", "potassium"];

  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }

  function emptyMicros() {
    var m = {};
    MICRO_KEYS.forEach(function (k) { m[k] = 0; });
    return m;
  }

  function scalePer100(per100, grams) {
    var f = num(grams) / 100;
    var m = emptyMicros();
    var src = (per100 && per100.micros) || {};
    MICRO_KEYS.forEach(function (k) { m[k] = num(src[k]) * f; });
    return {
      kcal: num(per100 && per100.kcal) * f,
      protein: num(per100 && per100.protein) * f,
      carbs: num(per100 && per100.carbs) * f,
      fat: num(per100 && per100.fat) * f,
      micros: m
    };
  }

  function addInto(total, s) {
    total.kcal += s.kcal;
    total.protein += s.protein;
    total.carbs += s.carbs;
    total.fat += s.fat;
    MICRO_KEYS.forEach(function (k) { total.micros[k] += s.micros[k]; });
    return total;
  }

  function recipeTotals(recipe) {
    var total = { kcal: 0, protein: 0, carbs: 0, fat: 0, micros: emptyMicros() };
    ((recipe && recipe.ingredients) || []).forEach(function (ing) {
      addInto(total, scalePer100(ing.per100, ing.grams));
    });
    return total;
  }

  function recipePerServing(recipe) {
    var servings = Number(recipe && recipe.servings);
    if (!(servings > 0)) servings = 1;
    var t = recipeTotals(recipe);
    var m = emptyMicros();
    MICRO_KEYS.forEach(function (k) { m[k] = t.micros[k] / servings; });
    return {
      kcal: t.kcal / servings,
      protein: t.protein / servings,
      carbs: t.carbs / servings,
      fat: t.fat / servings,
      micros: m
    };
  }

  /* Build a log entry for qty servings of a recipe. The entry's per100
     holds one serving's nutrition and grams = 100 * qty, so the app's
     standard scaledNutrients() reproduces exactly qty servings, and
     fractions like 0.5 work. recipeServing flags entryAmountText(). */
  function recipeEntry(recipe, qty, meal, id) {
    var q = Number(qty);
    if (!(q > 0)) q = 1;
    return {
      id: id,
      name: recipe.name,
      brand: "",
      meal: meal,
      grams: Math.max(1, Math.round(100 * q)),
      per100: recipePerServing(recipe),
      dispQty: q,
      dispUnit: "serving",
      recipeServing: true
    };
  }

  var api = {
    MICRO_KEYS: MICRO_KEYS,
    emptyMicros: emptyMicros,
    scalePer100: scalePer100,
    recipeTotals: recipeTotals,
    recipePerServing: recipePerServing,
    recipeEntry: recipeEntry
  };
  root.Recipes = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
