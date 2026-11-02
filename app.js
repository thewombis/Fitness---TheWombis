"use strict";

/* Calorie Counter — full production build (client-side).
   Data sources: Open Food Facts and USDA FoodData Central public APIs.
   Persistence: browser localStorage (logs, settings, water, planner)
   and IndexedDB (progress photos, handled in photos.js). No accounts,
   no server: everything stays on the visitor's device. */

var LS_KEY = "calorie-counter-test-v1"; // kept from the first build so existing logs carry over
var MEALS = ["Breakfast", "Lunch", "Dinner", "Snack"];
var LB_PER_KG = 2.2046226218;
var ML_PER_OZ = 29.5735;

/* Micronutrients tracked, with display unit and daily target.
   Internal storage units (per 100 g of food):
   fiber g, iron mg, calcium mg, vitA µg, vitC mg, vitD µg, b12 µg, folate µg, potassium mg. */
var MICROS = [
  { key: "fiber",     name: "Fiber",      unit: "g",  target: 28 },
  { key: "iron",      name: "Iron",       unit: "mg", target: 18 },
  { key: "calcium",   name: "Calcium",    unit: "mg", target: 1000 },
  { key: "vitA",      name: "Vitamin A",  unit: "µg", target: 900 },
  { key: "vitC",      name: "Vitamin C",  unit: "mg", target: 90 },
  { key: "vitD",      name: "Vitamin D",  unit: "µg", target: 20 },
  { key: "b12",       name: "Vitamin B12", unit: "µg", target: 2.4 },
  { key: "folate",    name: "Folate",     unit: "µg", target: 400 },
  { key: "potassium", name: "Potassium",  unit: "mg", target: 3500 }
];

function emptyMicros() {
  return { fiber: 0, iron: 0, calcium: 0, vitA: 0, vitC: 0, vitD: 0, b12: 0, folate: 0, potassium: 0 };
}

/* ---------- Date helpers ---------- */
function todayStr(d) {
  var dt = d ? new Date(d) : new Date();
  var m = String(dt.getMonth() + 1).padStart(2, "0");
  var day = String(dt.getDate()).padStart(2, "0");
  return dt.getFullYear() + "-" + m + "-" + day;
}

function shiftDate(dateStr, days) {
  var parts = dateStr.split("-").map(Number);
  var dt = new Date(parts[0], parts[1] - 1, parts[2] + days);
  return todayStr(dt);
}

function prettyDate(dateStr) {
  var parts = dateStr.split("-").map(Number);
  var dt = new Date(parts[0], parts[1] - 1, parts[2]);
  return dt.toLocaleDateString(localeTag(), { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

/* ---------- Internationalization ----------
   UI strings live in i18n.js (window.I18N / window.i18nLookup), keyed by
   settings.language with English fallback. Static HTML carries
   data-i18n / data-i18n-ph / data-i18n-aria / data-i18n-alt attributes;
   dynamic strings call t(). Food names and database content are never
   translated. Meal names are stored canonically in English and only
   their display is translated (mealLabel). */
var LOCALES = { en: "en-US", es: "es-ES", fr: "fr-FR", de: "de-DE", pt: "pt-BR", it: "it-IT", zh: "zh-CN", ja: "ja-JP" };
function localeTag() {
  var lang = (typeof state !== "undefined" && state.settings && state.settings.language) || "en";
  return LOCALES[lang] || "en-US";
}
function t(key, vars) {
  if (window.i18nLookup) return window.i18nLookup(state.settings.language || "en", key, vars);
  return key;
}
var MEAL_KEYS = {
  "Breakfast": "meal.breakfast", "Lunch": "meal.lunch", "Dinner": "meal.dinner", "Snack": "meal.snack",
  "Morning snack": "meal.morningSnack", "Afternoon snack": "meal.afternoonSnack",
  "Evening snack": "meal.eveningSnack", "Pre-workout snack": "meal.preworkoutSnack"
};
function mealLabel(meal) {
  var k = MEAL_KEYS[meal];
  return k ? t(k) : meal;
}
function applyI18n() {
  if (!window.I18N) return;
  var lang = state.settings.language || "en";
  document.querySelectorAll("[data-i18n]").forEach(function (el) {
    el.textContent = window.i18nLookup(lang, el.getAttribute("data-i18n"));
  });
  document.querySelectorAll("[data-i18n-ph]").forEach(function (el) {
    el.setAttribute("placeholder", window.i18nLookup(lang, el.getAttribute("data-i18n-ph")));
  });
  document.querySelectorAll("[data-i18n-aria]").forEach(function (el) {
    el.setAttribute("aria-label", window.i18nLookup(lang, el.getAttribute("data-i18n-aria")));
  });
  document.querySelectorAll("[data-i18n-alt]").forEach(function (el) {
    el.setAttribute("alt", window.i18nLookup(lang, el.getAttribute("data-i18n-alt")));
  });
  document.title = window.i18nLookup(lang, "app.title");
}

/* ---------- Small utilities ---------- */
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function round1(n) { return Math.round(n * 10) / 10; }
function $(id) { return document.getElementById(id); }
function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }

/* ---------- State ---------- */
function defaultState() {
  return {
    settings: {
      target: 2000, unit: "lb", language: "en", goal: "maintain", onboarded: false,
      targetWeightKg: null, currentWeightKg: null,
      waterGoalMl: 2000, theme: "meadow"
    },
    entries: {},   // { "YYYY-MM-DD": [ {id, name, brand, meal, grams, per100:{kcal,protein,carbs,fat,micros}} ] }
    weights: [],   // [ {date:"YYYY-MM-DD", kg:Number} ]
    water: {},     // { "YYYY-MM-DD": totalMl }
    planner: { mealsPerDay: 3, ingredients: [] }
  };
}

function loadState() {
  var base = defaultState();
  try {
    var raw = localStorage.getItem(LS_KEY);
    if (!raw) return base;
    var parsed = JSON.parse(raw);
    base.settings = Object.assign(base.settings, parsed.settings || {});
    base.entries = parsed.entries || {};
    base.weights = Array.isArray(parsed.weights) ? parsed.weights : [];
    base.water = parsed.water || {};
    if (parsed.planner) base.planner = Object.assign(base.planner, parsed.planner);
    return base;
  } catch (e) {
    return base;
  }
}

var state = loadState();
var selectedDate = todayStr();   // day shown in Log / Trends micronutrients
var waterDate = todayStr();      // day shown in Water
var trendsRange = 14;            // calorie chart range
var calCursor = { y: new Date().getFullYear(), m: new Date().getMonth() };

function saveState() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) { /* storage full or blocked */ }
}

/* ---------- Extra on-device stores ----------
   Favorites, recents, recipes, fasting and reminders each live under their
   own localStorage key, so the main state object (and existing user data)
   is never reshaped. Every store is included in Settings backups and is
   cleared by the Settings erase-all flow. */
var FAV_KEY = "cc-favorites-v1";
var RECENT_KEY = "cc-recents-v1";
var RECIPE_KEY = "cc-recipes-v1";
var FAST_KEY = "cc-fasting-v1";
var REMINDER_KEY = "cc-reminders-v1";
var EXTRA_KEYS = [FAV_KEY, RECENT_KEY, RECIPE_KEY, FAST_KEY, REMINDER_KEY];

function loadJSON(key, fallback) {
  try {
    var raw = localStorage.getItem(key);
    if (!raw) return fallback;
    var v = JSON.parse(raw);
    return v == null ? fallback : v;
  } catch (e) { return fallback; }
}
function saveJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage full or blocked */ }
}

var favorites = loadJSON(FAV_KEY, []);
if (!Array.isArray(favorites)) favorites = [];
var recents = loadJSON(RECENT_KEY, []);
if (!Array.isArray(recents)) recents = [];
var myRecipes = loadJSON(RECIPE_KEY, []);
if (!Array.isArray(myRecipes)) myRecipes = [];
var fastingStore = loadJSON(FAST_KEY, null);
if (!fastingStore || typeof fastingStore !== "object" || !Array.isArray(fastingStore.history)) {
  fastingStore = { current: null, history: [] };
}
var reminderCfg = Object.assign(
  { enabled: false, lunch: "12:30", dinner: "18:30", lastFired: {} },
  loadJSON(REMINDER_KEY, {})
);
if (!reminderCfg.lastFired || typeof reminderCfg.lastFired !== "object") reminderCfg.lastFired = {};

/* A "snapshot" is everything needed to re-log a food in one tap: its
   per-100 g nutrition, its serving (if any), and the amount last chosen. */
function foodKey(food) {
  return (String(food.name || "") + "|" + String(food.brand || "")).toLowerCase();
}
function foodSnapshot(food, grams, disp) {
  var per100 = { kcal: food.per100.kcal, protein: food.per100.protein, carbs: food.per100.carbs, fat: food.per100.fat, micros: Object.assign({}, food.per100.micros || {}) };
  return {
    key: foodKey(food),
    name: food.name,
    brand: food.brand || "",
    source: food.source || "",
    per100: per100,
    serving: food.serving ? { amount: food.serving.amount, unit: food.serving.unit, label: food.serving.label || null } : null,
    grams: grams || null,
    disp: disp || null
  };
}
function snapshotFromEntry(it) {
  var serving = null;
  if (it.servingAmount) serving = { amount: it.servingAmount, unit: it.servingUnit || "g", label: it.servingLabel || null };
  var disp = it.dispUnit ? { qty: it.dispQty, unit: it.dispUnit } : null;
  return foodSnapshot({ name: it.name, brand: it.brand, per100: it.per100, serving: serving }, it.grams, disp);
}
function isFavorite(food) {
  var k = foodKey(food);
  return favorites.some(function (f) { return f.key === k; });
}
function toggleFavorite(snap) {
  var i = favorites.findIndex(function (f) { return f.key === snap.key; });
  if (i >= 0) favorites.splice(i, 1); else favorites.push(snap);
  saveJSON(FAV_KEY, favorites);
  return i < 0; /* true if now a favorite */
}
function pushRecent(snap) {
  recents = recents.filter(function (r) { return r.key !== snap.key; });
  recents.unshift(snap);
  if (recents.length > 20) recents.length = 20;
  saveJSON(RECENT_KEY, recents);
}
function snapshotGrams(snap) {
  if (snap.disp) {
    if (snap.disp.unit === "serving" && snap.serving) return snap.disp.qty * snap.serving.amount;
    if (snap.disp.unit === "oz") return snap.disp.qty * ML_PER_OZ;
    if (snap.disp.unit === "ml") return snap.disp.qty;
    if (snap.disp.unit === "g") return snap.disp.qty;
  }
  if (snap.grams) return snap.grams;
  if (snap.serving) return snap.serving.amount;
  return 100;
}
function snapshotAmountText(snap) {
  var it = { grams: snapshotGrams(snap) };
  if (snap.disp) {
    it.dispQty = snap.disp.qty;
    it.dispUnit = snap.disp.unit;
    if (snap.disp.unit === "serving" && snap.serving) {
      it.servingAmount = snap.serving.amount;
      it.servingUnit = snap.serving.unit;
      it.servingLabel = snap.serving.label;
    }
  }
  return entryAmountText(it);
}
function logSnapshot(snap) {
  var food = { name: snap.name, brand: snap.brand, source: snap.source || "", per100: snap.per100, serving: snap.serving || null };
  addEntry(food, snapshotGrams(snap), snap.disp || null);
}

function unitLabel() { return state.settings.unit === "kg" ? "kg" : "lb"; }
function toDisplayWeight(kg) { return state.settings.unit === "kg" ? kg : kg * LB_PER_KG; }
function fromDisplayWeight(v) { return state.settings.unit === "kg" ? v : v / LB_PER_KG; }

/* ---------- Nutrition math ---------- */
function scaledNutrients(per100, grams) {
  var f = grams / 100;
  var out = {
    kcal: num(per100.kcal) * f,
    protein: num(per100.protein) * f,
    carbs: num(per100.carbs) * f,
    fat: num(per100.fat) * f,
    micros: emptyMicros()
  };
  var src = per100.micros || {};
  MICROS.forEach(function (m) { out.micros[m.key] = num(src[m.key]) * f; });
  return out;
}

function entriesFor(dateStr) { return state.entries[dateStr] || []; }

function totalsFor(dateStr) {
  var t = { kcal: 0, protein: 0, carbs: 0, fat: 0, micros: emptyMicros() };
  entriesFor(dateStr).forEach(function (it) {
    var s = scaledNutrients(it.per100, it.grams);
    t.kcal += s.kcal; t.protein += s.protein; t.carbs += s.carbs; t.fat += s.fat;
    MICROS.forEach(function (m) { t.micros[m.key] += s.micros[m.key]; });
  });
  return t;
}

function dayEntries() { return entriesFor(selectedDate); }
function dayTotals() { return totalsFor(selectedDate); }

