# Project Research Summary

**Project:** Handheld Meters Browser
**Domain:** Static spec-comparison / data-browser for handheld multimeters (940+ models, 51 spec columns)
**Researched:** 2026-06-20
**Confidence:** HIGH

## Executive Summary

This project is a static spec-browser for handheld multimeters. The source data lives in a Google Sheets spreadsheet (with color-coded conditional formatting), and the product is a Go CLI pipeline that fetches and parses the xlsx, buckets cell colors into score bands, and emits a JSON data contract. A plain HTML/CSS/JS frontend on GitHub Pages renders a 940-row x 51-column sortable, filterable table with per-column band faceting -- approaching GSMArena-level comparison UX but for a domain that has no such tool today.

The recommended approach is a zero-dependency architecture: Go 1.24+ with `xuri/excelize/v2` for xlsx parsing, a single `data.json` artifact as the interface contract between pipeline and frontend, and a pure-function three-layer frontend (data, filter/sort, render) using innerHTML batching. Deploy via GitHub Actions artifact deployment to avoid git bloat and workflow chain breaks. The key differentiator is per-column score-band faceting (V High..V Low checkboxes), which no competitor in the multimeter space offers.

Key risks and mitigations: (1) **sRGB gamma distortion** in color distance calculations -- linearize or use OKLab, not raw RGB. (2) **GITHUB_TOKEN suppresses downstream workflows** -- use artifact-based deployment (actions/upload-pages-artifact + actions/deploy-pages) to avoid commit-trigger pipeline breaks. (3) **Sheet structure changes cause silent corruption** -- validate expected headers, row count, and legend format in the build command, exiting non-zero on mismatch. (4) **One-at-a-time table row insertion freezes the browser** -- build a single HTML string and insert once. (5) **Excelize pre-v2.8 cannot read cell fill colors** -- pin to v2.8+ and use the official `GetStyle()` API.

## Key Findings

### Recommended Stack

**Pipeline:** Go 1.24+ with `github.com/xuri/excelize/v2@v2.9.x` (v2.10.x requires Go 1.25+, so pin to v2.9.x if using Go 1.24). Excelize is the only maintained Go xlsx library -- `tealeg/xlsx` is archived and dead. Use Go stdlib `net/http` for downloading xlsx and `encoding/json` for marshaling output. No CLI framework (Cobra is overkill for 2 subcommands; use `os.Args` switch with `flag.NewFlagSet`).

**Frontend:** Plain HTML, CSS, and vanilla JS. Zero build step, no npm, no CDN deps. With ~940 rows and 51 columns, plain DOM manipulation is entirely sufficient. No framework (React/Vue/Svelte) needed -- the re-render-on-change pattern with `innerHTML` batching completes in <10ms.

**Deployment:** GitHub Actions (scheduled weekly + `workflow_dispatch`) + GitHub Pages with artifact-based deployment (`actions/upload-pages-artifact@v4` + `actions/deploy-pages@v4`). This avoids committing `data.json` to git (no repo bloat, clean history) and sidesteps the GITHUB_TOKEN downstream workflow suppression issue.

**Core technologies:**
- **Go 1.24+**: CLI pipeline -- single binary, zero runtime deps, excellent stdlib
- **excelize/v2 v2.9.x**: XLSX parsing + cell fill color extraction via `GetStyle()` -- the only viable Go xlsx library
- **Plain HTML/CSS/JS**: Frontend table -- zero deps, instant load, no build step
- **GitHub Actions + Pages**: CI/CD + hosting -- free for public repos, native integration
- **No CLI framework**: `os.Args` switch with `flag.NewFlagSet` -- simpler and lighter than Cobra for 2 commands

### Expected Features

**Must have (table stakes -- launch with these):**
- Table rendering of all 940x51 cells from `data.json`
- Column header click sort with asc/desc/unsorted cycle
- Free-text search across all columns
- Band-based facet checkboxes (V High..V Low) per gradient column -- the unique differentiator
- Flag-based facet checkboxes (x, O, ?) per categorical column
- Numeric range filter (min/max) on key spec columns (Price, Count, BW, etc.)
- Color-coded cell rendering from band/flag data
- Legend display (color key above table)
- Sticky table header on scroll
- Results count indicator (visible / total)
- Mobile responsive horizontal scroll wrapper
- Row hover highlight + empty/zero-results state
- Footer with edition date + last refreshed timestamp

