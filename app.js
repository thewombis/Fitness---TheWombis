"use strict";

/* Calorie Counter — standalone test build.
   Data sources: Open Food Facts and USDA FoodData Central public APIs.
   Persistence: browser localStorage only (per-device test data). */

var LS_KEY = "calorie-counter-test-v1";
var MEALS = ["Breakfast", "Lunch", "Dinner", "Snack"];
var LB_PER_KG = 2.2046226218;

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

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function round1(n) { return Math.round(n * 10) / 10; }

function defaultState() {
  return {
    settings: { target: 2000, unit: "lb", targetWeightKg: null, currentWeightKg: null },
    entries: {},   // { "YYYY-MM-DD": [ {id, name, brand, meal, grams, per100:{kcal,protein,carbs,fat}} ] }
    weights: []    // [ {date:"YYYY-MM-DD", kg:Number} ]
  };
}

function loadState() {
  try {
    var raw = localStorage.getItem(LS_KEY);
    if (!raw) return defaultState();
    var parsed = JSON.parse(raw);
    var base = defaultState();
    base.settings = Object.assign(base.settings, parsed.settings || {});
    base.entries = parsed.entries || {};
    base.weights = Array.isArray(parsed.weights) ? parsed.weights : [];
    return base;
  } catch (e) {
    return defaultState();
  }
}

var state = loadState();
var selectedDate = todayStr();

function saveState() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) { /* storage full or blocked */ }
}

function unitLabel() { return state.settings.unit === "kg" ? "kg" : "lb"; }
function toDisplayWeight(kg) { return state.settings.unit === "kg" ? kg : kg * LB_PER_KG; }
function fromDisplayWeight(v) { return state.settings.unit === "kg" ? v : v / LB_PER_KG; }

function $(id) { return document.getElementById(id); }

/* ---------- Nutrition scaling ---------- */
function scaled(per100, grams) {
  var f = grams / 100;
  return {
    kcal: per100.kcal * f,
    protein: per100.protein * f,
    carbs: per100.carbs * f,
    fat: per100.fat * f
  };
}

function dayEntries() { return state.entries[selectedDate] || []; }

function dayTotals() {
  var t = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  dayEntries().forEach(function (it) {
    var s = scaled(it.per100, it.grams);
    t.kcal += s.kcal; t.protein += s.protein; t.carbs += s.carbs; t.fat += s.fat;
  });
  return t;
}

/* ---------- Rendering: summary ---------- */
var RING_C = 2 * Math.PI * 74;

function renderSummary() {
  var totals = dayTotals();
  var target = state.settings.target || 2000;
  var remaining = target - totals.kcal;
  var frac = Math.max(0, Math.min(1, totals.kcal / target));

  var fg = $("ring-fg");
  fg.style.strokeDasharray = RING_C.toFixed(1);
  fg.style.strokeDashoffset = (RING_C * (1 - frac)).toFixed(1);
  fg.style.stroke = remaining < 0 ? "#b3392e" : "";

  $("ring-remaining").textContent = String(Math.round(Math.abs(remaining)));
  $("ring-remaining").parentElement.querySelector(".ring-label").textContent =
    remaining < 0 ? "kcal over target" : "kcal remaining";
  $("stat-target").textContent = String(target);
  $("stat-eaten").textContent = String(Math.round(totals.kcal));
  $("stat-date-label").textContent = selectedDate === todayStr() ? "Today" : selectedDate;
  $("stat-burned-note").textContent = dayEntries().length + (dayEntries().length === 1 ? " item" : " items");

  $("val-protein").textContent = round1(totals.protein) + " g";
  $("val-carbs").textContent = round1(totals.carbs) + " g";
  $("val-fat").textContent = round1(totals.fat) + " g";

  var pK = totals.protein * 4, cK = totals.carbs * 4, fK = totals.fat * 9;
  var mTotal = pK + cK + fK;
  function pct(x) { return mTotal > 0 ? Math.round((x / mTotal) * 100) : 0; }
  $("bar-protein").style.width = pct(pK) + "%";
  $("bar-carbs").style.width = pct(cK) + "%";
  $("bar-fat").style.width = pct(fK) + "%";

  $("day-picker").value = selectedDate;
}

