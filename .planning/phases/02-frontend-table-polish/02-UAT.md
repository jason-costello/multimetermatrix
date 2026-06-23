---
status: resolved
phase: 02-frontend-table-polish
source: 02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md, 02-04-SUMMARY.md, 02-05-SUMMARY.md
started: 2026-06-22T00:00:00Z
updated: 2026-06-23T19:40:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Table renders with color-coded cells and legend
expected: Page loads, renders 402+ rows × 51 columns with band-color backgrounds (green→red) and marker colors. Legend shows 5 band + 4 marker swatches above table.
result: pass

### 2. Column sort with ▲/▼ indicators
expected: Click column header toggles sort (asc→desc→unsorted). Active column shows ▲ or ▼ arrow. Different column resorts correctly.
result: issue
reported: "Rows sort asc, desc, off. Direction arrows match direction of sort. Numerous empty rows present."
severity: minor

### 3. Free-text search with results count
expected: Type in search box, table filters across ALL columns with 250ms debounce. Results count shows "N of 402 results". Matching text highlighted in cells.
result: pass

### 4. Sidebar band facet checkboxes
expected: Sidebar shows band checkboxes per gradient column (V High/High/Average/Low/V Low). Check/uncheck filters rows. Combines with search with AND logic.
result: pass

### 5. Sidebar flag facet checkboxes
expected: Sidebar shows flag checkboxes per categorical column (missing/important_missing/optional/no_info). Check/uncheck filters rows independently from band filters.
result: pass

### 6. Numeric range filters
expected: Price, Count, Yr columns have min/max range inputs. Entering values filters rows to those within range. Works with other filters via AND logic.
result: pass

### 7. Sticky header on vertical scroll
expected: Table header stays visible when scrolling down. Drop shadow appears on header when scrolled away from top.
result: issue
reported: "Column headings and legend don't remain on scroll down — only top bar/search stays pinned. Hard to see drop shadow, might be there. Model and brand pinned on horizontal scroll. No content bleeding."
severity: major

### 8. Row hover highlight
expected: Hovering over a row highlights it with blue tint background. Alternating row colors (#fff/#f8f9fa) visible.
result: issue
reported: "Mouseover shows white background across row that wipes out text with white color (dark mode?). Band cells with white text on colored backgrounds become invisible on hover. Black text columns OK. Transition smooth, colors alternate correctly."
severity: major

### 9. Empty state when no results
expected: When filters match zero results, centered message "No meters match your filters" appears with "Clear all filters" button.
result: pass

### 10. Footer with timestamps
expected: Footer shows "Edition: {date}" on left and "Last updated: {timestamp}" on right from data.json metadata.
result: pass

### 11. Mobile responsive — sidebar drawer
expected: At <768px width, sidebar becomes full-height overlay drawer sliding from left. Tap filter icon to open, tap backdrop/X to close.
result: pass

### 12. Row density toggle
expected: Top bar has Compact/Comfortable/Spacious buttons. Clicking changes row padding. Choice persists across page reloads via localStorage.
result: pass

### 13. Column visibility toggle
expected: "Columns" button opens dropdown with checkbox list. Uncheck hides column, recheck shows it. "Show All"/"Hide All" buttons available.
result: issue
reported: "Dropdown appears far right of window while Columns button is about middle of screen horizontally. Functionally works."
severity: cosmetic

### 14. All 73 engine tests pass
expected: `node test/engine.test.mjs` exits 0, all 73 tests pass, no failures.
result: pass

### 15. Zero external dependencies
expected: App works with no CDN fetches, no npm packages at runtime. Open DevTools Network tab — only data.json, engine.js, app.js, style.css loaded from same origin.
result: pass

## Summary

total: 15
passed: 11
issues: 4
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Table renders all 402 rows without visually empty rows"
  status: resolved
  reason: "Resolved by Plan 02-05: `state.allRows.filter()` in `loadData()` excludes rows with all-empty cell values"
  severity: minor
  test: 2
  root_cause: "Google Sheets export includes empty trailing rows"
  artifacts: ["site/app.js (line 128: empty row filter)"]
  missing: []
  debug_session: ""
- truth: "Sticky table header stays pinned on vertical scroll with drop shadow"
  status: resolved
  reason: "Resolved by Plan 02-04: sticky top offset now uses JS-calculated legend-bar-height; drop shadow class added on scroll"
  severity: major
  test: 7
  root_cause: "Static top offset didn't account for legend bar height"
  artifacts: ["site/style.css (#table-header sticky), site/app.js (scroll observer)"]
  missing: []
  debug_session: ""
- truth: "Row hover highlight does not obscure cell text"
  status: resolved
  reason: "Resolved by Plan 02-04: hover effect changed from background-color to box-shadow inset overlay preserving all cell text readability"
  severity: major
  test: 8
  root_cause: "background-color on hover overwrote cell band colors with white text"
  artifacts: ["site/style.css (tr:hover td box-shadow inset)"]
  missing: []
  debug_session: ""
- truth: "Column visibility dropdown positioned under Columns button"
  status: resolved
  reason: "Resolved by Plan 02-04: .col-vis-wrapper with position:relative provides positioning context for absolute dropdown"
  severity: cosmetic
  test: 13
  root_cause: "Dropdown was positioned relative to viewport not button wrapper"
  artifacts: ["site/style.css (.col-vis-wrapper, #column-visibility-menu)"]
  missing: []
  debug_session: ""

