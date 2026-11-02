# Calorie Counter — Standalone Test Build

A standalone, Vercel-deployable version of the calorie counter app, built for public testing at **thewombis.com**.

This is a fresh static implementation (plain HTML, CSS, and JavaScript — no build step, no framework, no server code). It was prepared separately from the Muse-hosted version, which is server-backed and cannot be exported.

## What works in this build

- **Food search** against two free public databases, no personal API key needed:
  - Open Food Facts (branded/packaged products, supplements, vitamins)
  - USDA FoodData Central (generic foods; uses the shared `DEMO_KEY`, which is rate-limited — if USDA results fail, Open Food Facts results still load)
- **Barcode lookup** by typing or pasting a barcode number (Open Food Facts product database). Camera scanning is not included in this static build.
- **Per-day food log** grouped by meal (Breakfast / Lunch / Dinner / Snack), with serving size in grams, day navigation (previous/next/date picker)
- **Daily calorie target ring** (eaten vs. remaining) plus protein / carbs / fat totals
- **Weight log**: dated weigh-ins, current vs. target weight, and an SVG trend chart with the target line
- **Settings**: daily calorie target, units (lb/kg), current and target weight
- **Persistence via browser localStorage** on each visitor's own device (see the limitation below)

## Important limitation — test data only

All logs, weigh-ins, and settings are stored **only in each visitor's browser (localStorage) on their own device**. There are no accounts, no syncing between devices, and no server database. Clearing browser data erases the logs. This is stated in the app's footer as well. Features of the Muse-hosted version that depended on a server — user accounts, AI plate-photo logging, the progress photo diary, meal-planner recipe generation, workout tabs with animated form demos, water tracking, color themes, and micronutrient (vitamin/mineral) tracking — are **not** included in this static port.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The app page |
| `styles.css` | Styling (mobile-responsive) |
| `app.js` | All app logic, database lookups, localStorage persistence |
| `vercel.json` | Minimal Vercel config (clean URLs; no build settings needed) |
| `README.md` | This file |

## Deploy to Vercel (exact steps)

You need: a free Vercel account (Hobby plan) and this project in a Git repository (GitHub is easiest), **or** the Vercel CLI.

### Option A — Import from GitHub (recommended)

1. Put this folder's contents in a GitHub repository (the files above should sit at the repository root).
2. Go to [vercel.com](https://vercel.com) and sign in.
3. Click **Add New… → Project**.
4. Choose **Import** next to your repository.
5. Framework Preset: leave it as **Other** (or "No framework"). Build Command: leave **empty**. Output Directory: leave **empty/default**. This is a static site — no build step is required.
6. Click **Deploy**. After about a minute you get a free `*.vercel.app` address.
7. Open that address and smoke-test: search a food, add it, add a weigh-in, reload the page and confirm the entries are still there.

### Option B — Vercel CLI from this folder

1. Install the CLI: `npm i -g vercel`
2. From inside this folder, run: `vercel`
3. Sign in when prompted, accept the defaults (no build command, no output directory override), and deploy.
4. For production: `vercel --prod`

### Attach the custom domain (thewombis.com)

1. In Vercel: open the project → **Settings → Domains** → add `thewombis.com` and `www.thewombis.com`. Set the apex (`thewombis.com`) as the primary domain.
2. In **GoDaddy** (domain registrar — GoDaddy stays registrar/DNS only; do not buy GoDaddy hosting), open the DNS records for `thewombis.com` and add exactly:

   | Type | Name | Value |
   | --- | --- | --- |
   | A | @ | 76.76.21.21 |
   | CNAME | www | cname.vercel-dns.com |

3. Remove any conflicting existing A or CNAME records for `@` and `www` (for example GoDaddy parking or website-forwarding records), or the domain will not point at Vercel.
4. Wait for Vercel to show the domain as verified and HTTPS active. DNS changes usually propagate within minutes but can take up to a few hours; Vercel issues the HTTPS certificate automatically.
5. Visit `https://thewombis.com` and repeat the smoke test from step 7 above.

## Pricing note

Vercel's Hobby plan is free and is for non-commercial testing. If the app is ever monetized (payments, ads, subscriptions), Vercel's terms require the Pro plan ($20 per developer seat/month). No action is needed for testing.
