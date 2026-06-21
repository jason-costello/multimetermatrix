# Handheld Meters Browser

## What This Is

Static, faceted/sortable browser for ~940 handheld multimeter specs sourced from a Google Sheets export. Go CLI downloads and parses the xlsx into `data.json`; a zero-dependency HTML/JS frontend renders the table with column sort, per-column facet filters, and score-band color bucketing. Hosted on GitHub Pages, refreshed weekly via GitHub Actions. No backend, no auth, no npm build step.

## Core Value

Users can quickly find and compare handheld multimeters by filtering and sorting across 51 spec columns — replacing manual spreadsheet scrolling with a fast, faceted browser.

## Requirements

### Validated (Phase 1: CLI Pipeline)

- [x] Go CLI: `fetch` subcommand — download xlsx, validate magic bytes + size
- [x] Go CLI: `build` subcommand — parse xlsx → `data.json` with headers, values, bands, flags
- [x] Color bucketing: nearest Euclidean RGB distance for score bands, exact match for categorical markers

### Active

- [ ] Static frontend: table view with all 51 columns, ~940 rows
- [ ] Column sort: click header to toggle asc/desc
- [ ] Facet filters: checkbox lists for bands/flags columns, free-text/range for raw values
- [ ] Footer: edition date + last-refreshed timestamp from `data.json`
- [ ] CI/CD: weekly GitHub Actions refresh + workflow_dispatch
- [ ] GitHub Pages deployment

### Out of Scope

- Backend/API server — static only
- Authentication — public data
- npm build step — plain JS only
- Virtualization library — 942 rows renders fine as-is
- Sheet "Outsiders" — only process "6000+ count"

## Context

- Source data: Google Sheet at `https://docs.google.com/spreadsheets/d/1JB1xLWaXLOCWfANM1O_2Vgg_KKbl0wTQCi409aIV6Jg/export?format=xlsx`
- Example data: `meters.xlsx` in repo root for dev/test without hitting live URL
- 51 columns, row 1 = legend (fill RGB → label), row 2 = headers, rows 3+ = data
- Score legend: 5-point scale (V High → V Low) with continuous gradient, NOT exact color matches
- Categorical markers: x (missing/important missing), O (optional), ? (no info) — exact fill match
- Edition date stamp in row 1 (~col 47-48)

## Constraints

- **Tech stack**: Go (excelize for xlsx parsing), plain HTML/CSS/JS (no framework, no CDN deps)
- **Hosting**: GitHub Pages
- **Refresh**: Weekly via GitHub Actions, must fail loudly on data structure changes
- **No runtime dependencies**: Frontend must work with zero external JS/CSS fetches

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Go CLI for data pipeline | excelize is the best Go xlsx library; single binary, easy CI | Validated Phase 1 |
| Plain JS frontend (no framework) | GitHub Pages compatibility, zero build step, small scope | — Pending |
| Color bucketing via Euclidean RGB distance | Google Sheets conditional formatting produces interpolated gradient colors, not exact legend matches | Validated Phase 1 |
| `data.json` committed to repo | Simplifies GitHub Pages serving; avoids cross-origin fetch issues | Validated Phase 1 |

---
*Last updated: 2026-06-21 after Phase 1 completion*
