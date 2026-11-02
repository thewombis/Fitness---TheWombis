# Calorie Counter

A full-featured calorie and nutrition tracker that runs entirely in the browser, live at **thewombis.com**. Plain HTML, CSS, and JavaScript — no build step, no framework, no server code. Deployed on Vercel straight from this repository: every push to `main` redeploys the site.

## Features

- **Home** — today's calorie target ring with macro split, logging streak, 7-day average, and a month calendar showing per-day calorie totals (tap any day to open it in the Log).
- **Log** — food search across two free public databases (Open Food Facts for branded products, USDA FoodData Central for generic foods), typed barcode lookup, and **camera barcode scanning** where the browser supports `BarcodeDetector` (Chrome/Android; the typed lookup works everywhere). Entries are grouped by meal with per-day navigation.
- **Trends** — calorie history bar chart (14- and 30-day views) against your target, protein/carbs/fat charts for the last 14 days, a weight trend chart with target line, and **micronutrient progress bars** (fiber, iron, calcium, vitamins A, C, D, B12, folate, potassium) computed from the nutrients your logged foods report.
- **Water** — daily water log in ml and fl oz with quick-add buttons, custom amounts, and a settable daily goal, stored per day.
- **Workouts** — an at-home, minimal-equipment exercise library (35 exercises) grouped Push / Pull / Legs & Core / Full-Body, from beginner progressions (wall push-ups, knee push-ups) to advanced (pull-ups, pike push-ups, hollow holds). Every exercise has an **animated form demonstration** with start- and peak-position captions that highlight in time with the movement, plus a pause control.
- **Meal Planner** — splits your daily calorie target across 3–7 meals/snacks with percentage guidance; matches a built-in recipe set against the ingredients you say you have at home; and, for an empty kitchen, generates a day of recipes that fits your split plus a consolidated shopping list.
- **Photo Diary** — progress photos (front / side / back) organized by date, captured with the camera or uploaded, with a translucent "ghost" of your previous same-angle photo and an on-screen body outline so you can reproduce the same framing. Includes a per-angle **time-lapse player**. Photos live only in your browser's IndexedDB.
- **Themes** — six selectable color schemes (Meadow, Ocean, Sunset, Berry, Slate, Midnight), saved per user.

## Data & privacy

All data stays on the visitor's own device: food logs, weigh-ins, water, plans, and settings in `localStorage`; progress photos in IndexedDB. There are **no user accounts and no cloud sync in this version**, and nothing is uploaded to a server. AI plate-photo recognition is also not part of this version. Clearing browser data erases the stored data; the app itself provides erase controls in Settings and in the Photo Diary.

Nutrition values come from the [Open Food Facts](https://world.openfoodfacts.org) and [USDA FoodData Central](https://fdc.nal.usda.gov) public APIs (USDA uses the shared `DEMO_KEY`, which is rate-limited — if USDA results fail, Open Food Facts results still load). Values are as published by those sources. Micronutrient totals are a floor, not an exact total: foods that don't publish a nutrient contribute 0 for it.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The app page (tabbed single-page UI) |
| `styles.css` | Styling, themes, mobile-responsive layout |
| `app.js` | Core app: state, food search/barcode, log, home, trends, water, meal planner, settings |
| `workouts.js` | Exercise library and the animated form-demo player |
| `photos.js` | Photo diary: IndexedDB storage, camera capture, ghost overlay, time-lapse |
| `vercel.json` | Minimal Vercel config (clean URLs; no build settings needed) |
| `README.md` | This file |

## Deployment

The site is hosted on Vercel and connected to this GitHub repository: pushing to `main` triggers a production deploy to thewombis.com automatically. To run it locally, serve the folder with any static file server, e.g. `python3 -m http.server` in this directory, and open `http://localhost:8000`.

## Pricing note

Vercel's Hobby plan is free and covers personal, non-commercial use. If the app is ever monetized (payments, ads, subscriptions), Vercel's terms require the Pro plan ($20 per developer seat/month).