/* ---------- Rendering: log ---------- */
function renderLog() {
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
      var s = scaled(it.per100, it.grams);
      mealKcal += s.kcal;
      rows += '<div class="log-item"><div>' +
        '<span class="log-name">' + esc(it.name) + "</span> " +
        '<span class="log-meta">' + (it.brand ? esc(it.brand) + " · " : "") + it.grams + " g · P " +
        round1(s.protein) + " · C " + round1(s.carbs) + " · F " + round1(s.fat) + "</span></div>" +
        '<div><span class="log-kcal">' + Math.round(s.kcal) + " kcal</span>" +
        '<button type="button" class="log-remove" data-remove="' + it.id + '" aria-label="Remove ' + esc(it.name) + '">&times;</button></div></div>';
    });
    html += '<div class="meal-group"><h3>' + meal + ' <span class="meal-kcal">' + Math.round(mealKcal) + " kcal</span></h3>" + rows + "</div>";
  });
  list.innerHTML = html;
  list.querySelectorAll("[data-remove]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = btn.getAttribute("data-remove");
      state.entries[selectedDate] = dayEntries().filter(function (i) { return String(i.id) !== String(id); });
      saveState(); renderAll();
    });
  });
}

function renderAll() { renderSummary(); renderLog(); renderWeight(); }

/* ---------- Search: Open Food Facts ---------- */
function offNutrients(n) {
  if (!n) return null;
  var kcal = n["energy-kcal_100g"];
  if (kcal == null && n["energy_100g"] != null) kcal = n["energy_100g"] / 4.184; // kJ to kcal
  if (kcal == null) return null;
  return {
    kcal: Number(kcal) || 0,
    protein: Number(n["proteins_100g"]) || 0,
    carbs: Number(n["carbohydrates_100g"]) || 0,
    fat: Number(n["fat_100g"]) || 0
  };
}

function searchOFF(query) {
  var url = "https://world.openfoodfacts.org/cgi/search.pl?action=process&json=1&page_size=12" +
    "&fields=code,product_name,brands,nutriments&search_terms=" + encodeURIComponent(query);
  return fetch(url).then(function (r) { return r.json(); }).then(function (data) {
    var out = [];
    (data.products || []).forEach(function (p) {
      var per100 = offNutrients(p.nutriments);
      if (!per100 || !p.product_name) return;
      out.push({ name: p.product_name, brand: p.brands || "", source: "Open Food Facts", per100: per100 });
    });
    return out;
  });
}

/* ---------- Search: USDA FoodData Central (DEMO_KEY, rate-limited) ---------- */
function searchUSDA(query) {
  var url = "https://api.nal.usda.gov/fdc/v1/foods/search?api_key=DEMO_KEY&pageSize=8&query=" + encodeURIComponent(query);
  return fetch(url).then(function (r) {
    if (!r.ok) throw new Error("USDA " + r.status);
    return r.json();
  }).then(function (data) {
    var out = [];
    (data.foods || []).forEach(function (f) {
      var per100 = { kcal: null, protein: 0, carbs: 0, fat: 0 };
      (f.foodNutrients || []).forEach(function (n) {
        if (n.nutrientId === 208 || n.nutrientId === 957 || n.nutrientId === 958) per100.kcal = n.value;
        if (n.nutrientId === 203) per100.protein = n.value || 0;
        if (n.nutrientId === 204) per100.fat = n.value || 0;
        if (n.nutrientId === 205) per100.carbs = n.value || 0;
      });
      if (per100.kcal == null || !f.description) return;
      out.push({ name: f.description, brand: f.brandName || "USDA generic", source: "USDA", per100: per100 });
    });
    return out;
  });
}