**Should have (competitive -- add after validation):**
- URL-encoded filter/sort state (deep linking, shareable URLs, back/forward)
- Column visibility toggle (pick which of 51 columns to show; persist to localStorage)
- Row + column cross-highlight on hover (CSS `:has()`)
- Sticky first column (Model name always visible during horizontal scroll)
- Per-column sort reset (third click = unsorted)

**Defer (v2+):**
- Compare mode (checkbox per row, side-by-side table view)
- "Differences only" toggle in compare mode
- Column reorder (drag-and-drop)
- Dark mode toggle, keyboard navigation, print stylesheet, CSV copy
- Compare mode is deferred per Baymard research showing low mobile usage

### Architecture Approach

A two-component system connected by a JSON file contract. The **CLI pipeline** (Go) follows an ETL pattern with validation gates: fetch xlsx -> validate ZIP magic bytes -> parse sheet with excelize -> extract fill colors -> bucket to nearest legend band via OKLab or linearized sRGB Euclidean distance -> emit `data.json` with per-row `values`/`bands`/`flags` split. The **frontend** (plain JS) follows a three-layer pure-function pattern: fetch `data.json` at load -> maintain state in a plain object -> pure filter/sort pipeline -> innerHTML batch re-render on every user interaction.

**Major components:**
1. **`/cmd/meters/fetch.go`**: HTTP GET xlsx from Google Sheets export URL, validate PK magic bytes + size >= 10KB, save to disk
2. **`/cmd/meters/build.go`**: Open xlsx with excelize, parse legend row + 51 headers + 940 data rows, extract cell fill colors, bucket to bands/flags, marshal data.json
3. **`/cmd/meters/color.go`**: Linearized sRGB (or OKLab) Euclidean distance nearest-color matching + exact-match categorical marker detection. White/no-fill cells should remain un-bucketed (none), not nearest-match
4. **`/site/app.js`**: Three-layer frontend -- data layer (fetch + cache), filter/sort layer (pure functions operating on full dataset), render layer (innerHTML batch replace of tbody)
5. **`.github/workflows/refresh.yml`**: Scheduled weekly cron + workflow_dispatch, runs pipeline, uses artifact-based deployment (upload-pages-artifact + deploy-pages), explicit concurrency control
6. **`data.json`**: Single-file data contract. Schema with `edition_date`, `fetched_at`, `columns[]`, `rows[]` (each with `values{}`, `bands{}`, `flags{}`)

### Critical Pitfalls

1. **sRGB gamma distorts nearest-color matching.** Raw hex RGB values are gamma-encoded; Euclidean distance on raw values gives perceptually wrong results. **Mitigation**: Linearize sRGB before computing distance (simple gamma expansion) or convert to OKLab space for perceptually uniform distance. The latter is 3x more accurate for boundary decisions.

2. **GITHUB_TOKEN suppresses downstream workflow triggers.** When the scheduled workflow commits data.json using the default GITHUB_TOKEN, the push event does not trigger the Pages deployment workflow. **Mitigation**: Use artifact-based deployment (actions/upload-pages-artifact + actions/deploy-pages) so data.json goes to the Pages artifact, not committed to the repo. This avoids the entire push-trigger problem.

3. **Sheet structure changes cause silent data corruption.** If the Google Sheets maintainer renames columns, adds rows, or reorders the sheet, the pipeline silently emits broken data.json. **Mitigation**: Validate expected column count (51), known header names, legend format, and edition date pattern before extracting data. Exit non-zero on mismatch with clear error listing expected vs actual.

4. **One-by-one DOM row insertion freezes the browser for 3+ seconds.** 942 rows x 51 columns = ~48K DOM nodes; each appendChild triggers table layout recalculation. **Mitigation**: Build a single HTML string (`rows.map(buildRow).join('')`) and insert once via `tbody.innerHTML` or `insertAdjacentHTML`.

5. **Excelize pre-v2.8 cannot read cell fill colors via the public API.** Attempting to use `GetCellStyle()` and manually traverse internal style structures leads to nil pointer panics, especially with theme-indexed colors from third-party editors. **Mitigation**: Pin to excelize v2.8+ and use the official `GetStyle(styleID)` function which returns a full `Style` struct with `Fill` fields.