/* ---------- Tabs ---------- */
var currentTab = "home";
function switchTab(name) {
  currentTab = name;
  document.querySelectorAll(".tab-btn").forEach(function (b) {
    b.classList.toggle("active", b.getAttribute("data-tab") === name);
  });
  document.querySelectorAll(".tab-page").forEach(function (p) { p.hidden = true; });
  var page = $("tab-" + name);
  if (page) page.hidden = false;
  if (name !== "workouts" && window.Workouts) window.Workouts.setActive(false);
  if (name === "workouts" && window.Workouts) window.Workouts.setActive(true);
  if (name !== "log") stopScan();
  if (name !== "photos" && window.Photos) window.Photos.stopCamera();
}

/* ---------- Home: today ring, streak, average, calendar ---------- */
var RING_C = 2 * Math.PI * 74;

function renderHome() {
  var today = todayStr();
  var totals = totalsFor(today);
  var target = state.settings.target || 2000;
  var remaining = target - totals.kcal;
  var frac = Math.max(0, Math.min(1, totals.kcal / target));

  var fg = $("ring-fg");
  fg.style.strokeDasharray = RING_C.toFixed(1);
  fg.style.strokeDashoffset = (RING_C * (1 - frac)).toFixed(1);
  fg.style.stroke = remaining < 0 ? "var(--danger)" : "";

  $("ring-remaining").textContent = String(Math.round(Math.abs(remaining)));
  $("ring-remaining").parentElement.querySelector(".ring-label").textContent =
    remaining < 0 ? t("home.ringOver") : t("home.ringRemaining");
  $("stat-target").textContent = String(target);
  var goalTxt = { lose: t("home.goalLose"), maintain: t("home.goalMaintain"), gain: t("home.goalGain") }[state.settings.goal] || t("home.goalMaintain");
  if (state.settings.currentWeightKg != null && state.settings.targetWeightKg != null) {
    goalTxt += t("home.toGoSuffix", { amt: round1(Math.abs(toDisplayWeight(state.settings.currentWeightKg) - toDisplayWeight(state.settings.targetWeightKg))), unit: unitLabel() });
  }
  $("home-goal").textContent = goalTxt;
  $("stat-eaten").textContent = String(Math.round(totals.kcal));
  var itemCount = entriesFor(today).length;
  $("home-items").textContent = itemCount === 1 ? t("home.item1") : t("home.itemsN", { n: itemCount });

  $("val-protein").textContent = round1(totals.protein) + " g";
  $("val-carbs").textContent = round1(totals.carbs) + " g";
  $("val-fat").textContent = round1(totals.fat) + " g";
  var pK = totals.protein * 4, cK = totals.carbs * 4, fK = totals.fat * 9;
  var mTotal = pK + cK + fK;
  function pct(x) { return mTotal > 0 ? Math.round((x / mTotal) * 100) : 0; }
  $("bar-protein").style.width = pct(pK) + "%";
  $("bar-carbs").style.width = pct(cK) + "%";
  $("bar-fat").style.width = pct(fK) + "%";

  // Streak: consecutive logged days ending today (or yesterday if today is empty so far)
  var streak = 0;
  var d = today;
  if (!entriesFor(d).length) d = shiftDate(d, -1);
  while (entriesFor(d).length) { streak++; d = shiftDate(d, -1); }
  $("home-streak").textContent = streak === 1 ? t("home.streak1") : t("home.streakN", { n: streak });

  // 7-day average over logged days in the last 7 days (including today)
  var sum = 0, logged = 0;
  for (var i = 0; i < 7; i++) {
    var ds = shiftDate(today, -i);
    if (entriesFor(ds).length) { sum += totalsFor(ds).kcal; logged++; }
  }
  $("home-avg7").textContent = logged ? Math.round(sum / logged) + " kcal" : "—";

  renderCalendar();
}

function renderCalendar() {
  var y = calCursor.y, m = calCursor.m;
  $("cal-title").textContent = new Date(y, m, 1).toLocaleDateString(localeTag(), { month: "long" }) + " " + y;
  var first = new Date(y, m, 1);
  var startOffset = (first.getDay() + 6) % 7; // Monday-first
  var daysInMonth = new Date(y, m + 1, 0).getDate();
  var today = todayStr();
  var html = "";
  for (var i = 0; i < startOffset; i++) html += '<span class="cal-cell empty"></span>';
  for (var day = 1; day <= daysInMonth; day++) {
    var ds = y + "-" + String(m + 1).padStart(2, "0") + "-" + String(day).padStart(2, "0");
    var entries = entriesFor(ds);
    var kcal = entries.length ? Math.round(totalsFor(ds).kcal) : null;
    var cls = "cal-cell" + (ds === today ? " today" : "") + (ds === selectedDate ? " selected" : "");
    html += '<button type="button" class="' + cls + '" data-cal-day="' + ds + '">' +
      '<span class="cal-daynum">' + day + "</span>" +
      (kcal != null ? '<span class="cal-kcal">' + kcal + " kcal</span>" : '<span class="cal-kcal">&nbsp;</span>') +
      "</button>";
  }
  $("cal-grid").innerHTML = html;
  $("cal-grid").querySelectorAll("[data-cal-day]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      selectedDate = btn.getAttribute("data-cal-day");
      renderAll();
      switchTab("log");
    });
  });
}

/* ---------- Log tab ---------- */
function renderLogSummary() {
  var t2 = dayTotals();
  $("log-day-summary").textContent = t("log.daySummary", {
    date: prettyDate(selectedDate), kcal: Math.round(t2.kcal),
    p: round1(t2.protein), c: round1(t2.carbs), f: round1(t2.fat)
  });
  $("day-picker").value = selectedDate;
}

function renderLog() {
  renderLogSummary();
  renderCopyYesterday();
  var list = $("log-list");
  var items = dayEntries();
  $("log-empty").style.display = items.length ? "none" : "block";
  var html = "";
  MEALS.forEach(function (meal) {
    var mealItems = items.filter(function (i) { return i.meal === meal; });
    if (!mealItems.length) return;
    var mealKcal = 0;
    var rows = "";
    mealItems.forEach(function (it) {
      var s = scaledNutrients(it.per100, it.grams);
      mealKcal += s.kcal;
      var fav = isFavorite(it);
      rows += '<div class="log-item"><div>' +
        '<span class="log-name">' + esc(it.name) + "</span> " +
        '<span class="log-meta">' + (it.brand ? esc(it.brand) + " · " : "") + entryAmountText(it) + " · P " +
        round1(s.protein) + " · C " + round1(s.carbs) + " · F " + round1(s.fat) + "</span></div>" +
        '<div><span class="log-kcal">' + Math.round(s.kcal) + " kcal</span>" +
        '<button type="button" class="fav-btn" data-fav-entry="' + it.id + '" aria-pressed="' + fav + '" aria-label="' + esc(t("aria.favToggle", { name: it.name })) + '" title="Favorite">' + (fav ? "★" : "☆") + "</button>" +
        '<button type="button" class="log-remove" data-remove="' + it.id + '" aria-label="' + esc(t("aria.remove", { name: it.name })) + '">&times;</button></div></div>';
    });
    html += '<div class="meal-group"><h3>' + mealLabel(meal) + ' <span class="meal-kcal">' + Math.round(mealKcal) + " kcal</span></h3>" + rows + "</div>";
  });
  list.innerHTML = html;
  list.querySelectorAll("[data-remove]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = btn.getAttribute("data-remove");
      state.entries[selectedDate] = dayEntries().filter(function (i) { return String(i.id) !== String(id); });
      saveState(); renderAll();
    });
  });
  list.querySelectorAll("[data-fav-entry]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = btn.getAttribute("data-fav-entry");
      var it = dayEntries().filter(function (i) { return String(i.id) === String(id); })[0];
      if (!it) return;
      toggleFavorite(snapshotFromEntry(it));
      renderAll();
    });
  });
}

/* ---------- Search: Open Food Facts ----------
   OFF nutriments are per 100 g. Macros are in grams. Micronutrients in the
   OFF nutriments object are also expressed in grams per 100 g, so:
   g -> mg multiplies by 1,000 and g -> µg multiplies by 1,000,000. */
function offMicros(n) {
  var mi = emptyMicros();
  if (!n) return mi;
  mi.fiber = num(n["fiber_100g"]);
  mi.iron = num(n["iron_100g"]) * 1000;
  mi.calcium = num(n["calcium_100g"]) * 1000;
  mi.vitA = num(n["vitamin-a_100g"]) * 1000000;
  mi.vitC = num(n["vitamin-c_100g"]) * 1000;
  mi.vitD = num(n["vitamin-d_100g"]) * 1000000;
  mi.b12 = num(n["vitamin-b12_100g"]) * 1000000; // B12 is its own field — never vitamin-b6
  mi.folate = num(n["vitamin-b9_100g"]) * 1000000; // folate = vitamin B9
  mi.potassium = num(n["potassium_100g"]) * 1000;
  return mi;
}

/* ---------- Servings & display amounts ----------
   Packaged foods and drinks carry a natural serving (a can, a bottle,
   355 ml). Grams stay the math unit underneath; the entry also remembers
   how the user expressed the amount so the log can show "1 can" or
   "12 fl oz" instead of "355 g". For drinks, 1 ml counts as 1 g — the
   same convention Open Food Facts uses for beverages. */
var CONTAINER_WORDS = ["can", "bottle", "box", "bag", "pack", "packet", "pouch", "bar", "piece", "cup", "carton", "jar", "tin", "container", "sachet", "stick", "slice"];
var DRINK_CONTAINERS = ["can", "bottle", "carton", "jar", "pouch"];

function containerWord(text) {
  var s = String(text || "").toLowerCase();
  for (var i = 0; i < CONTAINER_WORDS.length; i++) {
    if (new RegExp("\\b" + CONTAINER_WORDS[i] + "s?\\b").test(s)) return CONTAINER_WORDS[i];
  }
  return null;
}

function parseAmountUnit(str) {
  if (!str) return null;
  var m = String(str).toLowerCase().match(/([\d]+(?:[.,]\d+)?)\s*(ml|cl|l|kg|g|fl oz|oz)\b/);
  if (!m) return null;
  var v = parseFloat(m[1].replace(",", "."));
  if (!(v > 0)) return null;
  switch (m[2]) {
    case "ml": return { amount: Math.round(v), unit: "ml" };
    case "cl": return { amount: Math.round(v * 10), unit: "ml" };
    case "l": return { amount: Math.round(v * 1000), unit: "ml" };
    case "fl oz": return { amount: Math.round(v * ML_PER_OZ), unit: "ml" };
    case "g": return { amount: Math.round(v), unit: "g" };
    case "kg": return { amount: Math.round(v * 1000), unit: "g" };
    case "oz": return { amount: Math.round(v * 28.3495), unit: "g" };
  }
  return null;
}

function offServing(p) {
  var label = containerWord([p.serving_size || "", p.packaging || "", p.quantity || ""].join(" "));
  var s = parseAmountUnit(p.serving_size);
  if (!s && Number(p.serving_quantity) > 0) {
    s = { amount: Math.round(Number(p.serving_quantity)), unit: label && DRINK_CONTAINERS.indexOf(label) >= 0 ? "ml" : "g" };
  }
  if (!s) {
    var q = String(p.quantity || "");
    var multi = q.match(/\d+\s*[x×]\s*(.+)$/);
    s = parseAmountUnit(multi ? multi[1] : q);
  }
  if (!s && Number(p.product_quantity) > 0) {
    s = { amount: Math.round(Number(p.product_quantity)), unit: p.product_quantity_unit === "ml" ? "ml" : "g" };
  }
  if (!s || !(s.amount > 0)) return null;
  return { amount: s.amount, unit: s.unit, label: label };
}

function usdaServing(f) {
  var v = Number(f.servingSize);
  if (!(v > 0)) return null;
  var u = String(f.servingSizeUnit || "").toLowerCase();
  var unit = u.indexOf("ml") >= 0 ? "ml" : (u === "g" || u.indexOf("gram") >= 0 ? "g" : null);
  if (!unit) return null;
  return { amount: Math.round(v), unit: unit, label: containerWord(f.householdServingFullText || "") };
}

function volumeText(ml) {
  return waterImperial() ? round1(ml / ML_PER_OZ) + " fl oz" : Math.round(ml) + " ml";
}

function entryAmountText(it) {
  if (it.recipeServing) return it.dispQty === 1 ? t("entry.recipeServing1") : t("entry.recipeServingN", { qty: round1(it.dispQty) });
  if (it.dispUnit === "serving" && it.servingAmount) {
    var base = it.servingUnit === "ml" ? volumeText(it.servingAmount) : it.servingAmount + " g";
    var lab = it.servingLabel || t("res.servingWord");
    var word = it.dispQty === 1 || !it.servingLabel ? lab : lab + (/(s|x|ch|sh)$/.test(lab) ? "es" : "s");
    return round1(it.dispQty) + " " + word + " · " + base;
  }
  if (it.dispUnit === "oz") return round1(it.dispQty) + " fl oz";
  if (it.dispUnit === "ml") return Math.round(it.dispQty) + " ml";
  if (it.dispUnit === "g") return Math.round(it.dispQty) + " g";
  return it.grams + " g";
}

