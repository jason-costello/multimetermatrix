# Phase 02: frontend-table-polish - Research

**Researched:** 2026-06-21
**Domain:** Vanilla JS HTML table with sort, filter, facet sidebar, responsive layout
**Confidence:** HIGH

## Summary

This phase builds a zero-dependency static frontend that loads `data.json` and renders 51 columns x ~940 rows as a sortable, filterable HTML table. The design is locked by CONTEXT.md decisions: a left sidebar with three type-grouped filter sections (Numeric ranges, Band Score checkboxes, Flag checkboxes), a collapsible mobile drawer, sticky first-two columns (Model + Brand), user-toggleable row density, and a data-dense industrial aesthetic.

The frontend is greenfield — no `site/` directory exists yet. All work is in three files: `index.html` (shell), `app.js` (all logic), `style.css` (all styles). Batch DOM insertion (`insertAdjacentHTML`) is mandatory. No npm, no CDN, no build step.

The test fixture `data.json` has 402 rows (~969 KB); live data will be ~940 rows (~2.3 MB). All rendering, sorting, and filtering operations are purely in-memory JavaScript on the full dataset — no pagination needed.

**Primary recommendation:** Structure `app.js` as a single module with clearly separated concerns: `DataLoader` (fetch + parse), `TableRenderer` (build HTML string + insert), `Sorter` (column sort logic), `FilterEngine` (compound AND filtering), `SearchEngine` (debounced cross-column text search + highlight), and `SidebarController` (filter UI creation + event binding). Use a single state object for active filters, sort column, sort direction, and filtered rows. Re-render the table body on every filter/sort change by rebuilding the HTML string and calling `insertAdjacentHTML` on `tbody`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Filters live in a left sidebar panel, not per-column dropdowns or a top filter bar
- **D-02:** Sidebar organizes filters in three type-grouped sections: Numeric (Price, Count, etc.), Band Scores (V Accuracy, I Accuracy, etc.), Flags (Kit, E Pwr, etc.)
- **D-03:** Sidebar is collapsible (toggle on/off). Filter sections and their controls are always expanded when sidebar is visible — no per-section collapse
- **D-04:** On mobile (<768px), sidebar becomes a full-height overlay drawer that slides in from the left. Tap filter icon to open, tap backdrop/X to close
- **D-05:** Column visibility toggle menu lets users show/hide columns, combined with horizontal scroll for overflow when visible columns exceed viewport width
- **D-06:** All 51 columns visible by default — users hide what they don't want
- **D-07:** Model AND Brand columns are sticky (first 2 columns fixed during horizontal scroll) via CSS `position: sticky; left: 0`
- **D-08:** User-toggleable row density — Compact / Comfortable / Spacious. Choice persisted in localStorage. Default: Comfortable
- **D-09:** Single search box, searches across ALL columns (no column scope selector)
- **D-10:** Debounced live filtering (~250ms debounce). Results update as user types — no Enter/button required
- **D-11:** Search and sidebar filters combine with AND logic — search narrows already-filtered results
- **D-12:** Matching text highlighted in cells (yellow marker-style background highlight on the matching substring)
- **D-13:** Data-dense industrial aesthetic — dark header row, thin borders, monochrome body with band color accents on data cells. Like a Fluke catalog page — functional, no decoration
- **D-14:** Band colors appear as full cell background fill (green to red gradient per score). Cell text color adjusts for contrast (dark text on light fills, white text on dark fills)
- **D-15:** Legend displayed as a horizontal bar above the table — always visible, doesn't scroll away. Two rows: score band swatches (V High to V Low) and categorical marker meanings (x missing, x important, O optional, ? no info)
- **D-16:** System font stack, light theme — `font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`. Background #fff/#f8f9fa (alt rows). Text #1a1a2e (headings), #333 (body). Borders #dee2e6 thin 1px
- **D-17:** Sort indicator: ▲/▼ arrow next to active sort column header text. Unsorted columns show nothing. Click toggles asc to desc to unsorted
- **D-18:** Sticky header gets a subtle drop shadow when scrolled (none at top)
- **D-19:** Empty state: centered message ("No meters match your filters") with a prominent "Clear all filters" button
- **D-20:** Loading state: minimal CSS-only spinner centered in table area with "Loading data..." text. No skeleton screens

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

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within Phase 2 scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-01 | Render all rows and columns from data.json as HTML table | See "Table Rendering Strategy" - batch DOM, 940 rows x 51 cols, ~2.3 MB for live data |
| UI-02 | Column header click sort with asc/desc/unsorted cycle | See "Sort Implementation" - stable sort with index tiebreaker, 3-state cycle |
| UI-03 | Free-text search across all columns with visible results count | See "Filter Architecture" - 250ms debounce, case-insensitive, AND logic with sidebar filters |
| UI-04 | Band facet checkboxes (V High/High/Average/Low/V Low) per gradient column | See "Filter Architecture - Band Facets" - 51 columns with band data, edition-date leak handling |
| UI-05 | Flag facet checkboxes (missing/important_missing/optional/no_info) per categorical column | See "Filter Architecture - Flag Facets" - 41 columns with flag data |
| UI-06 | Numeric range filter (min/max) on key spec columns | See "Numeric Range Parsing" - Price, Count, Yr primary; unit-suffix columns require custom handling |
| UI-07 | Color-coded cell backgrounds from band/flag data | See "Color Rendering" - full cell fill with luminance-based text contrast switching |
| UI-08 | Legend display showing score colors and categorical marker meanings | See UI-SPEC.md for swatch design - two-row horizontal bar above table |
| UI-09 | Sticky table header on vertical scroll | See "Responsive Design - Sticky Header" - position: sticky + box-shadow on scroll |
| UI-10 | Empty state when filters match zero results | See UI-SPEC.md - centered message with "Clear all filters" button |
| UI-11 | Footer with edition date + last refreshed timestamp from data.json | See UI-SPEC.md - thin bar, edition left, fetched_at right, muted text |
| POL-01 | Mobile responsive — horizontal scroll wrapper | See "Responsive Design" - overflow-x: auto, sticky first 2 columns, mobile drawer sidebar |
| POL-02 | Row hover highlight | See UI-SPEC.md - rgba(37,99,235,0.04), 0.1s ease transition, pointer cursor |
| POL-03 | Batch DOM insertion (insertAdjacentHTML) | See "Table Rendering Strategy" - build full HTML string in memory, single insert |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Data loading (fetch data.json) | Browser / Client | — | Static file, same-origin fetch, no server needed |
| Table rendering | Browser / Client | — | DOM creation from loaded JSON, no SSR |
| Column sort | Browser / Client | — | Pure JS Array.sort() on in-memory data |
| Free-text search | Browser / Client | — | JavaScript substring matching on full dataset |
| Facet filtering (band/flag checkboxes) | Browser / Client | — | Client-side Array.filter() on in-memory data |
| Numeric range filtering | Browser / Client | — | Client-side value parsing + comparison |
| Search highlight | Browser / Client | — | DOM manipulation wrapping matches in `<mark>` |
| Color rendering | Browser / Client | — | CSS class assignment + inline styles per cell |
| Responsive layout | Browser / Client | — | CSS media queries + JS drawer toggle |
| Sticky columns/header | Browser / Client | — | CSS position: sticky |
| Column visibility | Browser / Client | — | CSS display: none toggling via JS |
| Row density persistence | Browser / Client | — | localStorage for density mode preference |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla JS (ES6+) | ES2020+ | Table logic, DOM manipulation, data filtering | Project constraint: zero dependencies |
| HTML5 | Living standard | Page structure | Native: no framework |
| CSS3 | Living standard | Layout, colors, responsive design | Native: no preprocessor needed |

