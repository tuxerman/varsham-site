# Malayalam Calendar — static site

A single-page Malayalam panchangam calendar. Editorial-grid month view on wide
screens, a one-row-per-day list on phones; tap any day for the full panchangam.

**Live data range:** January 2026 – December 2027.

## Layout

```
index.html      app shell (loads Google Fonts + app.css + app.js)
app.css         all styles — grid view, mobile list, day-detail dialog
app.js          ~300 lines vanilla JS, no dependencies
_headers        Cloudflare Pages cache rules
404.html        served automatically for unknown paths
data/
  index.json    { months: [...], build: "<id>" }  — the app reads this first
  YYYY-MM.json   one file per month, rendered directly by the frontend
```

## How it works

- On load, `app.js` fetches `data/index.json` for the month range and a build
  id, then `data/<YYYY-MM>.json` for the month in the URL hash (`#/2026-01`,
  default = current month if in range).
- Month files are fetched with `?v=<build id>` so a redeploy busts the cache.
- The grid vs. list switch is CSS (`@media (max-width: 640px)`); same data.
- The day-detail dialog is a native `<dialog>` — centred card on desktop,
  full-screen sheet on mobile.

## Updating the data

The JSON in `data/` is generated from the private `varsham-data` repo
(`scraper/export_site.py` → `db/calendar.db`). To refresh or extend the range:
regenerate there, copy the new `data/` here, commit, push. Cloudflare Pages
redeploys on push.

## Deploying to Cloudflare Pages

Connect this repo as a Pages project:

| Setting | Value |
|---|---|
| Framework preset | None |
| Build command | *(blank)* |
| Build output directory | `/` |

The files are at the repo root, so `index.html` is served at `/` with no build
step. Every push to the production branch redeploys (~10 s).

## Local preview

```bash
python3 -m http.server 8000
# open http://localhost:8000/#/2026-01
```
