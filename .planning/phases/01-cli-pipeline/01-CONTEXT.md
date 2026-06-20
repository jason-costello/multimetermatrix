# Phase 1: CLI Pipeline - Context

**Gathered:** 2026-06-20
**Status:** Ready for planning

## Phase Boundary

Go CLI (`cmd/meters/`) that downloads a Google Sheets xlsx export, parses it with excelize, buckets cell fill colors into score bands (nearest Euclidean distance) and categorical flags (exact match), then emits a validated `data.json`. Developers run `meters fetch && meters build` to produce structured data consumed by the Phase 2 frontend.

**In scope:** fetch subcommand, build subcommand, color bucketing, data.json emission, structural validation with loud failure.
**Out of scope:** Frontend table, CI/CD, GitHub Pages deployment (Phases 2-3).

## Implementation Decisions

### CLI Interface
- **D-01:** Subcommands are `meters fetch` (download xlsx) and `meters build` (parse → data.json)
- **D-02:** Default hardcoded Google Sheets export URL + `--url` flag override on `fetch`
- **D-03:** Fixed filenames — `fetch` always writes `meters.xlsx`, `build` reads `meters.xlsx` and writes `data.json` (no path flags)
- **D-04:** `--verbose` / `-v` flag on both subcommands for progress output (row count, color match stats, output file size). Silent by default.

### Color Space & Bucketing
- **D-05:** Color space: **linearized sRGB** — convert sRGB hex → linear RGB via inverse gamma, then Euclidean distance to each legend color
- **D-06:** Legend colors (both score bands AND categorical markers) extracted dynamically from row 1 at parse time — not hardcoded
- **D-07:** Tie-breaking for equidistant cells: assign the **higher** score band (more favorable to the meter spec)
- **D-08:** Categorical markers (`missing`, `important_missing`, `optional`, `no_info`) matched by **exact RGB** against legend row (not nearest-neighbor). White/no-fill cells → `none`.

### data.json Schema
- **D-09:** `columns[]` — array of strings (column header names only, no type metadata)
- **D-10:** `values{}` and `bands{}` keyed by **column name string** in each row object
- **D-11:** `edition_date` and `fetched_at` as **ISO 8601 strings** (e.g., `"2026-06-20T14:30:00Z"`)
- **D-12:** `rows[]` as **flat array** in positional/sheet order (not keyed by model name)

### Error Reporting
- **D-13:** `build` lists **ALL structural mismatches** at once (missing headers, wrong column count, malformed legend) before exiting
- **D-14:** Error output: **clean stderr messages** only — no Go stack traces. Human-readable, suitable for CI logs
- **D-15:** Exit codes follow Unix conventions:
  - `0` — success
  - `1` — general/internal error
  - `2` — invalid usage (bad flags, missing args)
  - `3` — fetch HTTP error
  - `4` — xlsx parse/validation error
  - `5` — data validation error
- **D-16:** `fetch` produces **distinct error messages per HTTP failure type** (404, 5xx, timeout, DNS failure) — each grep-able

### Claude's Discretion
- Go module internal layout — how to split files under `cmd/meters/` (fetch.go, parse.go, color.go, model.go, main.go per CLAUDE.md architecture)
- Exact Euclidean distance threshold for "close enough" when matching categorical markers
- Whether to use `excelize` streaming row iteration or full-load for 942 rows
- Test strategy specifics (golden files, table-driven tests)

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Scope
- `.planning/PROJECT.md` — Project overview, constraints, key decisions, sheet structure details
- `.planning/REQUIREMENTS.md` — All PIPE-01 through PIPE-08 requirements with acceptance criteria
- `.planning/ROADMAP.md` §Phase 1 — Success criteria (5 items that must be TRUE)

### Project Conventions
- `CLAUDE.md` — Architecture diagram, build commands, color handling nuance, sheet structure assumptions

### Data Fixture
- `meters.xlsx` — Reference Google Sheets export for development and testing (do not commit generated `data.json` from local runs)

## Existing Code Insights

**Greenfield.** No source files exist yet under `cmd/`, `site/`, or `.github/`. The project was initialized with research and requirements only.

### Integration Points
- `data.json` emitted to repo root — Phase 2 frontend loads it via `fetch('./data.json')`
- CI workflow (Phase 3) will call the CLI in GitHub Actions — exit codes and stderr messages feed into CI failure detection

## Specific Ideas

None — no particular references or example CLIs were mentioned. Standard Go CLI patterns apply.

## Deferred Ideas

None — discussion stayed within Phase 1 scope.

---

*Phase: 1-CLI Pipeline*
*Context gathered: 2026-06-20*