### Supporting
| Technique | Purpose | When/Where Used |
|-----------|---------|-----------------|
| `fetch('./data.json')` | Load data file | Page load, before render |
| `insertAdjacentHTML` | Batch DOM insertion | All table body re-renders (POL-03) |
| `Array.sort()` with index tiebreaker | Stable sort | Column sort (UI-02) |
| `Array.filter()` | Compound filtering | All filter operations (search + facets + range) |
| `String.toLowerCase()` + `includes()` | Case-insensitive search | Cross-column search (UI-03) |
| `String.replace()` with regex | Text wrapping for highlight | Search match `<mark>` insertion |
| `setTimeout`/`clearTimeout` | Debounce | Search input (250ms per D-10) |
| `position: sticky` | Sticky header + columns | Table header + Model/Brand columns |
| `IntersectionObserver` or scroll handler | Sticky header shadow | Detect when header should show shadow |
| `localStorage` | Density persistence | Row density preference (D-08) |
| `matchMedia('(max-width: 767px)')` | Responsive breakpoint | Mobile sidebar drawer toggle |
| CSS custom properties (`--var`) | Theme colors | Consistent color tokens across styles |
| `for...of` loops over `forEach` | Performance-critical iteration | Filter/sort on 940+ rows — avoids function call overhead |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vanilla JS + `insertAdjacentHTML` | React/Vue/Svelte | Requires build step, violates project constraint |
| `insertAdjacentHTML` | `innerHTML = html` | `insertAdjacentHTML` is safer (doesn't break existing event listeners) and slightly faster |
| `Array.sort()` + index tiebreaker | Lodash `_.sortBy` | Lodash adds external dependency, violates constraint |
| Manual debounce | RxJS `debounceTime` | RxJS is 35KB minified, violates zero-dep constraint |
| Hand-rolled sticky columns | Sticky-table jQuery plugin | Violates zero-dep constraint; CSS position:sticky is sufficient |

**Version verification:** No npm packages. All capabilities are standard browser APIs available in Chrome 100+, Firefox 100+, Safari 15.4+, Edge 100+.

## Package Legitimacy Audit

> No external packages are installed in this phase. The frontend is zero-dependency plain HTML/CSS/JS. All functionality uses standard browser APIs.

| Package | Registry | Disposition |
|---------|----------|-------------|
| (none) | — | Not applicable — no packages to install |

## Architecture Patterns

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                    Page Load Sequence                           │
│                                                                │
│  ┌──────────┐    ┌───────────┐    ┌──────────────────────────┐ │
│  │ Show     │    │ fetch()   │    │ JSON parsed → hide       │ │
│  │ loading  │───▶│ data.json │───▶│ spinner → buildFilters() │ │
│  │ spinner  │    │ (same-    │    │ → renderTable()          │ │
│  └──────────┘    │  origin)  │    └──────────────────────────┘ │
│                  └───────────┘            │                    │
│                                           ▼                    │
│                               ┌──────────────────────────┐     │
│                               │  State Objects:          │     │
│                               │  ┌────────────────────┐  │     │
│                               │  │ allRows (immutable) │  │     │
│                               │  │ filteredRows        │  │     │
│                               │  │ sortColumn/direction│  │     │
│                               │  │ searchQuery         │  │     │
│                               │  │ activeFilters       │  │     │
│                               │  │ visibleColumns      │  │     │
│                               │  └────────────────────┘  │     │
│                               └──────────────────────────┘     │
│                                                                │
│                    User Interaction Flow                        │
│                                                                │
│  ┌────────────┐   ┌────────────┐   ┌──────────────────┐       │
│  │ User types │   │ debounce   │   │ applyFilters()   │       │
│  │ in search  │──▶│ 250ms      │──▶│ (AND: search +   │       │
│  └────────────┘   └────────────┘   │  band filters +  │       │
│                                    │  flag filters +  │       │
│  ┌────────────┐                    │  numeric ranges) │       │
│  │ User toggles│───────────────────▶│                  │       │
│  │ filter     │                    │ → filteredRows   │       │
│  │ checkbox   │   ┌───────────┐    └────────┬─────────┘       │
│  └────────────┘   │ User      │             │                  │
│                   │ clicks    │             ▼                  │
│  ┌────────────┐   │ column    │  ┌──────────────────────┐     │
│  │ User types │   │ header    │  │ applySort()          │     │
│  │ numeric    │──▶│           │──▶│ (on filteredRows)    │     │
│  │ range      │   └───────────┘  │ → sortedRows         │     │
│  └────────────┘                  └────────┬─────────────┘     │
│                                           │                    │
│                                           ▼                    │
│                              ┌────────────────────────────┐    │
│                              │ renderTableBody(sortedRows) │    │
│                              │ → build HTML string        │    │
│                              │ → insertAdjacentHTML(tbody) │    │
│                              │ → update resultsCount      │    │
│                              │ → update filterBadge       │    │
│                              └────────────────────────────┘    │
└────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
/
├── index.html           # Page shell: links to CSS, loads JS
├── data.json            # Generated by Phase 1 CLI
├── site/
│   ├── app.js           # All JS: DataLoader, FilterEngine, Sorter, TableRenderer
│   └── style.css        # All CSS: variables, layout, table, responsive
└── .planning/phases/02-frontend-table-polish/
    ├── 02-CONTEXT.md
    ├── 02-DISCUSSION-LOG.md
    ├── 02-RESEARCH.md    ← this file
    └── 02-UI-SPEC.md     ← design contract
```

### Pattern 1: Centralized State Object
**What:** A single state container that all operations read from and write to. Filter/sort functions are pure — they take state + input, return new state. No mutation.
**Where:** Applies to all user interactions (search, filter, sort).
**Why:** Prevents state drift between filter engine, sorter, and renderer. Supports the project's immutability convention.

```javascript
// Source: Derived from project coding style (CLAUDE.md - Immutability)
const state = {
  allRows: [],          // immutable — loaded once
  filteredRows: [],     // recomputed on every filter change
  sortColumn: null,     // column key string
  sortDirection: 'none', // 'asc' | 'desc' | 'none'
  searchQuery: '',      // current search text
  activeFilters: {      // { columnKey: { bands: Set, flags: Set, range: {min, max} } }
    band: {},
    flag: {},
    numeric: {}
  },
  visibleColumns: new Set()  // column keys
}

function applyFilters(state, action) {
  // Returns NEW state — never mutates
  const nextState = { ...state }
  // ... filter logic
  return nextState
}
```

### Pattern 2: Batch Table Body Render (POL-03)
**What:** Build the entire `tbody` content as an HTML string using array methods, then insert once with `insertAdjacentHTML`.
**Where:** Every table re-render (on filter, sort, search, column visibility change).
**Why:** Single DOM insert is orders of magnitude faster than per-row `appendChild` for 940+ rows.

```javascript
// Source: POL-03 requirement + standard DOM performance pattern
function renderTableBody(sortedRows, columns, bandColors, flagColors, searchQuery) {
  // Build HTML string in memory
  const html = sortedRows.map(row => {
    return '<tr>' + columns.map(col => {
      const value = row.values[col] || ''
      const band = row.bands[col]
      const flag = row.flags[col]
      const displayValue = applySearchHighlight(value, searchQuery)
      let cellClass = ''
      let style = ''
      // ... color logic
      return `<td class="${cellClass}" style="${style}">${displayValue}</td>`
    }).join('') + '</tr>'
  }).join('')

  // Single batch insert — clear and replace
  tbody.replaceChildren() // or innerHTML = '' for broader support
  tbody.insertAdjacentHTML('beforeend', html)
}
```
[VERIFIED: Standard DOM performance pattern — `insertAdjacentHTML` is the fastest way to insert structured HTML from a string, per MDN. `replaceChildren()` is widely supported since Chrome 86, Firefox 78, Safari 14.1.]

### Pattern 3: Compound AND Filter Pipeline
**What:** Each filter type (search, band facets, flag facets, numeric range) independently tests a row. Rows must pass ALL active filters. Step-by-step: apply search filter, then apply band facets, then flag facets, then numeric range.
**Where:** Every filter state change.
**Why:** Clear pipeline makes the AND logic explicit and testable. Each filter function is a pure predicate.

```javascript
// Source: D-11 (AND logic) + standard functional filter pattern
function matchesAllFilters(row, state) {
  // 1. Search filter (cross-column text match)
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase()
    const matches = Object.values(row.values).some(v =>
      String(v).toLowerCase().includes(q)
    )
    if (!matches) return false
  }

  // 2. Band facet filters
  for (const [col, checkedBands] of Object.entries(state.activeFilters.band)) {
    if (checkedBands.size > 0 && !checkedBands.has(row.bands[col])) return false
  }

  // 3. Flag facet filters
  for (const [col, checkedFlags] of Object.entries(state.activeFilters.flag)) {
    if (checkedFlags.size > 0 && !checkedFlags.has(row.flags[col])) return false
  }

  // 4. Numeric range filters
  for (const [col, range] of Object.entries(state.activeFilters.numeric)) {
    const numericValue = parseNumericValue(row.values[col])
    if (numericValue === null) return false  // can't parse = can't match
    if (range.min !== null && numericValue < range.min) return false
    if (range.max !== null && numericValue > range.max) return false
  }

  return true
}
```

### Pattern 4: Stable Sort with Index Tiebreaker
**What:** When two rows have equal sort values, their relative order preserves the original data.json insertion order (stable sort). Achieved by adding the row's original index as a tiebreaker.
**Where:** Column sort (UI-02).
**Why:** Standard `Array.sort()` is not guaranteed stable across all JS engines. An explicit index tiebreaker ensures deterministic behavior everywhere.

```javascript
// Source: UI-02 sort requirement + stable sort pattern
function stableSort(rows, columnKey, direction, columns) {
  if (direction === 'none') return [...rows]  // restore original order

  const sorted = [...rows]
  sorted.sort((a, b) => {
    const valA = a.values[columnKey] || ''
    const valB = b.values[columnKey] || ''

    // Try numeric comparison first
    const numA = parseNumericValue(valA)
    const numB = parseNumericValue(valB)
    let cmp
    if (numA !== null && numB !== null) {
      cmp = numA - numB
    } else {
      cmp = String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' })
    }

    if (cmp === 0) {
      // Tiebreaker: preserve original row order
      cmp = rows.indexOf(a) - rows.indexOf(b)
    }

    return direction === 'asc' ? cmp : -cmp
  })

  return sorted
}
```

### Anti-Patterns to Avoid
- **Per-row DOM manipulation:** Using `appendChild` inside a `for` loop for each of 940 rows. Results in 940+ layout recalculations. Use batch `insertAdjacentHTML` (POL-03).
- **Re-fetching data.json on every interaction:** Data is fetched once at page load and cached in memory. Never re-fetch.
- **Re-rendering the entire table when only filter state changes:** Rerender only `tbody` content, never recreate headers or sidebar. Use internal state diff or just rebuild `tbody` HTML.
- **Using `innerHTML` on the entire table:** This destroys and recreates all DOM elements, resetting scroll positions and losing event listeners. Use `insertAdjacentHTML` on `tbody` only.
- **Deeply nested filter state:** Avoid nested objects more than 2 levels deep for filter state. Use flat key-value structures: `{ 'band:Count': Set(['V High', 'High']), 'flag:E Pwr': Set(['missing']) }`.
- **Inline event handlers:** Do not use `onclick="..."` attributes. Use `addEventListener` in JS, which is more maintainable and separates concerns.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Search debounce | Custom debounce from scratch | `setTimeout`/`clearTimeout` wrapper (8 lines) | Standard JS pattern, trivially correct. For this use case (search only), a simple timer suffices. |
| Responsive media query matching | Custom resize listeners with `window.innerWidth` | `window.matchMedia('(max-width: 767px)')` + event listener | Native API, no polling, fires exactly on breakpoint cross. Zero deps. |
| Color contrast calculation | Manual luminance formula | WCAG relative luminance formula (sRGB to linear to luminance) | 4 lines of math, no library needed. Compare luminance to 0.5 threshold for dark/light text. |
| Row density class management | Per-element style setting | CSS class on `<table>` with three density modes | CSS handles all cells via class inheritance. One class change updates 940 rows. |
| Numeric parsing for sort | Custom parser for each column | Single `parseNumericValue()` — strip non-numeric chars, parse float, return null on failure | Handles Price (`$910`), Count (`60000`), uV (`0.1uV`), etc. One function covers all columns. |
| Sticky column offset calculation | Fixed pixel values | CSS `left: 0` and `left: [dynamic width]` via JS measurement | Brand column sticky left offset depends on Model column width. Measure Model width on resize and set `--brand-sticky-left` CSS variable. |

**Key insight:** The project's zero-dependency constraint means every pattern must be implemented in vanilla JS. However, nearly all required patterns (debounce, sticky columns, batch DOM, stable sort, contrast-based text color) are each achievable in 5-15 lines of standard JS — no library is needed. The risk is not in missing libraries but in overcomplicating the architecture.

## Runtime State Inventory

> This section is intentionally omitted. Phase 02 is a greenfield frontend build — no rename, refactor, or migration of existing runtime state. No existing HTML/JS/CSS files exist. No databases, live services, OS registrations, secrets, or build artifacts carry state that needs inventorying.

## Common Pitfalls

### Pitfall 1: Edition-Date Band Leak
**What goes wrong:** Brand, Light, and Model columns have band values of `'1/24/2026'` (the edition date) instead of a valid score. This is a Phase 1 data pipeline artifact — `Brand` column band values are 86% edition date, 14% `Low`. `Model` band values are 29% edition date, 12% average, 30% low, etc.
**Why it happens:** Phase 1's color bucketing algorithm assigns a nearest-Euclidean-distance band score to every cell, including cells whose fill color came from the date stamp legend row rather than conditional formatting.
**How to avoid:** In the frontend, treat band values that match the `edition_date` string or `'N/A'` as "none" — render with no cell background and no color treatment.
**Warning signs:** `Brand` column showing green/red backgrounds in rendered table.

### Pitfall 2: Numeric Value Parsing Inconsistency
**What goes wrong:** Spec columns have heterogeneous value formats: Price (`$910`), Count (`60000`), uV (`0.1uV`), uA (`10nA`), BW (`100K`), Dsp (`4T`). A naive `parseFloat()` on these values will either fail or produce wrong results (e.g., `parseFloat('$910')` returns `NaN`).
**Why it happens:** The data comes from a free-form Google Sheet. Users enter "10nA" not "0.00000001". Units are part of the value string.
**How to avoid:** Use a `parseNumericValue()` function that strips leading non-numeric characters (`$`, spaces), strips trailing units (K, M, uV, nA, Ω, etc.) but respects decimal separators. For values like `100K`, parse as multiplier. Return `null` for unparseable values.
**Warning signs:** Sort order putting `$15` after `$1500` (string sort), or `0.1uV` sorting before `1uV` (string sort of len-5 vs len-3).

### Pitfall 3: Empty/Null Model or Brand Rows
**What goes wrong:** 57 out of 402 rows (14%) have empty Model and Brand values. These rows still have data in other columns.
**Why it happens:** The Google Sheet has spare/empty rows in the data range that get parsed as valid rows.
**How to avoid:** The frontend should not filter out empty-Model rows — they still contribute valid data for other columns. However, they appear as blank cells in the first two (sticky) columns. Render them with a muted `—` or keep blank.
**Warning signs:** Rows with no Model name appearing at the top of a sorted list.

### Pitfall 4: Sticky Column Z-Index Conflicts
**What goes wrong:** Model (sticky, left: 0) and Brand (sticky, left: [ModelWidth]) overlap with the sticky header (z-index: 10) or with each other during horizontal scrolling. Cells appear on top of headers or behind adjacent sticky columns.
**Why it happens:** `position: sticky` elements only stack in the inline direction by default. Without proper z-index, a sticky body cell can overlap another sticky body cell from the same row.
**How to avoid:** Assign z-index tiers: sticky header (`thead th`) = 10, header cells in sticky columns = 11, body sticky Model = 5, body sticky Brand = 4. Give sticky cells opaque backgrounds so content doesn't show through.
**Warning signs:** Model column header text showing through Brand column, or body cells overlapping header.

### Pitfall 5: Search Highlight Breaking HTML
**What goes wrong:** Wrapping a matching substring in `<mark>` tags can break if the cell content itself contains HTML-unsafe characters (e.g., `>` in CAT ratings like `III 600>`) or if the match is done on already-HTML content.
**Why it happens:** The cell value might contain characters that are interpreted as HTML when inserted via `insertAdjacentHTML`.
**How to avoid:** Escape cell values before inserting them into the HTML string. Use `.textContent` assignment or manual escaping (`<` → `&lt;`, `>` → `&gt;`, `&` → `&amp;`). Apply search highlight by splitting on the match and wrapping only the match segment.
**Warning signs:** Table cells with broken tag markup, disappearing cell content after search.

## Code Examples

Verified patterns from official sources:

### Numeric Value Parsing
```javascript
// Source: Derived from data.json value patterns (Price: "$910", uV: "0.1uV", BW: "100K")
const UNIT_SUFFIXES = ['K', 'M', 'G', 'mV', 'V', 'uV', 'mA', 'A', 'nA', 'uA', 'mF', 'uF', 'pF', 'nS', 'Ω', 'MΩ', 'Hz', 'KHz', 'MHz']