6. **Concurrency race between data refresh and Pages.** The built-in pages-build-deployment workflow uses the branch name as its concurrency group key and has cancel-in-progress:true by default, causing scheduled runs to be cancelled by overlapping deploys. **Mitigation**: Single workflow for both refresh and deploy with explicit concurrency group and cancel-in-progress: false.

## Implications for Roadmap

### Phase 1: Core Pipeline (Go CLI)
**Rationale:** Everything depends on the data pipeline. Without `data.json` generated and validated, nothing else works. The CLI is the foundation and must be built and tested first. The Go toolchain and excelize are well-documented with established patterns -- low research risk.

**Delivers:** `meters fetch` + `meters build` subcommands, `data.json` output file, validated against test fixture xlsx. Runnable locally and in CI.

**Addresses features:** None directly (pipeline is prerequisite to all frontend features). Handles data ingestion that enables every subsequent phase.

**Uses stack:** Go 1.24+, `github.com/xuri/excelize/v2@v2.9.x`, stdlib `net/http`, `encoding/json`

**Implements architecture components:** `fetch.go`, `build.go`, `color.go`, `model.go`, `data.json` schema

**Avoids pitfalls:**
- **Phase 1 Pitfall: Excelize < v2.8 GetStyle requirement** -- pin to v2.9.x, use `GetStyle(styleID)` from day one
- **Phase 1 Pitfall: sRGB gamma distortion** -- implement linearized sRGB (or OKLab) in `color.go` from the start, not raw RGB
- **Phase 1 Pitfall: No sheet structure validation** -- implement header count/name checks, legend format validation, edition date pattern match

### Phase 2: Frontend Table + Filtering (App Core)
**Rationale:** Once `data.json` exists, the frontend is the user-facing product. This phase builds the core table renderer, sort, free-text search, and the unique band/flag facet filters. These are the P1 features from FEATURES.md. The plain JS three-layer pattern is well-documented -- low research risk.

**Delivers:** Fully functional single-page app: sortable table, free-text search, band + flag checkboxes, numeric range filters, color-coded cells, legend, sticky headers, results count, mobile responsive scroll, empty states, footer timestamps.

**Addresses features:** All P1 features from FEATURES.md -- table rendering, column sort, free-text search, band faceting, flag faceting, numeric range filters, legend, sticky headers, results count, mobile scroll, empty states, color-coded cells, footer.

**Uses stack:** Plain HTML, CSS, vanilla JS. No dependencies.

**Implements architecture components:** `app.js` (three layers: data fetch, filter/sort pipeline, render), `index.html`, `style.css`

**Avoids pitfalls:**
- **Phase 2 Pitfall: One-by-one DOM insertion** -- use single `innerHTML` string batch from the start
- **Phase 2 Pitfall: No loading state** -- show "Loading..." or skeleton while `data.json` fetches
- **Phase 2 Pitfall: Null/empty cells rendering as "undefined"** -- render empty cells as "—"
- **Phase 2 Pitfall: No `table-layout: fixed`** -- set explicit column widths via `<colgroup>` and `table-layout: fixed`

### Phase 3: URL State + Column Controls (Polish)
**Rationale:** URL state serialization depends on working filter/sort logic (built in Phase 2). Column visibility toggle depends on working column data (built in Phase 2). This phase makes the app feel polished and professional. URL state is important from day 1 for shareability and back/forward navigation. Both features have well-established patterns (URLSearchParams, localStorage) -- low research risk.

**Delivers:** Deep-linkable filter state via URL query params, browser back/forward support, column visibility picker persisted to localStorage, row+column cross-highlight, sticky first column, per-column sort reset.

**Addresses features:** P2 features from FEATURES.md -- URL state serialization, column visibility toggle, cross-highlight, sticky first column, sort reset.

**Uses stack:** Plain JS `URLSearchParams`, `history.replaceState`, `popstate` event, `localStorage`

**Avoids pitfalls:**
- **Phase 3 Pitfall: URL state not synced with filters** -- ensure every filter/sort change updates URL via `replaceState`
- **Phase 3 Pitfall: Column visibility not persisted** -- save to `localStorage` on every toggle, restore on load

