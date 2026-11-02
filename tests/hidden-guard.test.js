/* Regression guard for the stranded-Dismiss bug: an author display rule
   (e.g. .reminder-banner { display:flex }) overrides the hidden attribute,
   so "hidden" elements stayed on screen. styles.css must carry a global
   [hidden] display:none guard. */
const fs = require("fs");
const css = fs.readFileSync(__dirname + "/../styles.css", "utf8");
if (!/\[hidden\]\s*\{\s*display:\s*none\s*!important/.test(css)) {
  console.error("hidden-guard.test.js: styles.css is missing the global [hidden] { display: none !important; } guard");
  process.exit(1);
}
console.log("hidden-guard.test.js: all tests passed");