function offNutrients(n) {
  if (!n) return null;
  var kcal = n["energy-kcal_100g"];
  if (kcal == null && n["energy_100g"] != null) kcal = n["energy_100g"] / 4.184; // kJ to kcal
  if (kcal == null) return null;
  return {
    kcal: num(kcal),
    protein: num(n["proteins_100g"]),
    carbs: num(n["carbohydrates_100g"]),
    fat: num(n["fat_100g"]),
    micros: offMicros(n)
  };
}

function searchOFF(query) {
  var url = "https://world.openfoodfacts.org/cgi/search.pl?action=process&json=1&page_size=12" +
    "&fields=code,product_name,brands,nutriments,serving_size,serving_quantity,quantity,packaging,product_quantity,product_quantity_unit&search_terms=" + encodeURIComponent(query);
  return fetch(url).then(function (r) { return r.json(); }).then(function (data) {
    var out = [];
    (data.products || []).forEach(function (p) {
      var per100 = offNutrients(p.nutriments);
      if (!per100 || !p.product_name) return;
      out.push({ name: p.product_name, brand: p.brands || "", source: "Open Food Facts", per100: per100, serving: offServing(p) });
    });
    return out;
  });
}

/* ---------- Search: USDA FoodData Central (DEMO_KEY, rate-limited) ----------
   USDA nutrient IDs: 203 protein, 204 fat, 205 carbs, 208/957/958 energy,
   291 fiber, 301 calcium, 303 iron, 306 potassium, 320 vitamin A (RAE, µg),
   401 vitamin C (mg), 328 vitamin D (µg), 417 folate (µg), 418 vitamin B-12 (µg).
   Note: 415 is vitamin B-6 — it is NOT B12 and is deliberately not used. */
function searchUSDA(query) {
  var url = "https://api.nal.usda.gov/fdc/v1/foods/search?api_key=DEMO_KEY&pageSize=8&query=" + encodeURIComponent(query);
  return fetch(url).then(function (r) {
    if (!r.ok) throw new Error("USDA " + r.status);
    return r.json();
  }).then(function (data) {
    var out = [];
    (data.foods || []).forEach(function (f) {
      var per100 = { kcal: null, protein: 0, carbs: 0, fat: 0, micros: emptyMicros() };
      (f.foodNutrients || []).forEach(function (n) {
        var v = num(n.value);
        switch (n.nutrientId) {
          case 208: case 957: case 958: per100.kcal = v; break;
          case 203: per100.protein = v; break;
          case 204: per100.fat = v; break;
          case 205: per100.carbs = v; break;
          case 291: per100.micros.fiber = v; break;
          case 301: per100.micros.calcium = v; break;
          case 303: per100.micros.iron = v; break;
          case 306: per100.micros.potassium = v; break;
          case 320: per100.micros.vitA = v; break;
          case 401: per100.micros.vitC = v; break;
          case 328: per100.micros.vitD = v; break;
          case 417: per100.micros.folate = v; break;
          case 418: per100.micros.b12 = v; break;
        }
      });
      if (per100.kcal == null || !f.description) return;
      out.push({ name: f.description, brand: f.brandName || "USDA generic", source: "USDA", per100: per100, serving: usdaServing(f) });
    });
    return out;
  });
}

function servingDisplay(sv) {
  var amt = sv.unit === "ml" ? volumeText(sv.amount) : sv.amount + " g";
  return sv.label ? "1 " + sv.label + " · " + amt : amt;
}

/* Read the amount controls of a result row (main search uses ids qty-N /
   unit-N / grams-N; the recipe builder uses the r- prefixed equivalents)
   and return { grams, disp } for addEntry(). */
function amountFromControls(food, qtyId, unitId, gramsId) {
  var grams, disp = null;
  if (food.serving) {
    var q = Number($(qtyId).value);
    if (!(q > 0)) q = 1;
    var mode = $(unitId).value;
    if (mode === "serving") {
      grams = q * food.serving.amount;
      disp = { qty: q, unit: "serving" };
    } else if (mode === "volume") {
      grams = waterImperial() ? q * ML_PER_OZ : q;
      disp = { qty: q, unit: waterImperial() ? "oz" : "ml" };
    } else {
      grams = q;
      disp = { qty: q, unit: "g" };
    }
  } else {
    grams = Number($(gramsId).value) || 100;
  }
  return { grams: grams, disp: disp };
}

function renderResults(results) {
  var ul = $("search-results");
  if (!results.length) { ul.innerHTML = ""; return; }
  ul.innerHTML = results.map(function (r, idx) {
    var meta = (r.brand ? esc(r.brand) + " · " : "") +
      Math.round(r.per100.kcal) + " kcal · P " + round1(r.per100.protein) + " · C " + round1(r.per100.carbs) +
      " · F " + round1(r.per100.fat) + " " + (r.serving && r.serving.unit === "ml" ? t("res.per100ml") : t("res.per100g"));
    if (r.serving) meta += " · " + esc(t("res.serving", { s: servingDisplay(r.serving) }));
    var control;
    if (r.serving) {
      var amtTxt = r.serving.unit === "ml" ? volumeText(r.serving.amount) : r.serving.amount + " g";
      var opts = '<option value="serving">' + esc(r.serving.label || t("res.servingWord")) + " · " + esc(amtTxt) + "</option>";
      if (r.serving.unit === "ml") opts += '<option value="volume">' + (waterImperial() ? "fl oz" : "ml") + "</option>";
      opts += '<option value="g">' + esc(t("res.gramsOpt")) + "</option>";
      control = '<input type="number" class="result-qty" id="qty-' + idx + '" value="1" min="0" step="0.5" aria-label="' + esc(t("aria.qty")) + '"> ' +
        '<select class="result-unit" id="unit-' + idx + '" aria-label="' + esc(t("aria.amountUnit")) + '">' + opts + "</select>";
    } else {
      control = '<input type="number" class="result-grams" id="grams-' + idx + '" value="100" min="1" step="1" aria-label="' + esc(t("aria.grams")) + '"> g';
    }
    var fav = isFavorite(r);
    return '<li class="result"><div class="result-main">' +
      '<span class="result-name">' + esc(r.name) + "</span> " +
      '<span class="source-tag">' + esc(r.source) + "</span>" +
      '<div class="result-meta">' + meta + "</div></div>" +
      control +
      '<button type="button" class="fav-btn" data-fav="' + idx + '" aria-pressed="' + fav + '" aria-label="' + esc(t("aria.favToggle", { name: r.name })) + '" title="Favorite">' + (fav ? "★" : "☆") + "</button>" +
      '<button type="button" class="btn btn-primary btn-small" data-add="' + idx + '"><svg width="24" height="24" class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span>' + esc(t("common.add")) + "</span></button></li>";
  }).join("");
  ul.querySelectorAll("[data-add]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var idx = Number(btn.getAttribute("data-add"));
      var food = results[idx];
      var amt = amountFromControls(food, "qty-" + idx, "unit-" + idx, "grams-" + idx);
      addEntry(food, amt.grams, amt.disp);
    });
  });
  ul.querySelectorAll("[data-fav]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var idx = Number(btn.getAttribute("data-fav"));
      var food = results[idx];
      var amt = amountFromControls(food, "qty-" + idx, "unit-" + idx, "grams-" + idx);
      var nowFav = toggleFavorite(foodSnapshot(food, amt.grams, amt.disp));
      $("search-status").textContent = nowFav ? t("quick.savedFav") : t("quick.removedFav");
      $("search-status").className = "status";
      renderResults(results);
      renderQuickAdd();
    });
  });
}

function addEntry(food, grams, disp) {
  var entry = {
    id: Date.now() + "-" + Math.floor(Math.random() * 100000),
    name: food.name,
    brand: food.brand || "",
    meal: $("meal-select").value,
    grams: Math.max(1, Math.round(grams)),
    per100: food.per100
  };
  if (disp) {
    entry.dispQty = disp.qty;
    entry.dispUnit = disp.unit;
    if (disp.unit === "serving" && food.serving) {
      entry.servingLabel = food.serving.label || null;
      entry.servingAmount = food.serving.amount;
      entry.servingUnit = food.serving.unit;
    }
  }
  if (!state.entries[selectedDate]) state.entries[selectedDate] = [];
  state.entries[selectedDate].push(entry);
  pushRecent(foodSnapshot(food, entry.grams, disp));
  saveState(); renderAll();
  $("search-status").textContent = t("res.addedTo", { name: food.name, meal: mealLabel(entry.meal) });
  $("search-status").className = "status";
}

/* ---------- Quick re-log: favorites, recents, copy yesterday ---------- */
function renderQuickAdd() {
  var favBox = $("favorites-box"), recBox = $("recents-box");
  if (!favBox || !recBox) return;
  function row(snap, kind, idx) {
    var s = scaledNutrients(snap.per100, snapshotGrams(snap));
    var fav = isFavorite(snap);
    return '<div class="quick-row"><div class="quick-main">' +
      '<span class="result-name">' + esc(snap.name) + "</span>" +
      '<div class="result-meta">' + (snap.brand ? esc(snap.brand) + " · " : "") + esc(snapshotAmountText(snap)) + " · " + Math.round(s.kcal) + " kcal</div></div>" +
      '<button type="button" class="fav-btn" data-quick-fav="' + kind + ":" + idx + '" aria-pressed="' + fav + '" aria-label="' + esc(t("aria.favToggle", { name: snap.name })) + '" title="Favorite">' + (fav ? "★" : "☆") + "</button>" +
      '<button type="button" class="btn btn-primary btn-small" data-quick-log="' + kind + ":" + idx + '">' + esc(t("quick.log")) + "</button></div>";
  }
  favBox.hidden = !favorites.length;
  recBox.hidden = !recents.length;
  $("favorites-list").innerHTML = favorites.map(function (s, i) { return row(s, "fav", i); }).join("");
  $("recents-list").innerHTML = recents.map(function (s, i) { return row(s, "recent", i); }).join("");
  document.querySelectorAll("[data-quick-log]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var parts = btn.getAttribute("data-quick-log").split(":");
      var snap = (parts[0] === "fav" ? favorites : recents)[Number(parts[1])];
      if (snap) logSnapshot(snap);
    });
  });
  document.querySelectorAll("[data-quick-fav]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var parts = btn.getAttribute("data-quick-fav").split(":");
      var snap = (parts[0] === "fav" ? favorites : recents)[Number(parts[1])];
      if (!snap) return;
      toggleFavorite(snap);
      renderQuickAdd();
      renderLog();
    });
  });
}

function renderCopyYesterday() {
  var box = $("copy-yesterday");
  if (!box) return;
  var src = shiftDate(selectedDate, -1);
  var srcEntries = entriesFor(src);
  if (!srcEntries.length) { box.hidden = true; box.innerHTML = ""; return; }
  box.hidden = false;
  var html = '<span class="copy-label">' + esc(t("copy.fromLabel", { date: prettyDate(src) })) + "</span>";
  MEALS.forEach(function (meal) {
    var n = srcEntries.filter(function (e) { return e.meal === meal; }).length;
    if (n) html += '<button type="button" class="btn btn-small" data-copy-meal="' + meal + '">' + esc(mealLabel(meal)) + " (" + n + ")</button>";
  });
  html += '<button type="button" class="btn btn-small" data-copy-all="1">' + esc(t("copy.wholeDay", { n: srcEntries.length })) + "</button>";
  box.innerHTML = html;
  box.querySelectorAll("[data-copy-meal]").forEach(function (btn) {
    btn.addEventListener("click", function () { copyFromYesterday(btn.getAttribute("data-copy-meal")); });
  });
  var allBtn = box.querySelector("[data-copy-all]");
  if (allBtn) allBtn.addEventListener("click", function () { copyFromYesterday(null); });
}

function copyFromYesterday(meal) {
  var src = shiftDate(selectedDate, -1);
  var list = entriesFor(src).filter(function (e) { return !meal || e.meal === meal; });
  if (!list.length) return;
  if (!state.entries[selectedDate]) state.entries[selectedDate] = [];
  list.forEach(function (e, i) {
    var c = JSON.parse(JSON.stringify(e));
    c.id = Date.now() + "-" + i + "-" + Math.floor(Math.random() * 100000);
    state.entries[selectedDate].push(c);
  });
  saveState(); renderAll();
  $("search-status").textContent = list.length === 1 ? t("copy.done1", { date: prettyDate(src) }) : t("copy.doneN", { n: list.length, date: prettyDate(src) });
  $("search-status").className = "status";
}

/* ---------- Recipe builder ---------- */
var recipeDraft = { id: null, name: "", servings: 1, ingredients: [] };

function saveRecipes() { saveJSON(RECIPE_KEY, myRecipes); }