function renderResults(results) {
  var ul = $("search-results");
  if (!results.length) {
    ul.innerHTML = "";
    return;
  }
  ul.innerHTML = results.map(function (r, idx) {
    return '<li class="result"><div class="result-main">' +
      '<span class="result-name">' + esc(r.name) + "</span> " +
      '<span class="source-tag">' + esc(r.source) + "</span>" +
      '<div class="result-meta">' + (r.brand ? esc(r.brand) + " · " : "") +
      Math.round(r.per100.kcal) + " kcal · P " + round1(r.per100.protein) + " · C " + round1(r.per100.carbs) +
      " · F " + round1(r.per100.fat) + " per 100 g</div></div>" +
      '<input type="number" class="result-grams" id="grams-' + idx + '" value="100" min="1" step="1" aria-label="Grams"> g' +
      '<button type="button" class="btn btn-primary btn-small" data-add="' + idx + '">Add</button></li>';
  }).join("");
  ul.querySelectorAll("[data-add]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var idx = Number(btn.getAttribute("data-add"));
      var grams = Number($("grams-" + idx).value) || 100;
      addEntry(results[idx], grams);
    });
  });
}

function addEntry(food, grams) {
  var entry = {
    id: Date.now() + "-" + Math.floor(Math.random() * 100000),
    name: food.name,
    brand: food.brand || "",
    meal: $("meal-select").value,
    grams: Math.max(1, grams),
    per100: food.per100
  };
  if (!state.entries[selectedDate]) state.entries[selectedDate] = [];
  state.entries[selectedDate].push(entry);
  saveState(); renderAll();
  $("search-status").textContent = "Added " + food.name + " to " + entry.meal + ".";
  $("search-status").className = "status";
}

/* ---------- Weight ---------- */
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

  // Chart
  var box = $("weight-chart");
  if (ws.length < 2) {
    box.innerHTML = '<p class="hint">' + (ws.length === 1
      ? "One weigh-in logged. Add another on a different day to see your trend line."
      : "No weigh-ins yet. Add your first one below.") + "</p>";
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
    var svg = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Weight trend chart">';
    svg += '<line x1="' + padL + '" y1="' + padT + '" x2="' + padL + '" y2="' + (H - padB) + '" stroke="#e2e7ee"/>';
    svg += '<line x1="' + padL + '" y1="' + (H - padB) + '" x2="' + (W - padR) + '" y2="' + (H - padB) + '" stroke="#e2e7ee"/>';
    svg += '<text x="6" y="' + (Y(max) + 4) + '" font-size="11" fill="#5c6a7a">' + round1(max) + "</text>";
    svg += '<text x="6" y="' + (Y(min) + 4) + '" font-size="11" fill="#5c6a7a">' + round1(min) + "</text>";
    if (targetKg != null) {
      var ty = Y(toDisplayWeight(targetKg));
      svg += '<line x1="' + padL + '" y1="' + ty + '" x2="' + (W - padR) + '" y2="' + ty + '" stroke="#2e7d4f" stroke-dasharray="5 4"/>' +
        '<text x="' + (W - padR - 64) + '" y="' + (ty - 5) + '" font-size="11" fill="#256b42">target</text>';
    }
    svg += '<polyline points="' + pts + '" fill="none" stroke="#3a7bd5" stroke-width="2.5"/>';
    ws.forEach(function (w) {
      svg += '<circle cx="' + X(w.date).toFixed(1) + '" cy="' + Y(toDisplayWeight(w.kg)).toFixed(1) + '" r="3.5" fill="#3a7bd5"/>';
    });
    svg += '<text x="' + padL + '" y="' + (H - 6) + '" font-size="11" fill="#5c6a7a">' + esc(ws[0].date) + "</text>";
    svg += '<text x="' + (W - padR - 74) + '" y="' + (H - 6) + '" font-size="11" fill="#5c6a7a">' + esc(ws[ws.length - 1].date) + "</text>";
    svg += "</svg>";
    box.innerHTML = svg;
  }

  // List (newest first)
  $("weight-list").innerHTML = ws.slice().reverse().map(function (w) {
    return "<li><span>" + esc(w.date) + "</span><span>" + round1(toDisplayWeight(w.kg)) + " " + unit +
      ' <button type="button" class="log-remove" data-wremove="' + esc(w.date) + '" aria-label="Remove weigh-in on ' + esc(w.date) + '">&times;</button></span></li>';
  }).join("");
  $("weight-list").querySelectorAll("[data-wremove]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var d = btn.getAttribute("data-wremove");
      state.weights = state.weights.filter(function (w) { return w.date !== d; });
      saveState(); renderAll();
    });
  });
}