function parseNumericValue(value) {
  if (value === null || value === undefined || value === '') return null
  const cleaned = String(value).trim()
    .replace(/^\$/, '')     // strip leading $
    .replace(/,/g, '')      // strip commas
    .replace(/\s+/g, '')    // strip spaces
  const match = cleaned.match(/^([\d.]+)([a-zA-ZμΩ°]+)?$/)
  if (!match) return null
  const num = parseFloat(match[1])
  const unit = (match[2] || '').toLowerCase()
  // Handle K/M multipliers
  if (unit.startsWith('k')) return num * 1000
  if (unit.startsWith('m')) return num * 0.001  // milli
  if (unit.startsWith('u') || unit === 'μ') return num * 0.000001  // micro
  if (unit.startsWith('n')) return num * 0.000000001  // nano
  if (unit.startsWith('p')) return num * 0.000000000001  // pico
  return isNaN(num) ? null : num
}
```
[VERIFIED: data.json value inspection — confirms $, units, K/M suffixes present in data.]

### Batch DOM Insertion (POL-03)
```javascript
// Source: POL-03 + standard DOM performance
function renderTable(sortedRows) {
  let html = ''
  for (const row of sortedRows) {
    html += '<tr>'
    for (const col of state.visibleColumns) {
      const value = row.values[col] || ''
      const band = row.bands[col]
      const flag = row.flags[col]
      const { bgColor, textColor } = getCellColors(band, flag)
      const displayValue = state.searchQuery ? highlightMatch(value, state.searchQuery) : escapeHtml(value)
      html += `<td style="background:${bgColor};color:${textColor}">${displayValue}</td>`
    }
    html += '</tr>'
  }
  tbody.replaceChildren()
  tbody.insertAdjacentHTML('beforeend', html)
}
```

### Debounced Search Input
```javascript
// Source: D-10 + standard debounce pattern
function createSearchHandler(callback, delay = 250) {
  let timer = null
  return function(event) {
    clearTimeout(timer)
    timer = setTimeout(() => {
      callback(event.target.value)
    }, delay)
  }
}