function nutritionLine(n) {
  return Math.round(n.kcal) + " kcal · P " + round1(n.protein) + " g · C " + round1(n.carbs) + " g · F " + round1(n.fat) + " g";
}
function microsLine(n) {
  if (!n.micros) return "";
  var parts = MICROS.filter(function (m) { return num(n.micros[m.key]) > 0.005; }).map(function (m) {
    return t("micro." + m.key) + " " + round1(n.micros[m.key]) + " " + m.unit;
  });
  return parts.length ? parts.join(" · ") : "";
}

function renderRecipeBuilder() {
  var listBox = $("recipe-list");
  if (!listBox) return;
  // Saved recipes, each loggable by servings into the selected meal/day.
  if (!myRecipes.length) {
    listBox.innerHTML = '<p class="hint">' + esc(t("recipes.noneSaved")) + "</p>";
  } else {
    listBox.innerHTML = myRecipes.map(function (r) {
      var per = window.Recipes.recipePerServing(r);
      var micro = microsLine(per);
      var makes = r.servings === 1 ? t("recipes.makes1", { line: nutritionLine(per) }) : t("recipes.makesN", { n: round1(r.servings), line: nutritionLine(per) });
      return '<div class="recipe"><h3>' + esc(r.name) + '</h3>' +
        '<div class="recipe-meta">' + esc(makes) + (micro ? "<br>" + esc(micro) : "") + "</div>" +
        '<div class="row"><label>' + esc(t("recipes.servings")) + ' <input type="number" class="recipe-qty" id="rq-' + r.id + '" value="1" min="0" step="0.25"></label>' +
        '<button type="button" class="btn btn-primary btn-small" data-recipe-log="' + r.id + '">' + esc(t("quick.log")) + '</button>' +
        '<button type="button" class="btn btn-small" data-recipe-edit="' + r.id + '">' + esc(t("recipes.edit")) + '</button>' +
        '<button type="button" class="btn btn-small btn-danger" data-recipe-del="' + r.id + '">' + esc(t("recipes.delete")) + "</button></div></div>";
    }).join("");
    listBox.querySelectorAll("[data-recipe-log]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var r = myRecipes.filter(function (x) { return x.id === btn.getAttribute("data-recipe-log"); })[0];
        if (!r) return;
        var qty = Number($("rq-" + r.id).value);
        if (!(qty > 0)) qty = 1;
        var entry = window.Recipes.recipeEntry(r, qty, $("meal-select").value, Date.now() + "-" + Math.floor(Math.random() * 100000));
        if (!state.entries[selectedDate]) state.entries[selectedDate] = [];
        state.entries[selectedDate].push(entry);
        saveState(); renderAll();
        $("recipe-status").textContent = qty === 1
          ? t("recipes.logged1", { name: r.name, meal: mealLabel(entry.meal) })
          : t("recipes.loggedN", { qty: round1(qty), name: r.name, meal: mealLabel(entry.meal) });
        $("recipe-status").className = "status";
      });
    });
    listBox.querySelectorAll("[data-recipe-edit]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var r = myRecipes.filter(function (x) { return x.id === btn.getAttribute("data-recipe-edit"); })[0];
        if (r) loadRecipeDraft(r);
      });
    });
    listBox.querySelectorAll("[data-recipe-del]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var r = myRecipes.filter(function (x) { return x.id === btn.getAttribute("data-recipe-del"); })[0];
        if (!r) return;
        if (!window.confirm(t("recipes.deleteConfirm", { name: r.name }))) return;
        myRecipes = myRecipes.filter(function (x) { return x.id !== r.id; });
        if (recipeDraft.id === r.id) resetRecipeDraft();
        saveRecipes(); renderRecipeBuilder();
        $("recipe-status").textContent = t("recipes.deleted");
        $("recipe-status").className = "status";
      });
    });
  }
  // Draft (new or being edited)
  $("recipe-form-title").textContent = recipeDraft.id ? t("recipes.editTitle") : t("recipes.newTitle");
  $("recipe-cancel-edit").hidden = !recipeDraft.id;
  var ingBox = $("recipe-ingredients");
  if (!recipeDraft.ingredients.length) {
    ingBox.innerHTML = '<p class="hint">' + esc(t("recipes.noIngredients")) + "</p>";
  } else {
    ingBox.innerHTML = recipeDraft.ingredients.map(function (ing, i) {
      var s = window.Recipes.scalePer100(ing.per100, ing.grams);
      return '<div class="quick-row"><div class="quick-main">' +
        '<span class="result-name">' + esc(ing.name) + "</span>" +
        '<div class="result-meta">' + (ing.brand ? esc(ing.brand) + " · " : "") + esc(snapshotAmountText(ing)) + " · " + Math.round(s.kcal) + " kcal</div></div>" +
        '<button type="button" class="log-remove" data-ing-remove="' + i + '" aria-label="' + esc(t("recipes.removeIngAria", { name: ing.name })) + '">&times;</button></div>';
    }).join("");
    ingBox.querySelectorAll("[data-ing-remove]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        recipeDraft.ingredients.splice(Number(btn.getAttribute("data-ing-remove")), 1);
        renderRecipeBuilder();
      });
    });
  }
  var totalsBox = $("recipe-totals");
  if (recipeDraft.ingredients.length) {
    var draftRecipe = { name: recipeDraft.name, servings: recipeDraft.servings, ingredients: recipeDraft.ingredients };
    var tot = window.Recipes.recipeTotals(draftRecipe);
    var per = window.Recipes.recipePerServing(draftRecipe);
    var micro = microsLine(per);
    totalsBox.textContent = t("recipes.totalLine", { total: nutritionLine(tot), per: nutritionLine(per) }) + (micro ? " · " + micro : "");
  } else {
    totalsBox.textContent = "";
  }
}

function loadRecipeDraft(r) {
  recipeDraft = JSON.parse(JSON.stringify({ id: r.id, name: r.name, servings: r.servings, ingredients: r.ingredients }));
  $("recipe-name").value = recipeDraft.name;
  $("recipe-servings").value = recipeDraft.servings;
  $("recipe-status").textContent = t("recipes.editingNote", { name: r.name });
  $("recipe-status").className = "status";
  renderRecipeBuilder();
  $("recipes-card").scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetRecipeDraft() {
  recipeDraft = { id: null, name: "", servings: 1, ingredients: [] };
  $("recipe-name").value = "";
  $("recipe-servings").value = 1;
  $("recipe-search-results").innerHTML = "";
  $("recipe-search-status").textContent = "";
}

function saveRecipeDraft() {
  var status = $("recipe-status");
  recipeDraft.name = $("recipe-name").value.trim();
  var sv = Number($("recipe-servings").value);
  recipeDraft.servings = sv > 0 ? sv : 0;
  if (!recipeDraft.name) {
    status.textContent = t("recipes.needName");
    status.className = "status error";
    return;
  }
  if (!(recipeDraft.servings > 0)) {
    status.textContent = t("recipes.needServings");
    status.className = "status error";
    return;
  }
  if (!recipeDraft.ingredients.length) {
    status.textContent = t("recipes.needIngredient");
    status.className = "status error";
    return;
  }
  var rec = {
    id: recipeDraft.id || ("r" + Date.now()),
    name: recipeDraft.name,
    servings: recipeDraft.servings,
    ingredients: recipeDraft.ingredients
  };
  if (recipeDraft.id) {
    myRecipes = myRecipes.map(function (x) { return x.id === rec.id ? rec : x; });
  } else {
    myRecipes.push(rec);
  }
  saveRecipes();
  resetRecipeDraft();
  renderRecipeBuilder();
  status.textContent = t("recipes.savedNote", { name: rec.name });
  status.className = "status";
}

function renderRecipeResults(results) {
  var ul = $("recipe-search-results");
  if (!results.length) { ul.innerHTML = ""; return; }
  ul.innerHTML = results.map(function (r, idx) {
    var meta = (r.brand ? esc(r.brand) + " · " : "") +
      Math.round(r.per100.kcal) + " kcal · P " + round1(r.per100.protein) + " · C " + round1(r.per100.carbs) +
      " · F " + round1(r.per100.fat) + " " + (r.serving && r.serving.unit === "ml" ? t("res.per100ml") : t("res.per100g"));
    if (r.serving) meta += " · " + esc(t("res.serving", { s: servingDisplay(r.serving) }));
    var control;
    if (r.serving) {
      var amtTxt = r.serving.unit === "ml" ? volumeText(r.serving.amount) : r.serving.amount + " g";
      var opts = '<option value="serving">' + esc(r.serving.label || t("res.servingWord")) + " · " + esc(amtTxt) + "</option>";
      if (r.serving.unit === "ml") opts += '<option value="volume">' + (waterImperial() ? "fl oz" : "ml") + "</option>";
      opts += '<option value="g">' + esc(t("res.gramsOpt")) + "</option>";
      control = '<input type="number" class="result-qty" id="rqty-' + idx + '" value="1" min="0" step="0.5" aria-label="' + esc(t("aria.qty")) + '"> ' +
        '<select class="result-unit" id="runit-' + idx + '" aria-label="' + esc(t("aria.amountUnit")) + '">' + opts + "</select>";
    } else {
      control = '<input type="number" class="result-grams" id="rgrams-' + idx + '" value="100" min="1" step="1" aria-label="' + esc(t("aria.grams")) + '"> g';
    }
    return '<li class="result"><div class="result-main">' +
      '<span class="result-name">' + esc(r.name) + "</span> " +
      '<span class="source-tag">' + esc(r.source) + "</span>" +
      '<div class="result-meta">' + meta + "</div></div>" +
      control +
      '<button type="button" class="btn btn-primary btn-small" data-radd="' + idx + '"><span>' + esc(t("recipes.addIngredientBtn")) + "</span></button></li>";
  }).join("");
  ul.querySelectorAll("[data-radd]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var idx = Number(btn.getAttribute("data-radd"));
      var food = results[idx];
      var amt = amountFromControls(food, "rqty-" + idx, "runit-" + idx, "rgrams-" + idx);
      recipeDraft.ingredients.push({
        name: food.name,
        brand: food.brand || "",
        per100: JSON.parse(JSON.stringify(food.per100)),
        grams: Math.max(1, Math.round(amt.grams)),
        disp: amt.disp,
        serving: food.serving ? { amount: food.serving.amount, unit: food.serving.unit, label: food.serving.label || null } : null
      });
      renderRecipeBuilder();
    });
  });
}

/* ---------- Voice logging (voice-to-search only) ----------
   The transcript goes into the regular search box and runs the normal
   database search; the user still taps the right match to log it. A
   leading quantity ("two", "2") prefills the first result's quantity. */
var voiceQty = null;
var VOICE_NUMBER_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, a: 1, an: 1, half: 0.5
};

function parseVoiceTranscript(text) {
  var clean = String(text || "").trim();
  var m = clean.match(/^(\d+(?:[.,]\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|a|an|half)\s+(.+)$/i);
  if (!m) return { qty: null, query: clean };
  var w = m[1].toLowerCase();
  var qty = Object.prototype.hasOwnProperty.call(VOICE_NUMBER_WORDS, w)
    ? VOICE_NUMBER_WORDS[w]
    : Number(w.replace(",", "."));
  return { qty: qty > 0 ? qty : null, query: m[2].trim() };
}

function setupVoice() {
  var btn = $("voice-btn");
  if (!btn) return;
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    var note = $("voice-note");
    if (note) note.hidden = false;
    return;
  }
  btn.hidden = false;
  var rec = null;
  var label = btn.querySelector("span");
  btn.addEventListener("click", function () {
    var status = $("search-status");
    if (rec) { try { rec.stop(); } catch (e) { /* already stopping */ } return; }
    rec = new SR();
    rec.lang = localeTag();
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    btn.classList.add("listening");
    if (label) label.textContent = t("voice.listening");
    status.textContent = t("voice.prompt");
    status.className = "status";
    rec.onresult = function (ev) {
      var transcript = (ev.results[0] && ev.results[0][0] && ev.results[0][0].transcript) || "";
      var parsed = parseVoiceTranscript(transcript);
      voiceQty = parsed.qty;
      $("search-input").value = parsed.query;
      var form = $("search-form");
      if (form.requestSubmit) form.requestSubmit();
      else form.dispatchEvent(new Event("submit", { cancelable: true }));
    };
    rec.onerror = function (ev) {
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
        status.textContent = t("voice.blocked");
        status.className = "status error";
      } else if (ev.error === "no-speech") {
        status.textContent = t("voice.noSpeech");
        status.className = "status error";
      } else if (ev.error && ev.error !== "aborted") {
        status.textContent = t("voice.error", { err: ev.error });
        status.className = "status error";
      }
    };
    rec.onend = function () {
      rec = null;
      btn.classList.remove("listening");
      if (label) label.textContent = t("voice.speak");
    };
    try { rec.start(); } catch (e) {
      rec = null;
      btn.classList.remove("listening");
      if (label) label.textContent = t("voice.speak");
    }
  });
}