/* ---------- Settings ---------- */
function renderSettings() {
  $("set-target").value = state.settings.target;
  $("set-unit").value = state.settings.unit;
  $("set-target-weight").value = state.settings.targetWeightKg != null ? round1(toDisplayWeight(state.settings.targetWeightKg)) : "";
  $("set-current-weight").value = state.settings.currentWeightKg != null ? round1(toDisplayWeight(state.settings.currentWeightKg)) : "";
  document.querySelectorAll(".set-unit-name").forEach(function (el) { el.textContent = unitLabel(); });
}

/* ---------- Events ---------- */
function init() {
  $("day-picker").value = selectedDate;
  $("weight-date").value = todayStr();
  renderSettings();
  renderAll();

  $("day-picker").addEventListener("change", function () {
    if (this.value) { selectedDate = this.value; renderAll(); }
  });
  $("day-prev").addEventListener("click", function () { selectedDate = shiftDate(selectedDate, -1); renderAll(); });
  $("day-next").addEventListener("click", function () { selectedDate = shiftDate(selectedDate, 1); renderAll(); });
  $("day-today").addEventListener("click", function () { selectedDate = todayStr(); renderAll(); });

  $("search-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var q = $("search-input").value.trim();
    if (!q) return;
    var status = $("search-status");
    status.textContent = "Searching Open Food Facts and USDA…";
    status.className = "status";
    renderResults([]);
    var offP = searchOFF(q).catch(function () { return []; });
    var usdaP = searchUSDA(q).catch(function () { return []; });
    Promise.all([offP, usdaP]).then(function (both) {
      var results = both[0].concat(both[1]).slice(0, 16);
      if (!results.length) {
        status.textContent = "No matches found in either database. Try a different spelling, or use the barcode lookup below.";
        status.className = "status error";
      } else {
        status.textContent = results.length + " result" + (results.length === 1 ? "" : "s") + ". Set grams, then Add.";
      }
      renderResults(results);
    });
  });

  $("barcode-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var code = $("barcode-input").value.replace(/\D/g, "");
    var status = $("barcode-status");
    if (!code) { status.textContent = "Enter a barcode number first."; status.className = "status error"; return; }
    status.textContent = "Looking up barcode " + code + "…";
    status.className = "status";
    fetch("https://world.openfoodfacts.org/api/v2/product/" + encodeURIComponent(code) + ".json")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.status !== 1 || !data.product) {
          status.textContent = "No product found for that barcode in Open Food Facts.";
          status.className = "status error";
          return;
        }
        var per100 = offNutrients(data.product.nutriments);
        if (!per100) {
          status.textContent = "Product found, but it has no nutrition data in Open Food Facts.";
          status.className = "status error";
          return;
        }
        renderResults([{ name: data.product.product_name || ("Barcode " + code), brand: data.product.brands || "", source: "Open Food Facts", per100: per100 }]);
        status.textContent = "Found it. Set grams in the result above, then Add.";
      })
      .catch(function () {
        status.textContent = "Barcode lookup failed (network or service error). Please try again.";
        status.className = "status error";
      });
  });

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

  $("settings-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var target = Number($("set-target").value);
    if (target >= 500 && target <= 10000) state.settings.target = Math.round(target);
    state.settings.unit = $("set-unit").value === "kg" ? "kg" : "lb";
    var tw = $("set-target-weight").value;
    state.settings.targetWeightKg = tw === "" ? null : fromDisplayWeight(Number(tw));
    var cw = $("set-current-weight").value;
    if (cw !== "" && Number(cw) > 0) {
      var kg = fromDisplayWeight(Number(cw));
      state.settings.currentWeightKg = kg;
      var t = todayStr();
      state.weights = state.weights.filter(function (w) { return w.date !== t; });
      state.weights.push({ date: t, kg: kg });
    }
    saveState(); renderSettings(); renderAll();
  });

  $("clear-data").addEventListener("click", function () {
    if (!window.confirm("Erase all saved food logs, weigh-ins, and settings stored in this browser?")) return;
    state = defaultState();
    saveState(); renderSettings(); renderAll();
    $("search-results").innerHTML = "";
    $("search-status").textContent = "All saved data on this device has been erased.";
  });
}

document.addEventListener("DOMContentLoaded", init);