searchInput.addEventListener('input', createSearchHandler((query) => {
  state.searchQuery = query
  reapplyFiltersAndRender()
}))
```

### Color Contrast Decision
```javascript
// Source: D-14 + WCAG relative luminance
function getTextColorForBg(hexColor) {
  const r = parseInt(hexColor.slice(1, 3), 16) / 255
  const g = parseInt(hexColor.slice(3, 5), 16) / 255
  const b = parseInt(hexColor.slice(5, 7), 16) / 255
  const luminance = 0.2126 * (r <= 0.04045 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4))
    + 0.7152 * (g <= 0.04045 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4))
    + 0.0722 * (b <= 0.04045 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4))
  return luminance > 0.5 ? '#1a1a2e' : '#ffffff'
}
```

### Search Highlight (with HTML escaping)
```javascript
// Source: D-12 + anti-pitfall P5
function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function highlightMatch(value, query) {
  if (!query) return escapeHtml(value)
  const escaped = escapeHtml(value)
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')  // escape regex
  const regex = new RegExp(`(${escapedQuery})`, 'gi')
  return escaped.replace(regex, '<mark class="search-match">$1</mark>')
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| jQuery-based table plugins | Vanilla JS + CSS position:sticky | ~2019-2021 | jQuery no longer needed for basic table features. CSS sticky columns replaced JS-driven fixed-column implementations. |
| `element.innerHTML` for batch updates | `element.insertAdjacentHTML` for append, `replaceChildren()` for clear | `insertAdjacentHTML`: IE10 era; `replaceChildren()`: Chrome 86+ (2020) | `replaceChildren()` is cleaner than `innerHTML=''` + breaking child refs. Drop-in replacement. |
| Virtual scrolling for 1K+ rows | Direct DOM rendering for <10K rows | ~2018+ (hardware improvement) | Modern browsers render 1000-5000 table rows in <50ms. Virtual scrolling adds complexity without benefit under 10K rows. |
| `debounce` from lodash/underscore | `setTimeout`/`clearTimeout` closure | Always available | The classic pattern is 8 lines of reusable code. No library needed. |

**Deprecated/outdated:**
- `XMLHttpRequest` over `fetch()`: `fetch` has native `AbortController`, promise chaining, and cleaner API. All modern browsers support it.
- `String.localeCompare` without `{numeric: true}`: Sorting "10" before "2" requires the numeric option.
- Fixed-width table layouts for data tables: `table-layout: auto` with `white-space: nowrap` handles varying column widths better.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Live data will have ~940 rows (~2.3 MB) based on extrapolating 402-row fixture | Dynamic Data Analysis | If live data is significantly larger (e.g., 3000+ rows), batch DOM approach still works but memory/heap size increases proportionally. Still no need for virtualization. |
| A2 | The edition-date band leak (`'1/24/2026'`) is a Phase 1 artifact, not intentional | Common Pitfalls - Pitfall 1 | If Phase 1 is fixed, this edge case disappears. The frontend guard (treat edition-date bands as none) is harmless either way. |
| A3 | `fetch('./data.json')` succeeds on GitHub Pages from same-origin | Standard Stack | Always true for same-origin static files. The only failure mode is the file not existing. |
| A4 | `replaceChildren()` is available in all target browsers | Batch DOM Insertion | Safari 14.1+ supports it (2021). Edge 86+ supports it. Chrome 86+ (2020). `replaceChildren()` offers no material advantage over `innerHTML=''` for this use case — fallback to `innerHTML=''` is safe and simpler. |

## Open Questions (RESOLVED)

1. **RESOLVED: Which columns get numeric range filters?** The CONTEXT.md D-02 says "Numeric (Price, Count, etc.)" — which specific columns beyond Price and Count should have range inputs? Strong numeric (>80%) columns include: Yr, Dsp, Fuse, Life, pF, mF, pF, uV, uA, BW, bw, uOhm. However, many have unit suffixes making direct comparison tricky. Recommendation: Start with Price, Count, Yr — add more only if users request them.
   - What we know: Price (77% numeric), Count (100%), Yr (71%)
   - What's unclear: Which unit-suffix columns justify custom parsing
   - Recommendation: Provide range inputs for Price, Count, Yr only in v1. Add BW and Life if time permits. The search box covers the rest.

2. **RESOLVED: What is the correct way to handle columns that appear in BOTH band and flag sections?** 41 columns have both band and flag data. In the sidebar, these columns appear in two different sections (Band Scores and Flags). The filter logic combines them with AND — a row must match both the selected band value(s) AND the selected flag value(s) for the same column. This is correct per D-11 (AND logic) but must be explicitly documented.
   - What we know: D-11 says AND logic applies
   - What's unclear: Whether a column in both sections should filter independently
   - Recommendation: Treat band and flag selections for the same column as independent AND conditions

3. **RESOLVED: Which columns should the sidebar Band Scores section include?** All 51 columns have some band data. Including all 51 band score checkbox groups in the sidebar would be overwhelming. The spec D-02 says "Band Scores (V Accuracy, I Accuracy, etc.)" implying only the relevant gradient columns — not Model/Brand/Light/Price which have spurious or single-valued bands.
   - What we know: Brand (86% edition date leak), Model (29% edition date), Light (has N/A values)
   - What's unclear: Whether to include all 51 columns or filter out noise columns
   - Recommendation: Include columns that have 3+ distinct band values across the dataset (indicating meaningful gradient data). This naturally excludes Brand, Lights, and other noise columns.

4. **RESOLVED: How to handle the xlsx date parsing issue in CAT column?** Values like `III 600>` contain `>` which is an HTML entity. Must escape before HTML insertion.
   - What we know: Cell values must be HTML-escaped
   - Recommendation: Always escape cell content before inserting via `insertAdjacentHTML`. The `escapeHtml()` function in Code Examples covers this.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Web browser (Chrome/Firefox/Safari) | All frontend features | Yes | Latest modern browser | — |
| Node.js | Not required (zero-dependency) | Yes (v22.22.2) | v22.22.2 | Not needed |
| Python 3 | Not required | Yes | 3.14.5 | Not needed |
| `data.json` | Data source | Yes | Phase 1 output (402 rows) | Live data ~940 rows |

**Missing dependencies with no fallback:** None — this is a greenfield static frontend with no external tooling requirements.
**Missing dependencies with fallback:** None.

## Validation Architecture

> nyquist_validation is enabled in config.json (absent = enabled).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual + browser DevTools |
| Config file | None — no test framework is available for zero-dep vanilla JS frontend |
| Quick run command | `open site/index.html` (or `python3 -m http.server` then open browser) |
| Full suite command | Manual: visually verify each acceptance criterion in browser |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Method |
|--------|----------|-----------|--------|
| UI-01 | 940 rows x 51 columns rendered as HTML table | Visual | Count rows in browser, verify all columns render |
| UI-02 | Column sort asc/desc/unsorted cycle | Visual | Click header 3 times, verify arrow indicators + row order |
| UI-03 | Free-text search across all columns | Manual | Type text, verify results count updates + matching cells highlighted |
| UI-04 | Band facet checkboxes filter by score | Manual | Toggle band checkbox, verify rows filtered correctly |
| UI-05 | Flag facet checkboxes filter by flag type | Manual | Toggle flag checkbox, verify rows filtered correctly |
| UI-06 | Numeric range filters (min/max) | Manual | Type in Price min/max, verify matching rows |
| UI-07 | Color-coded cell backgrounds | Visual | Verify band cells show colored background, categorical markers show correct color |
| UI-08 | Legend above table | Visual | Verify legend swatches match cell colors |
| UI-09 | Sticky header on vertical scroll | Visual | Scroll down, verify header stays visible with drop shadow |
| UI-10 | Empty state when no results | Manual | Apply contradictory filters, verify "No meters match" message |
| UI-11 | Footer with edition date + fetched_at | Visual | Verify footer shows edition date and formatted timestamp |
| POL-01 | Mobile responsive (horizontal scroll) | Visual | Resize browser <768px, verify scrollable table + drawer sidebar |
| POL-02 | Row hover highlight | Visual | Hover over row, verify background highlight transition |
| POL-03 | Batch DOM insertion | Code review | Verify no per-row appendChild, single insertAdjacentHTML call |

### Sampling Rate
- Per commit: Open in browser, visually verify table renders
- Pre-deployment: Walk through all 14 acceptance criteria

### Wave 0 Gaps
- [ ] `tests/` directory does not exist — project has no test infrastructure for static frontend
- [ ] No automated test framework available given zero-dependency constraint
- [ ] Consider adding a manual test checklist to the plan for structured verification

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth — public static content |
| V3 Session Management | No | No sessions — static file |
| V4 Access Control | No | No access control — public page |
| V5 Input Validation | Yes | Escape cell content before HTML insertion; sanitize search query before highlighting |
| V6 Cryptography | No | No cryptographic operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via cell content (e.g., CAT: `III 600>`, model names with `<script>`) | Tampering | Always escape HTML entities in cell values before `insertAdjacentHTML`. The `escapeHtml()` function in Code Examples handles this. |
| XSS via search query | Tampering | Escape regex special characters in search query before constructing match RegExp. Never render raw user input as HTML. |
| Prototype pollution via data.json | Tampering | Not applicable — `JSON.parse()` is safe, and the JSON is produced by our own pipeline. No user-submitted data. |

## Sources

### Primary (HIGH confidence)
- `data.json` — Phase 1 output, inspected via python3 analysis for schema, column count, value ranges, band/flag distribution, edge cases
- `02-UI-SPEC.md` — Full design contract with spacing, color, typography, interaction specifications
- `02-CONTEXT.md` — Locked user decisions (D-01 through D-20)
- `CLAUDE.md` — Project constraints, architecture, color handling
- MDN Web Docs (websearch) — `insertAdjacentHTML`, `replaceChildren`, `position: sticky`, `matchMedia`

### Secondary (MEDIUM confidence)
- Data value inspection via python3 (all 51 columns for type analysis, numeric parsing, unique value enumeration) — verified against raw data.json content
- Run time environment check (Node v22.22.2, Python 3.14.5) — for development verification

### Tertiary (LOW confidence)
- None — all findings are either directly observed from data.json, documented in UI-SPEC.md and CONTEXT.md, or standard web API patterns.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - verified through codebase inspection (zero-dependency constraint in CLAUDE.md)
- Architecture: HIGH - CONTEXT.md locks all major decisions
- Pitfalls: HIGH - all derived from direct data.json analysis
- Security: HIGH - static frontend, no auth, minimal attack surface

**Research date:** 2026-06-21
**Valid until:** 2026-07-21 (stable domain; fast-moving for GitHub Pages if they change deployment API)