function lookupBarcode(code) {
  var status = $("barcode-status");
  status.textContent = t("barcode.looking", { code: code });
  status.className = "status";
  fetch("https://world.openfoodfacts.org/api/v2/product/" + encodeURIComponent(code) + ".json")
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (data.status !== 1 || !data.product) {
        status.textContent = t("barcode.notFound");
        status.className = "status error";
        return;
      }
      var per100 = offNutrients(data.product.nutriments);
      if (!per100) {
        status.textContent = t("barcode.noNutrition");
        status.className = "status error";
        return;
      }
      renderResults([{ name: data.product.product_name || ("Barcode " + code), brand: data.product.brands || "", source: "Open Food Facts", per100: per100, serving: offServing(data.product) }]);
      status.textContent = t("barcode.found");
    })
    .catch(function () {
      status.textContent = t("barcode.lookupFailed");
      status.className = "status error";
    });
}

/* ---------- Camera barcode scanning ---------- */
var scanStream = null;
var scanTimer = null;
var zxingScanner = null;

function stopScan() {
  if (scanTimer) { clearInterval(scanTimer); scanTimer = null; }
  if (scanStream) { scanStream.getTracks().forEach(function (t) { t.stop(); }); scanStream = null; }
  if (zxingScanner) {
    var zs = zxingScanner;
    zxingScanner = null;
    try {
      var p = zs.stop();
      if (p && p.catch) p.catch(function () {});
    } catch (e) { /* already stopped */ }
  }
  var holder = $("scan-zxing");
  if (holder) { holder.hidden = true; holder.innerHTML = ""; }
  var video = $("scan-video");
  if (video) video.hidden = false;
  var box = $("scan-box");
  if (box) box.hidden = true;
}

function startScan() {
  var status = $("barcode-status");
  var hasMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  if (("BarcodeDetector" in window) && hasMedia) { startNativeScan(); return; }
  if (hasMedia && window.Html5Qrcode) { startZxingScan(status); return; }
  status.textContent = t("scan.unsupported");
  status.className = "status error";
}

function startNativeScan() {
  var status = $("barcode-status");
  var detector;
  try { detector = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] }); }
  catch (e) { detector = new window.BarcodeDetector(); }
  navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
    .then(function (stream) {
      scanStream = stream;
      $("scan-box").hidden = false;
      var video = $("scan-video");
      video.srcObject = stream;
      return video.play();
    })
    .then(function () {
      var video = $("scan-video");
      scanTimer = setInterval(function () {
        if (!scanStream) return;
        detector.detect(video).then(function (codes) {
          if (codes && codes.length) {
            var raw = String(codes[0].rawValue || "").replace(/\D/g, "");
            stopScan();
            if (raw) {
              $("barcode-input").value = raw;
              lookupBarcode(raw);
            }
          }
        }).catch(function () { /* keep trying */ });
      }, 450);
    })
    .catch(function () {
      status.textContent = t("scan.camFail");
      status.className = "status error";
      stopScan();
    });
}

/* Fallback scanner for browsers without BarcodeDetector (e.g. iPhone Safari):
   ZXing-based reader from the self-hosted html5-qrcode library. */
function startZxingScan(status) {
  var box = $("scan-box");
  var video = $("scan-video");
  var holder = $("scan-zxing");
  box.hidden = false;
  if (video) video.hidden = true;
  if (holder) holder.hidden = false;
  var note = $("scan-status");
  if (note) note.textContent = t("log.scanPoint");
  var formats = null;
  try {
    var F = window.Html5QrcodeSupportedFormats;
    formats = [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.CODE_128];
  } catch (e) { formats = null; }
  try {
    zxingScanner = formats
      ? new window.Html5Qrcode("scan-zxing", { formatsToSupport: formats, verbose: false })
      : new window.Html5Qrcode("scan-zxing", { verbose: false });
  } catch (e) {
    status.textContent = t("scan.scannerFail");
    status.className = "status error";
    stopScan();
    return;
  }
  zxingScanner.start(
    { facingMode: "environment" },
    { fps: 10 },
    function (decodedText) {
      var raw = String(decodedText || "").replace(/\D/g, "");
      stopScan();
      if (raw) {
        $("barcode-input").value = raw;
        lookupBarcode(raw);
      }
    },
    function () { /* per-frame misses are expected; keep scanning */ }
  ).catch(function () {
    status.textContent = t("scan.camFail");
    status.className = "status error";
    stopScan();
  });
}

/* ---------- Trends: charts ---------- */
function lastNDays(n) {
  var days = [];
  var today = todayStr();
  for (var i = n - 1; i >= 0; i--) days.push(shiftDate(today, -i));
  return days;
}

function shortDate(ds) {
  var p = ds.split("-").map(Number);
  return (p[1]) + "/" + (p[2]);
}

function renderCalChart() {
  var box = $("cal-chart");
  var days = lastNDays(trendsRange);
  var target = state.settings.target || 2000;
  var totals = days.map(function (ds) { return totalsFor(ds).kcal; });
  var max = Math.max(target, Math.max.apply(null, totals)) * 1.12;
  if (max <= 0) max = target;
  var W = 700, H = 230, padL = 44, padR = 10, padT = 14, padB = 28;
  var iw = W - padL - padR, ih = H - padT - padB;
  var bw = iw / days.length;
  function Y(v) { return padT + (1 - v / max) * ih; }
  var svg = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(t("chart.calAria")) + '">';
  svg += '<line x1="' + padL + '" y1="' + padT + '" x2="' + padL + '" y2="' + (H - padB) + '" stroke="var(--line)"/>';
  svg += '<line x1="' + padL + '" y1="' + (H - padB) + '" x2="' + (W - padR) + '" y2="' + (H - padB) + '" stroke="var(--line)"/>';
  svg += '<text x="4" y="' + (Y(max / 1.12) + 4) + '" font-size="11" fill="var(--muted)">' + Math.round(max / 1.12) + "</text>";
  var ty = Y(target);
  svg += '<line x1="' + padL + '" y1="' + ty + '" x2="' + (W - padR) + '" y2="' + ty + '" stroke="var(--danger)" stroke-dasharray="5 4"/>';
  svg += '<text x="' + (W - padR - 40) + '" y="' + (ty - 5) + '" font-size="11" fill="var(--danger)">' + esc(t("chart.target")) + "</text>";
  var labelEvery = trendsRange > 14 ? 5 : 2;
  days.forEach(function (ds, i) {
    var v = totals[i];
    var x = padL + i * bw;
    var h = Math.max(0, (v / max) * ih);
    var color = v > target ? "var(--danger)" : "var(--accent)";
    svg += '<rect x="' + (x + 1.5).toFixed(1) + '" y="' + (H - padB - h).toFixed(1) + '" width="' + Math.max(1, bw - 3).toFixed(1) +
      '" height="' + h.toFixed(1) + '" fill="' + color + '" rx="2"><title>' + ds + ": " + Math.round(v) + " kcal</title></rect>";
    if (i % labelEvery === 0 || i === days.length - 1) {
      svg += '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 8) + '" font-size="10" fill="var(--muted)" text-anchor="middle">' + shortDate(ds) + "</text>";
    }
  });
  svg += "</svg>";
  box.innerHTML = svg;
}

function renderMacroChart() {
  var box = $("macro-chart");
  var days = lastNDays(14);
  var series = days.map(function (ds) {
    var t = totalsFor(ds);
    return { p: t.protein, c: t.carbs, f: t.fat };
  });
  var max = 0;
  series.forEach(function (s) { max = Math.max(max, s.p, s.c, s.f); });
  var W = 700, H = 210, padL = 40, padR = 10, padT = 12, padB = 26;
  var iw = W - padL - padR, ih = H - padT - padB;
  if (max <= 0) {
    box.innerHTML = '<p class="hint">' + esc(t("trends.noFood14")) + "</p>";
    return;
  }
  function Y(v) { return padT + (1 - v / max) * ih; }
  var groupW = iw / days.length;
  var bw = Math.max(1.5, (groupW - 4) / 3);
  var svg = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(t("chart.macroAria")) + '">';
  svg += '<line x1="' + padL + '" y1="' + padT + '" x2="' + padL + '" y2="' + (H - padB) + '" stroke="var(--line)"/>';
  svg += '<line x1="' + padL + '" y1="' + (H - padB) + '" x2="' + (W - padR) + '" y2="' + (H - padB) + '" stroke="var(--line)"/>';
  svg += '<text x="4" y="' + (Y(max) + 4) + '" font-size="11" fill="var(--muted)">' + Math.round(max) + " g</text>";
  var keys = [["p", "var(--protein)"], ["c", "var(--carbs)"], ["f", "var(--fat)"]];
  days.forEach(function (ds, i) {
    var gx = padL + i * groupW + 2;
    keys.forEach(function (k, j) {
      var v = series[i][k[0]];
      var h = (v / max) * ih;
      svg += '<rect x="' + (gx + j * bw).toFixed(1) + '" y="' + (H - padB - h).toFixed(1) + '" width="' + bw.toFixed(1) +
        '" height="' + h.toFixed(1) + '" fill="' + k[1] + '"><title>' + ds + ": " + Math.round(v) + " g</title></rect>";
    });
    if (i % 2 === 0 || i === days.length - 1) {
      svg += '<text x="' + (gx + groupW / 2 - 2).toFixed(1) + '" y="' + (H - 6) + '" font-size="10" fill="var(--muted)" text-anchor="middle">' + shortDate(ds) + "</text>";
    }
  });
  svg += "</svg>";
  box.innerHTML = svg;
}

function renderMicros() {
  $("micro-date").value = selectedDate;
  var tot = totalsFor(selectedDate);
  var html = MICROS.map(function (m) {
    var v = tot.micros[m.key];
    var pctv = Math.max(0, Math.min(100, (v / m.target) * 100));
    var shown = v >= 100 ? Math.round(v) : round1(v);
    return '<div class="micro"><span class="micro-name">' + t("micro." + m.key) + '</span>' +
      '<div class="bar"><div class="bar-fill" style="width:' + pctv.toFixed(1) + '%"></div></div>' +
      '<span class="micro-val">' + shown + " / " + m.target + " " + m.unit + " · " + Math.round(pctv) + "%</span></div>";
  }).join("");
  $("micro-list").innerHTML = html;
}

function renderTrends() {
  renderCalChart();
  renderMacroChart();
  renderMicros();
  renderWeight();
}

/* ---------- Weight (in Trends tab) ---------- */
function sortedWeights() {
  return state.weights.slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
}

function renderWeight() {
  var ws = sortedWeights();
  var unit = unitLabel();
  var latest = ws.length ? ws[ws.length - 1] : null;
  var currentKg = latest ? latest.kg : state.settings.currentWeightKg;
  var targetKg = state.settings.targetWeightKg;

  $("weight-current").textContent = currentKg != null ? round1(toDisplayWeight(currentKg)) + " " + unit : "—";
  $("weight-target").textContent = targetKg != null ? round1(toDisplayWeight(targetKg)) + " " + unit : "—";
  $("weight-to-go").textContent = (currentKg != null && targetKg != null)
    ? round1(Math.abs(toDisplayWeight(currentKg) - toDisplayWeight(targetKg))) + " " + unit : "—";
  $("weight-unit-label").textContent = unit;

  var box = $("weight-chart");
  if (ws.length < 2) {
    box.innerHTML = '<p class="hint">' + esc(ws.length === 1 ? t("weight.oneOnly") : t("weight.noneYet")) + "</p>";
  } else {
    var W = 700, H = 220, padL = 46, padR = 14, padT = 14, padB = 26;
    var vals = ws.map(function (w) { return toDisplayWeight(w.kg); });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    if (targetKg != null) { var tv = toDisplayWeight(targetKg); min = Math.min(min, tv); max = Math.max(max, tv); }
    if (max - min < 1) { max += 0.5; min -= 0.5; }
    var x0 = new Date(ws[0].date).getTime(), x1 = new Date(ws[ws.length - 1].date).getTime();
    if (x1 === x0) x1 = x0 + 86400000;
    function X(d) { return padL + ((new Date(d).getTime() - x0) / (x1 - x0)) * (W - padL - padR); }
    function Y(v) { return padT + (1 - (v - min) / (max - min)) * (H - padT - padB); }
    var pts = ws.map(function (w) { return X(w.date).toFixed(1) + "," + Y(toDisplayWeight(w.kg)).toFixed(1); }).join(" ");
    var svg = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(t("weight.chartAria")) + '">';
    svg += '<line x1="' + padL + '" y1="' + padT + '" x2="' + padL + '" y2="' + (H - padB) + '" stroke="var(--line)"/>';
    svg += '<line x1="' + padL + '" y1="' + (H - padB) + '" x2="' + (W - padR) + '" y2="' + (H - padB) + '" stroke="var(--line)"/>';
    svg += '<text x="6" y="' + (Y(max) + 4) + '" font-size="11" fill="var(--muted)">' + round1(max) + "</text>";
    svg += '<text x="6" y="' + (Y(min) + 4) + '" font-size="11" fill="var(--muted)">' + round1(min) + "</text>";
    if (targetKg != null) {
      var ty = Y(toDisplayWeight(targetKg));
      svg += '<line x1="' + padL + '" y1="' + ty + '" x2="' + (W - padR) + '" y2="' + ty + '" stroke="var(--accent)" stroke-dasharray="5 4"/>' +
        '<text x="' + (W - padR - 64) + '" y="' + (ty - 5) + '" font-size="11" fill="var(--accent)">' + esc(t("chart.target")) + "</text>";
    }
    svg += '<polyline points="' + pts + '" fill="none" stroke="var(--protein)" stroke-width="2.5"/>';
    ws.forEach(function (w) {
      svg += '<circle cx="' + X(w.date).toFixed(1) + '" cy="' + Y(toDisplayWeight(w.kg)).toFixed(1) + '" r="3.5" fill="var(--protein)"/>';
    });
    svg += '<text x="' + padL + '" y="' + (H - 6) + '" font-size="11" fill="var(--muted)">' + esc(ws[0].date) + "</text>";
    svg += '<text x="' + (W - padR - 74) + '" y="' + (H - 6) + '" font-size="11" fill="var(--muted)">' + esc(ws[ws.length - 1].date) + "</text>";
    svg += "</svg>";
    box.innerHTML = svg;
  }

  $("weight-list").innerHTML = ws.slice().reverse().map(function (w) {
    return "<li><span>" + esc(w.date) + "</span><span>" + round1(toDisplayWeight(w.kg)) + " " + unit +
      ' <button type="button" class="log-remove" data-wremove="' + esc(w.date) + '" aria-label="' + esc(t("weight.removeAria", { date: w.date })) + '">&times;</button></span></li>';
  }).join("");
  $("weight-list").querySelectorAll("[data-wremove]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var d = btn.getAttribute("data-wremove");
      state.weights = state.weights.filter(function (w) { return w.date !== d; });
      saveState(); renderAll();
    });
  });
}