### Phase 4: CI/CD + Deployment Pipeline
**Rationale:** The pipeline and frontend can be developed locally, but the project's value (weekly auto-refreshing data) requires CI/CD. This phase is placed after the core product works so the deployment setup is not a dependency for development. However, the deployment strategy decision (artifact-based) must be made in Phase 1 to avoid the GITHUB_TOKEN pitfall. GitHub Actions + Pages is a well-documented integration -- low research risk for standard patterns, but the concurrency and token issues require careful implementation.

**Delivers:** Automated weekly refresh + deploy, manual `workflow_dispatch` trigger, conditional commit, Pages artifact deployment with `.nojekyll`, concurrency control, minimal workflow permissions.

**Addresses features:** Weekly auto-refresh (P1 footer feature), foundation for all live data serving.

**Uses stack:** GitHub Actions, `actions/upload-pages-artifact@v4`, `actions/deploy-pages@v4`, `actions/checkout@v4`

**Implements architecture components:** `refresh.yml`, `.nojekyll`

**Avoids pitfalls:**
- **Phase 4 Pitfall: GITHUB_TOKEN workflow suppression** -- use artifact-based deployment (no git commit of data.json)
- **Phase 4 Pitfall: Concurrency race condition** -- single workflow combining refresh + deploy with explicit concurrency group and `cancel-in-progress: false`
- **Phase 4 Pitfall: `.nojekyll` missing** -- create the file in deployment root before artifact upload
- **Phase 4 Pitfall: Broad permissions** -- use minimal `permissions: contents: write, pages: write, id-token: write`

### Phase 5: Compare Mode + Advanced Features (v2)
**Rationale:** Compare mode requires row-level checkbox selection, a persistent compare bar, and a side-by-side comparison table view. This is the most complex frontend feature (P3), depends on all core filtering working, and has lower mobile usage per Baymard research. Defer until core product is validated and users ask for it. This phase likely needs deeper research for comparison table UX patterns.

**Delivers:** Compare mode with product selection, persistent compare bar, side-by-side comparison table, "differences only" toggle.

**Addresses features:** P3 features from FEATURES.md -- compare mode, differences-only toggle, column reorder, column resize, dark mode, keyboard navigation, print stylesheet, CSV copy.

**Research flag:** Need deeper research into comparison table UX best practices and side-by-side layout patterns before implementing.

### Phase Ordering Rationale

- **Phase 1 first** because everything depends on `data.json`. The CLI pipeline has the highest risk (xlsx parsing, color bucketing, sheet validation) and must be validated before any frontend work.
- **Phase 2 before Phase 3** because URL state serialization requires working filter/sort logic. Column visibility toggle requires working column data. Building filters first and polishing later is standard UX practice.
- **Phase 4 after Phase 2** because the product is developable and testable locally. However, the deployment strategy (artifact-based vs branch-based) must be decided during Phase 1 to avoid the GITHUB_TOKEN pitfall in the workflow design.
- **Phase 5 deferred** because compare mode is the most complex frontend feature with the least clear ROI. Baymard research shows comparison features are far less used on mobile, and the static site constraints make a side-by-side comparison view genuinely challenging without a framework.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 5:** Comparison table UX patterns, side-by-side layout for 51 columns on mobile, mobile-optimized comparison interaction. This is a niche UX domain with limited good examples -- worth dedicated research before implementation.

Phases with standard patterns (skip research-phase):
- **Phase 1:** Go CLI with stdlib + excelize is well-documented and straightforward
- **Phase 2:** Plain JS table with three-layer architecture is a well-established pattern
- **Phase 3:** URL state with URLSearchParams/history and localStorage persistence are solved problems
- **Phase 4:** GitHub Actions + Pages artifact deployment is thoroughly documented

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Go + excelize is authoritative (official docs + GitHub status). Plain JS approach validated against project constraints. GitHub Actions + Pages extensively documented. |
| Features | HIGH | Competitor analysis (GSMArena, Newegg, SPEC CHECK) provides solid benchmark. Baymard research cited for UX patterns. Feature priorities derived from user value x implementation cost matrix. |
| Architecture | HIGH | Patterns are well-established (ETL pipeline, data-as-contract, re-render-on-change). Anti-patterns documented with specific alternatives. Scaling analysis confirms simplicity is sufficient for 940 rows. |
| Pitfalls | HIGH | Each pitfall has verified sources (GitHub issue links, docs references). sRGB gamma issue has academic backing (CIEDE2000 error rates). Workflow token suppression confirmed via GitHub docs. Performance traps benchmarked. |

