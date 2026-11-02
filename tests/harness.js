"use strict";

/* Test harness: loads i18n.js + app.js into a vm sandbox with minimal
   browser stubs (in-memory localStorage, no-op document) so the app's
   pure functions — serving parser, nutrition scaling, state loading —
   can be unit-tested in node without a browser. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadScripts(sandbox, files) {
  vm.createContext(sandbox);
  files.forEach(function (f) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", f), "utf8"), sandbox, { filename: f });
  });
  return sandbox;
}

function loadApp(seedStorage) {
  const store = Object.assign({}, seedStorage || {});
  const sandbox = {
    console: console,
    localStorage: {
      getItem: function (k) { return k in store ? store[k] : null; },
      setItem: function (k, v) { store[k] = String(v); },
      removeItem: function (k) { delete store[k]; }
    },
    document: {
      addEventListener: function () {},
      documentElement: { lang: "en", setAttribute: function () {} },
      querySelectorAll: function () { return []; },
      title: ""
    },
    navigator: {},
    _store: store
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  return loadScripts(sandbox, ["i18n.js", "recipes.js", "fasting.js", "app.js"]);
}

/* A permissive fake DOM: getElementById auto-creates element stubs with
   the properties the app writes to, so init() and the renderers can run
   end to end. Used by the smoke tests to exercise feature flows. */
function makeElement() {
  const el = {
    children: [], style: {}, dataset: {}, value: "", textContent: "", innerHTML: "",
    hidden: false, disabled: false, checked: false, files: null, className: "",
    classList: { add: function () {}, remove: function () {}, toggle: function () {}, contains: function () { return false; } },
    addEventListener: function () {}, removeEventListener: function () {},
    querySelector: function () { return makeElement(); },
    querySelectorAll: function () { return []; },
    setAttribute: function () {}, getAttribute: function () { return null; },
    removeAttribute: function () {}, appendChild: function () {}, click: function () {},
    focus: function () {}, scrollIntoView: function () {}
  };
  el.parentElement = makeElementShallow();
  return el;
}
function makeElementShallow() {
  return {
    style: {},
    querySelector: function () { return makeElement(); },
    querySelectorAll: function () { return []; }
  };
}

function loadAppWithDom(seedStorage) {
  const store = Object.assign({}, seedStorage || {});
  const elements = {};
  let domReady = null;
  const sandbox = {
    console: console,
    localStorage: {
      getItem: function (k) { return k in store ? store[k] : null; },
      setItem: function (k, v) { store[k] = String(v); },
      removeItem: function (k) { delete store[k]; }
    },
    document: {
      addEventListener: function (ev, fn) { if (ev === "DOMContentLoaded") domReady = fn; },
      getElementById: function (id) {
        if (!elements[id]) elements[id] = makeElement();
        return elements[id];
      },
      querySelectorAll: function () { return []; },
      querySelector: function () { return null; },
      createElement: function () { return makeElement(); },
      documentElement: { lang: "en", setAttribute: function () {} },
      body: { appendChild: function () {} },
      title: ""
    },
    navigator: {},
    setInterval: function () { return 0; },
    clearInterval: function () {},
    setTimeout: function () { return 0; },
    clearTimeout: function () {},
    _store: store,
    _elements: elements,
    _fireDomReady: function () { if (domReady) domReady(); }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  return loadScripts(sandbox, ["i18n.js", "recipes.js", "fasting.js", "app.js"]);
}

module.exports = { loadApp: loadApp, loadAppWithDom: loadAppWithDom };