/* ---------- Water ---------- */
function waterImperial() { return state.settings.unit !== "kg"; }

var WATER_QUICK = {
  imperial: [[237, "+ 8 oz"], [355, "+ 12 oz"], [473, "+ 16 oz"]],
  metric: [[250, "+ 250 ml"], [350, "+ 350 ml"], [500, "+ 500 ml"]]
};
var waterQuickKey = "";

function renderWater() {
  var ml = num(state.water[waterDate]);
  var goal = state.settings.waterGoalMl || 2000;
  var imp = waterImperial();
  $("water-picker").value = waterDate;
  if (imp) {
    $("water-amount").textContent = round1(ml / ML_PER_OZ) + " fl oz";
    $("water-sub").textContent = Math.round(ml) + " ml · " + t("water.goalWord") + " " + round1(goal / ML_PER_OZ) + " fl oz · " + prettyDate(waterDate);
  } else {
    $("water-amount").textContent = Math.round(ml) + " ml";
    $("water-sub").textContent = round1(ml / ML_PER_OZ) + " fl oz · " + t("water.goalWord") + " " + goal + " ml · " + prettyDate(waterDate);
  }
  var pctv = Math.max(0, Math.min(100, (ml / goal) * 100));
  $("water-bar").style.width = pctv.toFixed(1) + "%";
  $("water-pct").textContent = t("water.pctGoal", { pct: Math.round(pctv) });
  var key = imp ? "imperial" : "metric";
  if (key !== waterQuickKey) {
    waterQuickKey = key;
    $("water-quick").innerHTML = WATER_QUICK[key].map(function (q) {
      return '<button type="button" class="btn" data-water-add="' + q[0] + '">' + q[1] + "</button>";
    }).join("");
    $("water-custom-unit").value = imp ? "oz" : "ml";
  }
  var goalInput = $("water-goal");
  if (imp) {
    goalInput.min = "16"; goalInput.max = "340"; goalInput.step = "1";
    goalInput.value = Math.round(goal / ML_PER_OZ);
  } else {
    goalInput.min = "100"; goalInput.max = "10000"; goalInput.step = "50";
    goalInput.value = goal;
  }
  $("water-goal-unit").textContent = imp ? "fl oz" : "ml";
}

function addWater(ml) {
  state.water[waterDate] = num(state.water[waterDate]) + ml;
  saveState(); renderWater();
}

/* ---------- Fasting timer ---------- */
var fastingTargetPick = 16;

function saveFasting() { saveJSON(FAST_KEY, fastingStore); }

function renderFasting() {
  if (!$("fasting-card")) return;
  var cur = fastingStore.current;
  var targets = $("fasting-targets");
  targets.innerHTML = window.Fasting.TARGETS.map(function (h) {
    var active = cur ? cur.targetHours === h : fastingTargetPick === h;
    return '<button type="button" class="seg-btn' + (active ? " active" : "") + '" data-fast-target="' + h + '">' + h + "h</button>";
  }).join("");
  targets.querySelectorAll("[data-fast-target]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      fastingTargetPick = Number(btn.getAttribute("data-fast-target"));
      renderFasting();
    });
  });
  $("fasting-idle").hidden = !!cur;
  $("fasting-live").hidden = !cur;
  if (cur) updateFastingClock();
  var hist = $("fasting-history");
  if (!fastingStore.history.length) {
    hist.innerHTML = '<p class="hint">' + esc(t("fasting.none")) + "</p>";
  } else {
    hist.innerHTML = fastingStore.history.slice().reverse().slice(0, 10).map(function (f) {
      return '<div class="log-item"><div><span class="log-name">' + esc(prettyDate(todayStr(new Date(f.end)))) + '</span> ' +
        '<span class="log-meta">' + esc(t("fasting.targetLine", { h: f.targetHours })) + " · " + esc(f.met ? t("fasting.targetMet") : t("fasting.endedEarly")) + '</span></div>' +
        '<div><span class="log-kcal">' + window.Fasting.formatDuration(f.durationMs) + "</span></div></div>";
    }).join("");
  }
}

function updateFastingClock() {
  var cur = fastingStore.current;
  if (!cur || !$("fasting-elapsed")) return;
  var now = Date.now();
  var el = window.Fasting.elapsedMs(cur.start, now);
  $("fasting-elapsed").textContent = window.Fasting.formatElapsed(el);
  var pct = Math.round(window.Fasting.progress(cur.start, cur.targetHours, now) * 100);
  $("fasting-bar").style.width = pct + "%";
  $("fasting-pct").textContent = t("fasting.pctTarget", { pct: pct, h: cur.targetHours });
  var startD = new Date(cur.start);
  $("fasting-sub").textContent = t("fasting.startedAt", { date: prettyDate(todayStr(startD)), time: startD.toLocaleTimeString(localeTag(), { hour: "numeric", minute: "2-digit" }) }) + (pct >= 100 ? t("fasting.reached") : "");
}

function startFast() {
  fastingStore.current = { start: Date.now(), targetHours: fastingTargetPick };
  saveFasting();
  renderFasting();
  $("fasting-status").textContent = t("fasting.startedNote", { h: fastingTargetPick });
  $("fasting-status").className = "status";
}

function endFast() {
  var cur = fastingStore.current;
  if (!cur) return;
  var done = window.Fasting.completeFast(cur.start, Date.now(), cur.targetHours);
  fastingStore.history.push(done);
  fastingStore.current = null;
  fastingTargetPick = done.targetHours;
  saveFasting();
  renderFasting();
  $("fasting-status").textContent = t("fasting.endedNote", { dur: window.Fasting.formatDuration(done.durationMs) }) +
    (done.met ? t("fasting.endedMet") : t("fasting.endedShort", { h: done.targetHours }));
  $("fasting-status").className = "status";
}

function cancelFast() {
  if (!fastingStore.current) return;
  if (!window.confirm(t("fasting.cancelConfirm"))) return;
  fastingTargetPick = fastingStore.current.targetHours;
  fastingStore.current = null;
  saveFasting();
  renderFasting();
}

/* ---------- Gentle meal reminders ----------
   Honest scope: checks run while the app is open (on load and every
   minute) and fire a notification where the browser supports it, plus a
   dismissible in-app banner. Nothing here can guarantee a notification
   while the app is fully closed. */
var reminderBannerMsgs = [];

function saveReminders() { saveJSON(REMINDER_KEY, reminderCfg); }

function renderReminderSettings() {
  if (!$("rem-enabled")) return;
  $("rem-enabled").checked = !!reminderCfg.enabled;
  $("rem-lunch").value = reminderCfg.lunch || "12:30";
  $("rem-dinner").value = reminderCfg.dinner || "18:30";
}

function reminderTimePassed(hhmm) {
  var parts = String(hhmm || "").split(":").map(Number);
  if (parts.length !== 2 || !(parts[0] >= 0) || !(parts[1] >= 0)) return false;
  var now = new Date();
  return now.getHours() > parts[0] || (now.getHours() === parts[0] && now.getMinutes() >= parts[1]);
}

function showReminderBanner() {
  var banner = $("reminder-banner");
  if (!banner) return;
  if (!reminderBannerMsgs.length) { banner.hidden = true; return; }
  $("reminder-banner-text").textContent = reminderBannerMsgs.join(" ");
  banner.hidden = false;
}

function fireReminder(meal) {
  var msg = t("reminders.msg", { meal: mealLabel(meal) });
  if ("Notification" in window && Notification.permission === "granted") {
    var shown = false;
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then(function (reg) {
        if (reg && reg.showNotification) { reg.showNotification(t("app.title"), { body: msg }); shown = true; }
      }).catch(function () { /* fall through to the banner */ });
    }
    if (!shown) {
      try { new Notification(t("app.title"), { body: msg }); } catch (e) { /* banner below still shows */ }
    }
  }
  if (reminderBannerMsgs.indexOf(msg) < 0) reminderBannerMsgs.push(msg);
  showReminderBanner();
}

function checkReminders() {
  if (!reminderCfg.enabled) return;
  var today = todayStr();
  [["Lunch", reminderCfg.lunch], ["Dinner", reminderCfg.dinner]].forEach(function (pair) {
    var meal = pair[0];
    if (reminderCfg.lastFired[meal] === today) return;
    if (!reminderTimePassed(pair[1])) return;
    // One check per meal per day: if it is already logged, stay quiet.
    reminderCfg.lastFired[meal] = today;
    saveReminders();
    var logged = entriesFor(today).some(function (e) { return e.meal === meal; });
    if (!logged) fireReminder(meal);
  });
}

/* ---------- Meal planner ---------- */
var MEAL_SPLITS = {
  3: [["Breakfast", 30], ["Lunch", 35], ["Dinner", 35]],
  4: [["Breakfast", 25], ["Lunch", 35], ["Dinner", 30], ["Snack", 10]],
  5: [["Breakfast", 20], ["Morning snack", 10], ["Lunch", 30], ["Afternoon snack", 10], ["Dinner", 30]],
  6: [["Breakfast", 20], ["Morning snack", 10], ["Lunch", 25], ["Afternoon snack", 10], ["Dinner", 25], ["Evening snack", 10]],
  7: [["Breakfast", 18], ["Morning snack", 9], ["Lunch", 24], ["Afternoon snack", 9], ["Pre-workout snack", 8], ["Dinner", 24], ["Evening snack", 8]]
};

var RECIPES = [
  { name: "Overnight Oats", kcal: 420, protein: 16, meals: ["breakfast"], ingredients: ["rolled oats", "milk", "greek yogurt", "honey", "chia seeds", "banana"] },
  { name: "Greek Yogurt Parfait", kcal: 380, protein: 24, meals: ["breakfast", "snack"], ingredients: ["greek yogurt", "granola", "mixed berries", "honey"] },
  { name: "Egg & Veggie Scramble", kcal: 450, protein: 27, meals: ["breakfast", "lunch"], ingredients: ["eggs", "spinach", "bell pepper", "onion", "cheese", "olive oil"] },
  { name: "Protein Smoothie", kcal: 350, protein: 30, meals: ["breakfast", "snack"], ingredients: ["protein powder", "banana", "milk", "peanut butter", "spinach"] },
  { name: "Cottage Cheese & Fruit Bowl", kcal: 320, protein: 26, meals: ["snack", "breakfast"], ingredients: ["cottage cheese", "pineapple", "walnuts"] },
  { name: "Chicken Rice Bowl", kcal: 650, protein: 48, meals: ["lunch", "dinner"], ingredients: ["chicken breast", "rice", "broccoli", "soy sauce", "garlic", "olive oil"] },
  { name: "Tuna Salad Wrap", kcal: 520, protein: 38, meals: ["lunch"], ingredients: ["canned tuna", "tortilla wrap", "mayonnaise", "celery", "lettuce", "lemon"] },
  { name: "Turkey Chili", kcal: 580, protein: 42, meals: ["lunch", "dinner"], ingredients: ["ground turkey", "kidney beans", "crushed tomatoes", "onion", "chili powder", "garlic"] },
  { name: "Salmon & Quinoa", kcal: 620, protein: 44, meals: ["dinner"], ingredients: ["salmon fillet", "quinoa", "asparagus", "lemon", "olive oil", "garlic"] },
  { name: "Pasta Primavera", kcal: 560, protein: 19, meals: ["lunch", "dinner"], ingredients: ["pasta", "zucchini", "bell pepper", "cherry tomatoes", "parmesan", "olive oil"] },
  { name: "Lentil Soup", kcal: 480, protein: 22, meals: ["lunch", "dinner"], ingredients: ["lentils", "carrots", "onion", "celery", "vegetable stock", "cumin"] },
  { name: "Beef Stir-Fry", kcal: 600, protein: 45, meals: ["dinner"], ingredients: ["beef strips", "bell pepper", "broccoli", "soy sauce", "ginger", "rice"] },
  { name: "Veggie Fried Rice", kcal: 540, protein: 15, meals: ["lunch", "dinner"], ingredients: ["rice", "eggs", "peas", "carrots", "soy sauce", "spring onion"] },
  { name: "Bean Burrito Bowl", kcal: 590, protein: 21, meals: ["lunch", "dinner"], ingredients: ["black beans", "rice", "corn", "avocado", "salsa", "lime"] }
];