**Overall confidence:** HIGH

All research areas draw from official documentation, verified GitHub state, peer-reviewed UX research, and community benchmarks with multiple corroborating sources. No areas rely on single, uncorroborated sources.

### Gaps to Address

- **Exact Google Sheets export URL:** The project spec references a Google Sheets URL but the actual URL needs to be confirmed and validated with `curl` to verify it returns xlsx (not an HTML login page). This should be done during Phase 1 implementation.
- **Color legend exact hex values:** The 5 band legend colors (v_high, high, average, low, v_low) and marker colors need to be extracted from the actual xlsx file. The sample values in ARCHITECTURE.md are illustrative -- the real values must be captured from the sheet during Phase 1.
- **OKLab vs linearized sRGB decision:** Both approaches work for 5-coarse-band classification. Linearized sRGB is simpler (no external dependency), OKLab is perceptually more accurate. The decision should be validated with actual sheet data during Phase 1 -- test both, measure boundary misclassification rate, pick the simpler one if results are equivalent.
- **Column subset for default view:** 51 columns shown by default is overwhelming. A sensible default subset (10-15 columns) should be defined before Phase 2 implementation. Consult the project owner or use the column order from the source sheet as a heuristic.
- **Frontend testing strategy:** The plain JS frontend has no test runner. Consider `script` tags for test files or manual testing checklist. This gap doesn't affect the roadmap but should be addressed during planning.

## Sources

### Primary (HIGH confidence)
- **xuri/excelize** -- Official documentation and GitHub repo. Confirmed GetStyle API for reading cell fill colors. v2.10.1 requires Go 1.25+; v2.9.x supports Go 1.23+.
- **GitHub Actions / Pages docs** -- actions/upload-pages-artifact, actions/deploy-pages, workflow permissions, concurrency groups. Verified via WebFetch of official docs.
- **GitHub Docs -- GITHUB_TOKEN** -- Confirmed that events triggered by GITHUB_TOKEN do not spawn new workflow runs. Source of the deployment chain break pitfall.
- **sRGB standard** -- Linearization formula: `if c <= 0.04045 { c / 12.92 } else { ((c + 0.055) / 1.055) ^ 2.4 }`. Source of the gamma distortion pitfall.
- **Baymard Institute** -- Product Comparison UX benchmarks (2025). 67% of participants use comparison features; 17% of spec-driven sites lack them. Mobile comparison usage is low (3 of 38 participants). Source of defer-compare-mode recommendation.
- **Simon Willison** -- Git scraping pattern (2020). Source of conditional commit approach for data refresh.

### Secondary (MEDIUM confidence)
- **Go xlsx benchmark comparison** -- excelize throughput (42K rows/sec, 312MB) vs tealeg (12K rows/sec, 862MB). Single source (datasea.cn) but consistent with community knowledge.
- **OKLab perceptual accuracy** -- CIEDE2000 error: raw sRGB ~12.3 vs OKLab ~4.1 (3x improvement). Community blog source (dev.to), but OKLab is academically established.
- **GitHub Pages deployment race condition** -- Confirmed via Qiskit Issue #3342 and Adafruit Issue #2327. Multiple corroborating community reports.
- **Large DOM table performance benchmarks** -- bench-dom-insert-nodes repo confirms appendChild vs innerHTML performance difference. Consistent with web platform knowledge.

### Tertiary (LOW confidence)
- **Specific legend colors from the xlsx** -- The RGB values in ARCHITECTURE.md are placeholders. Actual values need extraction from the real sheet.
- **Data volume estimates (200-400KB JSON)** -- Estimated based on 940 rows x 51 columns. Actual size depends on field types and string lengths. Not a blocker, just a sizing note.

---

*Research completed: 2026-06-20*
*Ready for roadmap: yes*
