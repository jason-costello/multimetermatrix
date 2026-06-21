# Phase 02: frontend-table-polish - Context

**Gathered:** 2026-06-21
**Status:** Ready for planning

## Phase Boundary

Zero-dependency HTML/JS/CSS frontend that loads `data.json` and renders ~940 rows × 51 columns as a sortable, filterable table with per-column band facet checkboxes, flag facet checkboxes, numeric range filters, color-coded cell backgrounds, a color legend, and responsive design. Users browse, sort, and filter multimeter specs in a single static page. No build step, no npm, no CDN deps — plain files served by GitHub Pages.

**In scope:** Table rendering (UI-01), column sort (UI-02), free-text search (UI-03), band facet checkboxes (UI-04), flag facet checkboxes (UI-05), numeric range filters (UI-06), color-coded cells (UI-07), legend display (UI-08), sticky header (UI-09), empty state (UI-10), footer with timestamps (UI-11), mobile responsive (POL-01), row hover highlight (POL-02), batch DOM insertion (POL-03).

**Out of scope:** CI/CD pipeline, GitHub Pages deployment (Phase 3), URL state persistence (v2), column reordering via drag, CSV export, dark mode, keyboard navigation, compare mode.

## Implementation Decisions

### Filter Architecture
- **D-01:** Filters live in a **left sidebar panel**, not per-column dropdowns or a top filter bar
- **D-02:** Sidebar organizes filters in **three type-grouped sections**: Numeric (Price, Count, etc.), Band Scores (V Accuracy, I Accuracy, etc.), Flags (Kit, E Pwr, etc.)
- **D-03:** **Sidebar is collapsible** (toggle on/off). Filter sections and their controls are **always expanded** when sidebar is visible — no per-section collapse
- **D-04:** On mobile (<768px), sidebar becomes a **full-height overlay drawer** that slides in from the left. Tap filter icon to open, tap backdrop/X to close

### Table Layout
- **D-05:** **Column visibility toggle menu** lets users show/hide columns, combined with **horizontal scroll** for overflow when visible columns exceed viewport width
- **D-06:** **All 51 columns visible by default** — users hide what they don't want
- **D-07:** **Model AND Brand columns are sticky** (first 2 columns fixed during horizontal scroll) via CSS `position: sticky; left: 0`
- **D-08:** **User-toggleable row density** — Compact / Comfortable / Spacious. Choice persisted in localStorage. Default: Comfortable

### Search
- **D-09:** Single search box, **searches across ALL columns** (no column scope selector)
- **D-10:** **Debounced live filtering** (~250ms debounce). Results update as user types — no Enter/button required
- **D-11:** Search and sidebar filters combine with **AND logic** — search narrows already-filtered results
- **D-12:** **Matching text highlighted in cells** (yellow marker-style background highlight on the matching substring)

### Visual Design
- **D-13:** **Data-dense industrial aesthetic** — dark header row, thin borders, monochrome body with band color accents on data cells. Like a Fluke catalog page — functional, no decoration
- **D-14:** Band colors appear as **full cell background fill** (green→red gradient per score). Cell text color adjusts for contrast (dark text on light fills, white text on dark fills)
- **D-15:** Legend displayed as a **horizontal bar above the table** — always visible, doesn't scroll away. Two rows: score band swatches (V High → V Low) and categorical marker meanings (x missing, x important, O optional, ? no info)
- **D-16:** **System font stack, light theme** — `font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`. Background #fff/#f8f9fa (alt rows). Text #1a1a2e (headings), #333 (body). Borders #dee2e6 thin 1px
- **D-17:** Sort indicator: **▲/▼ arrow** next to active sort column header text. Unsorted columns show nothing. Click toggles asc → desc → unsorted
- **D-18:** Sticky header gets a **subtle drop shadow** when scrolled (none at top)
- **D-19:** Empty state: **centered message** ("No meters match your filters") with a prominent "Clear all filters" button
- **D-20:** Loading state: **minimal CSS-only spinner** centered in table area with "Loading data..." text. No skeleton screens

### Claude's Discretion
- Exact debounce timing for search (200-300ms range)
- Column visibility menu design (dropdown vs popover, multi-select checkbox list)
- Density toggle UI placement and styling
- Sort stability behavior (whether sorting by a second column preserves first-column ordering — stable sort)
- Case sensitivity in search (case-insensitive recommended)
- Exact hex values for band score colors (derived from legend RGBs in data.json schema)
- Scrollbar styling (native vs minimal CSS customization)
- Footer layout (edition date + refresh timestamp arrangement)
- Responsive breakpoints beyond mobile (<768px)
- Filter active-state indicators (how users see which filters are active)
- "Clear all filters" button placement (sidebar top, empty state, both)

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Scope
- `.planning/PROJECT.md` — Project overview, constraints, sheet structure, key decisions
- `.planning/REQUIREMENTS.md` — All UI-01 through POL-03 requirements with acceptance criteria
- `.planning/ROADMAP.md` §Phase 2 — Success criteria (5 items that must be TRUE)

### Data Contract
- `data.json` — Generated by Phase 1 CLI. Schema: `{edition_date, fetched_at, columns[], rows[{values{}, bands{}, flags{}}]}`
- `cmd/meters/model.go` — Go struct definitions for the data.json schema (DataJSON, Row)

### Project Conventions
- `CLAUDE.md` — Architecture, constraints, frontend requirements, color handling nuance

### Prior Phase Context
- `.planning/phases/01-cli-pipeline/01-CONTEXT.md` — Phase 1 decisions that established the data pipeline and data.json contract

## Existing Code Insights

### Reusable Assets
- `data.json` (992KB, 402 rows in test fixture / ~940 rows live) — the single data source. Loaded via `fetch('./data.json')` at page load
- Phase 1 Go CLI (`cmd/meters/`) — produces data.json. No frontend code exists yet

### Established Patterns
- **Zero-dependency constraint** — no npm, no CDN, no framework. All DOM manipulation via vanilla JS `querySelectorAll`, `addEventListener`, `insertAdjacentHTML`
- **GitHub Pages static hosting** — files served from repo root. `index.html` at root loads `data.json` from same origin
- **Immutable data patterns** — project coding style requires no mutation. Filter/sort operations return new arrays

### Integration Points
- `data.json` at repo root — frontend fetches this file. Must be co-located with `index.html` for same-origin fetch
- No existing HTML/JS/CSS files — greenfield frontend under `site/` directory
- Footer must display `edition_date` and `fetched_at` from data.json metadata — not from row data

## Specific Ideas

No particular references or example tables were mentioned. Standard data-table patterns apply.

## Deferred Ideas

None — discussion stayed within Phase 2 scope.

---

*Phase: 02-frontend-table-polish*
*Context gathered: 2026-06-21*