function splitForMeals() {
  return MEAL_SPLITS[state.planner.mealsPerDay] || MEAL_SPLITS[3];
}

function renderPlanner() {
  var target = state.settings.target || 2000;
  $("plan-target-note").textContent = t("planner.targetNote", { target: target, n: state.planner.mealsPerDay });
  $("plan-meals").value = String(state.planner.mealsPerDay);
  $("plan-split").innerHTML = splitForMeals().map(function (row) {
    return '<div class="plan-row"><span>' + esc(mealLabel(row[0])) + " · " + row[1] + '%</span>' +
      '<span class="plan-kcal">' + Math.round(target * row[1] / 100) + " kcal</span></div>";
  }).join("");
  $("plan-ingredients").value = (state.planner.ingredients || []).join(", ");
  renderRecipeMatches();
}

function normalizeIng(s) { return String(s).toLowerCase().trim(); }

function renderRecipeMatches() {
  var have = (state.planner.ingredients || []).map(normalizeIng).filter(Boolean);
  var box = $("plan-recipes");
  if (!have.length) {
    box.innerHTML = '<p class="hint">' + esc(t("planner.noIngredients")) + "</p>";
    return;
  }
  var scored = RECIPES.map(function (r) {
    var haveIngs = [], missing = [];
    r.ingredients.forEach(function (ing) {
      var key = normalizeIng(ing);
      var found = have.some(function (h) { return h.indexOf(key) !== -1 || key.indexOf(h) !== -1; });
      (found ? haveIngs : missing).push(ing);
    });
    return { recipe: r, haveIngs: haveIngs, missing: missing, score: haveIngs.length / r.ingredients.length };
  }).filter(function (s) { return s.haveIngs.length > 0; })
    .sort(function (a, b) { return b.score - a.score; });
  if (!scored.length) {
    box.innerHTML = '<p class="hint">' + esc(t("planner.noneMatch")) + "</p>";
    return;
  }
  box.innerHTML = scored.map(function (s) {
    return '<div class="recipe"><h3>' + esc(s.recipe.name) + "</h3>" +
      '<div class="recipe-meta">' + esc(t("planner.haveN", { kcal: s.recipe.kcal, protein: s.recipe.protein, have: s.haveIngs.length, total: s.recipe.ingredients.length })) + "</div>" +
      '<div class="have">' + esc(t("planner.have", { list: s.haveIngs.join(", ") })) + "</div>" +
      (s.missing.length ? '<div class="missing">' + esc(t("planner.need", { list: s.missing.join(", ") })) + "</div>" : '<div class="have">' + esc(t("planner.haveAll")) + "</div>") +
      "</div>";
  }).join("");
}

function slotType(mealName) {
  var n = mealName.toLowerCase();
  if (n.indexOf("breakfast") !== -1) return "breakfast";
  if (n.indexOf("lunch") !== -1) return "lunch";
  if (n.indexOf("dinner") !== -1) return "dinner";
  return "snack";
}

function generatePlan() {
  var target = state.settings.target || 2000;
  var split = splitForMeals();
  var seed = Math.floor(Date.now() / 86400000); // rotates daily
  var used = {};
  var picks = split.map(function (row, slotIdx) {
    var slotKcal = target * row[1] / 100;
    var type = slotType(row[0]);
    var candidates = RECIPES.filter(function (r) { return r.meals.indexOf(type) !== -1; });
    if (!candidates.length) candidates = RECIPES.slice();
    candidates.sort(function (a, b) {
      var da = Math.abs(a.kcal - slotKcal) + (used[a.name] ? 400 : 0);
      var db = Math.abs(b.kcal - slotKcal) + (used[b.name] ? 400 : 0);
      return da - db;
    });
    var pick = candidates[(seed + slotIdx) % Math.min(2, candidates.length)];
    used[pick.name] = true;
    return { meal: row[0], pct: row[1], slotKcal: Math.round(slotKcal), recipe: pick };
  });
  var totalKcal = picks.reduce(function (s, p) { return s + p.recipe.kcal; }, 0);
  var shop = {};
  picks.forEach(function (p) {
    p.recipe.ingredients.forEach(function (ing) { shop[ing] = (shop[ing] || 0) + 1; });
  });
  var html = picks.map(function (p) {
    return '<div class="recipe"><h3>' + esc(mealLabel(p.meal)) + " — " + esc(p.recipe.name) + "</h3>" +
      '<div class="recipe-meta">' + esc(t("planner.slotLine", { slot: p.slotKcal, kcal: p.recipe.kcal, protein: p.recipe.protein })) + "</div>" +
      "<div>" + esc(t("planner.ingredients", { list: p.recipe.ingredients.join(", ") })) + "</div></div>";
  }).join("");
  html += '<div class="recipe"><h3>' + esc(t("planner.dayTotal")) + '</h3><div class="recipe-meta">' +
    esc(t("planner.dayTotalLine", { total: totalKcal, target: target })) + "</div></div>";
  html += '<div class="recipe"><h3>' + esc(t("planner.shopping")) + '</h3><ul class="shop-list">' +
    Object.keys(shop).sort().map(function (ing) {
      return "<li>" + esc(ing) + (shop[ing] > 1 ? " (×" + shop[ing] + ")" : "") + "</li>";
    }).join("") + "</ul></div>";
  $("plan-output").innerHTML = html;
}

/* ---------- Settings & theme ---------- */
function applyTheme() {
  var theme = state.settings.theme || "meadow";
  document.documentElement.setAttribute("data-theme", theme);
  $("theme-select").value = theme;
}

function applyLanguage() {
  document.documentElement.lang = state.settings.language || "en";
  applyI18n();
}

function renderSettings() {
  $("set-target").value = state.settings.target;
  $("set-unit").value = state.settings.unit;
  $("set-goal").value = state.settings.goal || "maintain";
  $("set-language").value = state.settings.language || "en";
  $("set-target-weight").value = state.settings.targetWeightKg != null ? round1(toDisplayWeight(state.settings.targetWeightKg)) : "";
  $("set-current-weight").value = state.settings.currentWeightKg != null ? round1(toDisplayWeight(state.settings.currentWeightKg)) : "";
  document.querySelectorAll(".set-unit-name").forEach(function (el) { el.textContent = unitLabel(); });
}

/* ---------- First-run setup wizard ---------- */
var GOAL_KCAL = { lose: 1800, maintain: 2000, gain: 2400 };
function goalText(g) { return t("goal." + g); }
var setupStep = 1;
var setupGoal = "maintain";

function setupShowStep(n) {
  setupStep = n;
  document.querySelectorAll(".setup-step").forEach(function (el) {
    el.hidden = Number(el.getAttribute("data-step")) !== n;
  });
  $("setup-progress").textContent = t("setup.stepN", { n: n });
  $("setup-back").hidden = n === 1;
  $("setup-next").textContent = n === 4 ? t("setup.start") : t("common.next");
  if (n === 4) setupFillSummary();
}

function setupSyncGoalButtons() {
  document.querySelectorAll("#setup-goals .seg-btn").forEach(function (b) {
    b.classList.toggle("active", b.getAttribute("data-goal") === setupGoal);
  });
}

function setupSyncUnitLabels() {
  var u = $("setup-unit").value === "kg" ? "kg" : "lb";
  document.querySelectorAll(".setup-unit-name").forEach(function (el) { el.textContent = u; });
}

function setupFillSummary() {
  var cur = $("setup-current").value, tgt = $("setup-target-weight").value;
  var u = $("setup-unit").value === "kg" ? "kg" : "lb";
  var s = t("setup.summaryGoal", { goal: goalText(setupGoal) });
  if (cur) s += t("setup.summaryCur", { w: cur, u: u });
  if (tgt) s += t("setup.summaryTgt", { w: tgt, u: u });
  $("setup-summary").textContent = s;
}

function openSetup() {
  setupGoal = state.settings.goal || "maintain";
  $("setup-unit").value = state.settings.unit || "lb";
  $("setup-current").value = state.settings.currentWeightKg != null ? round1(toDisplayWeight(state.settings.currentWeightKg)) : "";
  $("setup-target-weight").value = state.settings.targetWeightKg != null ? round1(toDisplayWeight(state.settings.targetWeightKg)) : "";
  $("setup-target").value = state.settings.target || GOAL_KCAL[setupGoal];
  setupSyncGoalButtons();
  setupSyncUnitLabels();
  $("setup-wizard").hidden = false;
  setupShowStep(1);
}

function closeSetup() { $("setup-wizard").hidden = true; }

function finishSetup(save) {
  if (save) {
    state.settings.goal = setupGoal;
    state.settings.unit = $("setup-unit").value === "kg" ? "kg" : "lb";
    var cw = $("setup-current").value;
    if (cw !== "" && Number(cw) > 0) {
      var kg = fromDisplayWeight(Number(cw));
      state.settings.currentWeightKg = kg;
      var t = todayStr();
      state.weights = state.weights.filter(function (w) { return w.date !== t; });
      state.weights.push({ date: t, kg: kg });
    }
    var tw = $("setup-target-weight").value;
    state.settings.targetWeightKg = tw === "" ? null : fromDisplayWeight(Number(tw));
    var tk = Number($("setup-target").value);
    if (tk >= 500 && tk <= 10000) state.settings.target = Math.round(tk);
  }
  state.settings.onboarded = true;
  saveState();
  closeSetup();
  renderSettings();
  renderAll();
}

/* ---------- Backup download / restore ---------- */
function downloadBackup() {
  var payload = {
    app: "calorie-counter", kind: "backup", version: 1,
    exportedAt: new Date().toISOString(),
    data: state, photos: [],
    stores: {
      favorites: favorites,
      recents: recents,
      recipes: myRecipes,
      fasting: fastingStore,
      reminders: reminderCfg
    }
  };
  var done = function () {
    var blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "calorie-counter-backup-" + todayStr() + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    $("backup-status").className = "status";
    $("backup-status").textContent = t("backup.done");
  };
  if (window.Photos && window.Photos.exportPhotos) {
    window.Photos.exportPhotos().then(function (list) { payload.photos = list || []; done(); }).catch(function () { done(); });
  } else { done(); }
}

function restoreBackup(file) {
  var reader = new FileReader();
  reader.onload = function () {
    var parsed = null;
    try { parsed = JSON.parse(reader.result); } catch (e) { parsed = null; }
    if (!parsed || parsed.app !== "calorie-counter" || !parsed.data || !parsed.data.settings) {
      $("backup-status").className = "status error";
      $("backup-status").textContent = t("backup.invalid");
      return;
    }
    if (!window.confirm(t("backup.confirmReplace"))) return;
    var fresh = defaultState();
    state = Object.assign(fresh, parsed.data);
    state.settings = Object.assign(defaultState().settings, parsed.data.settings);
    selectedDate = todayStr();
    waterDate = todayStr();
    saveState();
    // Newer backups also carry the extra stores; older ones simply omit them.
    if (parsed.stores && typeof parsed.stores === "object") {
      if (Array.isArray(parsed.stores.favorites)) saveJSON(FAV_KEY, parsed.stores.favorites);
      if (Array.isArray(parsed.stores.recents)) saveJSON(RECENT_KEY, parsed.stores.recents);
      if (Array.isArray(parsed.stores.recipes)) saveJSON(RECIPE_KEY, parsed.stores.recipes);
      if (parsed.stores.fasting && typeof parsed.stores.fasting === "object") saveJSON(FAST_KEY, parsed.stores.fasting);
      if (parsed.stores.reminders && typeof parsed.stores.reminders === "object") saveJSON(REMINDER_KEY, parsed.stores.reminders);
    }
    var finish = function () { window.location.reload(); };
    if (window.Photos && window.Photos.importPhotos && Array.isArray(parsed.photos)) {
      window.Photos.importPhotos(parsed.photos).then(finish).catch(finish);
    } else { finish(); }
  };
  reader.readAsText(file);
}

