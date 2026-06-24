# Handheld Meters Browser — Project Spec

## Goal
Static, faceted/sortable browser for a Google Sheets export of handheld multimeter
specs. No backend, no auth. Hosted on GitHub Pages. Data refreshed weekly via
GitHub Actions.

## Source data
- Google Sheet, "Anyone with the link" viewer access.
- Export URL (confirmed working, no auth):
  `https://docs.google.com/spreadsheets/d/1JB1xLWaXLOCWfANM1O_2Vgg_KKbl0wTQCi409aIV6Jg/export?format=xlsx`
- Sheet "6000+ count" is the data sheet (51 cols x ~940 rows). **Ignore sheet
  "Outsiders".**
- Row 1: legend (see below). Row 2: column headers. Row 3+: data.

## Row 2 headers (51 cols, in order)
Model, Brand, Count, AC+, BW, DUT, uV, V Accuracy, A, uA, I Accuracy, bw, uΩ,
nS/MΩ, Cn, pF, mF, Dio, □Hz, %, W, T°, PC, Kit, Int Log, Clk, Dsp, Light, 'I''I',
M/m, Peak, Hld, dB, LoZ, VFD, Evt, Batt, Life, F G, E Pwr, Jack, Fuse, CAT, UL,
EMC, IP, P/F, 4-20, NCV, Price, Yr

## Row 1 legend (cell fill RGB → meaning)
Score scale (continuous gradient, NOT discrete — see "Color handling" below):
| Label   | RGB swatch |
|---------|------------|
| V High  | 76923C |
| High    | 99CC00 |
| Average | D4CC00 |
| Low     | FFCC00 |
| V Low   | FF5700 |

Categorical markers (exact match, not gradient):
| Symbol | Meaning                    | RGB |
|--------|-----------------------------|-----|
| x      | Missing feature             | DDD9C3 |
| x      | Important missing feature   | 7F7F7F |
| O      | Optional                    | 8DB3E2 |
| ?      | No info                     | CCC0D9 |

Sheet also has an "Edition:" date stamp (row1, ~col 47-48) — capture this and
surface it in the UI footer ("Data as of <date>, refreshed <fetch date>").

## Color handling — important nuance
Verified empirically: numeric/spec columns use a **continuous color-scale**
(Google Sheets conditional formatting), not the 5 exact legend colors. E.g. in
the amperage column, observed fills include `FF7A00`, `FFA900` etc. — interpolated
between V Low and High, not literal matches.

Approach:
1. For each data cell, get fill RGB.
2. If it exactly matches one of the 4 categorical marker colors → tag with that
   category (`missing`, `important_missing`, `optional`, `no_info`).
3. Otherwise, compute nearest of the 5 legend score colors by Euclidean RGB
   distance → bucket into one of `V High/High/Average/Low/V Low`. This is an
   approximation of the gradient, used only for faceting (not displayed as exact
   score).
4. White/no-fill/blank cells → `none` (no facet value).

This bucketed label is what gets exposed as a facet per spec column, in addition
to the raw value itself (so user can both sort by raw number and facet by score
band).

## Architecture
```
/cmd/meters/
  main.go        — CLI: `fetch` and `build` subcommands
  fetch.go        — downloads xlsx, validates it's a real xlsx (not HTML)
  parse.go        — excelize: read sheet, row1 legend, row2 headers, rows 3+
  color.go        — nearest-color bucketing + marker matching
  model.go        — Meter struct, JSON output schema
/site/
  index.html
  app.js          — facet/sort UI, reads data.json
  style.css
data.json          — generated, committed by CI
.github/workflows/refresh.yml
go.mod
```

## Go CLI behavior
- `go run ./cmd/meters fetch` — wget/http GET the export URL to `meters.xlsx`.
  Fail (non-zero exit) if:
  - HTTP status != 200
  - downloaded file doesn't start with the ZIP magic bytes (`PK`) — catches the
    HTML-login-page failure mode
  - file size below a sane threshold (e.g. < 10KB)
- `go run ./cmd/meters build` — parse `meters.xlsx` → `data.json`. Fail loudly on
  missing expected headers (sheet structure changed) rather than silently
  emitting partial data.

## data.json schema (draft)
```json
{
  "edition_date": "2026-01-24",
  "fetched_at": "2026-06-20T06:00:00Z",
  "columns": ["Model","Brand","Count","AC+", "..."],
  "rows": [
    {
      "values": {"Model": "S Energy", "Brand": "Gossen", "Count": 60000, "...": "..."},
      "bands":  {"AC+": "high", "uV": "v_high", "Price": "low", "...": "..."},
      "flags":  {"DUT": "optional", "Light": "missing"}
    }
  ]
}
```
- `values`: raw cell value (string/number) per column.
- `bands`: nearest-score-bucket per numeric/gradient column (omitted if N/A).
- `flags`: categorical marker per column where applicable.

## Front end (static HTML/JS, no build step)
- Table view, all 51 columns, virtualized or paginated (942 rows — plain
  rendering is fine, no need for virtualization library).
- Facets: one filter control per column — for `flags` columns, checkbox list
  (missing/important_missing/optional/no_info); for `bands` columns,
  checkbox list (V High..V Low); free-text/range filter for plain numeric/text
  columns (Model, Brand, Price, etc).
- Column sort: click header, toggle asc/desc.
- Footer: edition date + last-refreshed timestamp from data.json.
- No external runtime dependencies beyond what's vendored/CDN-free (keep it
  GitHub-Pages-trivial — plain JS, no npm build step required).

## CI/CD

### Workflow
`.github/workflows/refresh.yml` (two jobs):
- **Triggers:** `schedule` (`0 6 * * 1`, Monday 06:00 UTC) + `workflow_dispatch` (manual)
- **Job 1 (build):** checkout → setup-go (Go 1.25.0 from go.mod) → `go run ./cmd/meters fetch` → `go run ./cmd/meters build` → conditional commit of `data.json` if changed → prepare deploy artifact (index.html, data.json, site/*, .nojekyll) → upload-pages-artifact
- **Job 2 (deploy):** depends on build → deploy-pages (skipped if build fails, keeping old deployment up)
- **Concurrency:** Group `pages`, cancel-in-progress: false (no race between overlapping runs)
- **Permissions:** contents:write (git commit), pages:write + id-token:write (Pages deploy)

### GitHub Pages Setup (one-time)
1. Go to repo Settings → Pages → Source: select "GitHub Actions"
2. The workflow will deploy automatically on schedule or via `workflow_dispatch`
3. Deploy artifact contains: `index.html`, `data.json`, `site/*` (app.js, engine.js, style.css), `.nojekyll`

### data.json Strategy
- `data.json` is committed to git for local dev convenience (`git clone` + open index.html works immediately)
- CI conditionally commits fresh `data.json` on each successful run (only when data changed, avoiding no-op commits)
- `git diff --quiet data.json` check prevents empty commit noise

### Failure Safety
- If `meters fetch` or `meters build` exits non-zero (sheet structure changed, HTTP error), the deploy job is skipped automatically via `needs: build` dependency
- Stale data is never deployed — the existing GitHub Pages deployment stays up with the last known good state