/* ---------- Erase confirmation (type ERASE to proceed) ---------- */
var eraseCallback = null;

function askErase(what, cb) {
  eraseCallback = cb;
  $("erase-text").textContent = what;
  var input = $("erase-input");
  input.value = "";
  $("erase-confirm").disabled = true;
  $("erase-modal").hidden = false;
  setTimeout(function () { input.focus(); }, 30);
}

function closeErase() {
  $("erase-modal").hidden = true;
  eraseCallback = null;
}

/* ---------- Render everything ---------- */
function renderAll() {
  renderHome();
  renderLog();
  renderQuickAdd();
  renderRecipeBuilder();
  renderTrends();
  renderWater();
  renderFasting();
  renderPlanner();
}

/* ---------- Events ---------- */
function init() {
  $("day-picker").value = selectedDate;
  $("weight-date").value = todayStr();
  applyTheme();
  applyLanguage();
  renderSettings();
  renderAll();
  setupVoice();

  document.querySelectorAll(".tab-btn").forEach(function (btn) {
    btn.addEventListener("click", function () { switchTab(btn.getAttribute("data-tab")); });
  });

  $("theme-select").addEventListener("change", function () {
    state.settings.theme = this.value;
    saveState(); applyTheme();
  });

  // Home calendar
  $("cal-prev").addEventListener("click", function () {
    calCursor.m--; if (calCursor.m < 0) { calCursor.m = 11; calCursor.y--; } renderCalendar();
  });
  $("cal-next").addEventListener("click", function () {
    calCursor.m++; if (calCursor.m > 11) { calCursor.m = 0; calCursor.y++; } renderCalendar();
  });

  // Log day navigation
  $("day-picker").addEventListener("change", function () {
    if (this.value) { selectedDate = this.value; renderAll(); }
  });
  $("day-prev").addEventListener("click", function () { selectedDate = shiftDate(selectedDate, -1); renderAll(); });
  $("day-next").addEventListener("click", function () { selectedDate = shiftDate(selectedDate, 1); renderAll(); });
  $("day-today").addEventListener("click", function () { selectedDate = todayStr(); renderAll(); });

  // Trends controls
  document.querySelectorAll("[data-range]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      trendsRange = Number(btn.getAttribute("data-range")) || 14;
      document.querySelectorAll("[data-range]").forEach(function (b) {
        b.classList.toggle("active", b === btn);
      });
      renderCalChart();
    });
  });
  $("micro-date").addEventListener("change", function () {
    if (this.value) { selectedDate = this.value; renderAll(); }
  });

  // Search
  $("search-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var q = $("search-input").value.trim();
    if (!q) return;
    var status = $("search-status");
    status.textContent = t("search.searching");
    status.className = "status";
    renderResults([]);
    var offP = searchOFF(q).catch(function () { return []; });
    var usdaP = searchUSDA(q).catch(function () { return []; });
    Promise.all([offP, usdaP]).then(function (both) {
      var results = both[0].concat(both[1]).slice(0, 16);
      if (!results.length) {
        status.textContent = t("search.noMatches");
        status.className = "status error";
      } else {
        status.textContent = results.length === 1 ? t("search.result1") : t("search.resultsN", { n: results.length });
      }
      renderResults(results);
      // Voice dictation may have supplied a quantity: prefill the first
      // result's quantity box (serving-mode rows have one) and clear it.
      if (voiceQty != null) {
        var firstQty = $("qty-0");
        if (firstQty) firstQty.value = voiceQty;
        voiceQty = null;
      }
    });
  });

  // Barcode: typed + camera
  $("barcode-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var code = $("barcode-input").value.replace(/\D/g, "");
    if (!code) {
      $("barcode-status").textContent = t("barcode.enterFirst");
      $("barcode-status").className = "status error";
      return;
    }
    lookupBarcode(code);
  });
  $("scan-btn").addEventListener("click", startScan);
  $("scan-stop").addEventListener("click", stopScan);

  // Weight
  $("weight-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var date = $("weight-date").value;
    var val = Number($("weight-value").value);
    if (!date || !(val > 0)) return;
    var kg = fromDisplayWeight(val);
    state.weights = state.weights.filter(function (w) { return w.date !== date; });
    state.weights.push({ date: date, kg: kg });
    state.settings.currentWeightKg = kg;
    saveState(); renderAll();
    $("weight-value").value = "";
  });

  // Water
  $("water-picker").addEventListener("change", function () { if (this.value) { waterDate = this.value; renderWater(); } });
  $("water-prev").addEventListener("click", function () { waterDate = shiftDate(waterDate, -1); renderWater(); });
  $("water-next").addEventListener("click", function () { waterDate = shiftDate(waterDate, 1); renderWater(); });
  $("water-today").addEventListener("click", function () { waterDate = todayStr(); renderWater(); });
  $("water-quick").addEventListener("click", function (e) {
    var btn = e.target.closest("[data-water-add]");
    if (btn) addWater(Number(btn.getAttribute("data-water-add")));
  });
  $("water-custom-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var v = Number($("water-custom").value);
    if (!(v > 0)) return;
    if ($("water-custom-unit").value === "oz") v = v * ML_PER_OZ;
    addWater(Math.round(v));
    $("water-custom").value = "";
  });
  $("water-reset").addEventListener("click", function () {
    state.water[waterDate] = 0;
    saveState(); renderWater();
  });
  $("water-goal-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var g = Number($("water-goal").value);
    var gMl = waterImperial() ? Math.round(g * ML_PER_OZ) : Math.round(g);
    if (gMl >= 250 && gMl <= 10000) {
      state.settings.waterGoalMl = gMl;
      saveState(); renderWater();
      $("water-status").textContent = waterImperial()
        ? t("water.savedImp", { x: round1(gMl / ML_PER_OZ) })
        : t("water.savedMet", { x: gMl });
    }
  });

  // Fasting
  $("fasting-start").addEventListener("click", startFast);
  $("fasting-end").addEventListener("click", endFast);
  $("fasting-cancel").addEventListener("click", cancelFast);
  setInterval(function () { if (fastingStore.current) updateFastingClock(); }, 1000);

  // Planner
  $("plan-meals").addEventListener("change", function () {
    state.planner.mealsPerDay = Number(this.value) || 3;
    saveState(); renderPlanner();
  });
  $("plan-save-ingredients").addEventListener("click", function () {
    state.planner.ingredients = $("plan-ingredients").value
      .split(/[,\n]/).map(function (s) { return s.trim(); }).filter(Boolean);
    saveState(); renderRecipeMatches();
  });
  $("plan-generate").addEventListener("click", generatePlan);

  // Recipe builder
  $("recipe-name").addEventListener("input", function () { recipeDraft.name = this.value; });
  $("recipe-servings").addEventListener("input", function () {
    var v = Number(this.value);
    recipeDraft.servings = v > 0 ? v : 1;
    renderRecipeBuilder();
  });
  $("recipe-search-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var q = $("recipe-search-input").value.trim();
    if (!q) return;
    var status = $("recipe-search-status");
    status.textContent = t("search.searching");
    status.className = "status";
    renderRecipeResults([]);
    var offP = searchOFF(q).catch(function () { return []; });
    var usdaP = searchUSDA(q).catch(function () { return []; });
    Promise.all([offP, usdaP]).then(function (both) {
      var results = both[0].concat(both[1]).slice(0, 12);
      if (!results.length) {
        status.textContent = t("recipes.noMatches");
        status.className = "status error";
      } else {
        status.textContent = results.length === 1 ? t("recipes.result1") : t("recipes.resultsN", { n: results.length });
        status.className = "status";
      }
      renderRecipeResults(results);
    });
  });
  $("recipe-save").addEventListener("click", saveRecipeDraft);
  $("recipe-cancel-edit").addEventListener("click", function () {
    resetRecipeDraft();
    renderRecipeBuilder();
    $("recipe-status").textContent = t("recipes.cancelledEdit");
    $("recipe-status").className = "status";
  });

  // Settings
  $("settings-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var target = Number($("set-target").value);
    if (target >= 500 && target <= 10000) state.settings.target = Math.round(target);
    state.settings.unit = $("set-unit").value === "kg" ? "kg" : "lb";
    state.settings.goal = ["lose", "maintain", "gain"].indexOf($("set-goal").value) >= 0 ? $("set-goal").value : "maintain";
    state.settings.language = $("set-language").value || "en";
    applyLanguage();
    var tw = $("set-target-weight").value;
    state.settings.targetWeightKg = tw === "" ? null : fromDisplayWeight(Number(tw));
    var cw = $("set-current-weight").value;
    if (cw !== "" && Number(cw) > 0) {
      var kg = fromDisplayWeight(Number(cw));
      state.settings.currentWeightKg = kg;
      var todayS = todayStr();
      state.weights = state.weights.filter(function (w) { return w.date !== todayS; });
      state.weights.push({ date: todayS, kg: kg });
    }
    saveState(); renderSettings(); renderAll();
    $("settings-status").textContent = t("settings.saved");
  });

  // Reminders
  renderReminderSettings();
  checkReminders();
  setInterval(checkReminders, 60000);
  $("reminder-banner-dismiss").addEventListener("click", function () {
    reminderBannerMsgs = [];
    showReminderBanner();
  });
  $("rem-save").addEventListener("click", function () {
    reminderCfg.enabled = $("rem-enabled").checked;
    reminderCfg.lunch = $("rem-lunch").value || "12:30";
    reminderCfg.dinner = $("rem-dinner").value || "18:30";
    saveReminders();
    var status = $("rem-status");
    status.className = "status";
    if (!reminderCfg.enabled) {
      status.textContent = t("reminders.offSaved");
      return;
    }
    if (!("Notification" in window)) {
      status.textContent = t("reminders.noSupport");
      checkReminders();
      return;
    }
    if (Notification.permission === "default") {
      Notification.requestPermission().then(function () {
        status.textContent = Notification.permission === "granted"
          ? t("reminders.onBackground")
          : t("reminders.deniedBanner");
        checkReminders();
      }).catch(function () {
        status.textContent = t("reminders.deniedBanner");
        checkReminders();
      });
    } else if (Notification.permission === "granted") {
      status.textContent = t("reminders.onBackground");
      checkReminders();
    } else {
      status.textContent = t("reminders.blockedBanner");
      checkReminders();
    }
  });

  // Setup wizard
  document.querySelectorAll("#setup-goals .seg-btn").forEach(function (b) {
    b.addEventListener("click", function () {
      setupGoal = b.getAttribute("data-goal");
      setupSyncGoalButtons();
      $("setup-target").value = GOAL_KCAL[setupGoal];
    });
  });
  $("setup-unit").addEventListener("change", setupSyncUnitLabels);
  $("setup-back").addEventListener("click", function () { if (setupStep > 1) setupShowStep(setupStep - 1); });
  $("setup-next").addEventListener("click", function () {
    if (setupStep < 4) setupShowStep(setupStep + 1);
    else finishSetup(true);
  });
  $("setup-skip").addEventListener("click", function () { finishSetup(false); });
  $("redo-setup").addEventListener("click", openSetup);
  if (!state.settings.onboarded) openSetup();

  // Backup / restore
  $("export-data").addEventListener("click", downloadBackup);
  $("import-data").addEventListener("click", function () { $("import-file").click(); });
  $("import-file").addEventListener("change", function () {
    if (this.files && this.files[0]) restoreBackup(this.files[0]);
    this.value = "";
  });

  $("erase-input").addEventListener("input", function () {
    $("erase-confirm").disabled = this.value.trim().toUpperCase() !== "ERASE";
  });
  $("erase-input").addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !$("erase-confirm").disabled) $("erase-confirm").click();
  });
  $("erase-confirm").addEventListener("click", function () {
    var cb = eraseCallback;
    closeErase();
    if (cb) cb();
  });
  $("erase-cancel").addEventListener("click", closeErase);
  $("erase-modal").addEventListener("click", function (e) {
    if (e.target === this) closeErase();
  });

  $("clear-data").addEventListener("click", function () {
    askErase(t("erase.settingsText"), function () {
      state = defaultState();
      EXTRA_KEYS.forEach(function (k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } });
      favorites = [];
      recents = [];
      myRecipes = [];
      fastingStore = { current: null, history: [] };
      reminderCfg = { enabled: false, lunch: "12:30", dinner: "18:30", lastFired: {} };
      if (typeof renderRecipeBuilder === "function") renderRecipeBuilder();
      if (typeof renderFasting === "function") renderFasting();
      if (typeof renderReminderSettings === "function") renderReminderSettings();
      selectedDate = todayStr();
      waterDate = todayStr();
      saveState(); applyTheme(); applyLanguage(); renderSettings(); renderAll();
      $("search-results").innerHTML = "";
      $("search-status").textContent = t("erase.done");
    });
  });
}

document.addEventListener("DOMContentLoaded", init);
