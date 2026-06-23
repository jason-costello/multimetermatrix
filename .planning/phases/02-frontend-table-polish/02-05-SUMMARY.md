---
phase: 02-frontend-table-polish
plan: 05
subsystem: ui
tags: javascript, dom, collapsible, filters, filter-labels, empty-rows

# Dependency graph
requires:
  - phase: 02-04
    provides: collapsible CSS (.sidebar-section.collapsed, .sidebar-section h3::after), numeric-filter-row CSS classes
provides:
  - Collapsible filter sections (Band Scores and Flags collapsed by default, Numeric Filters open)
  - Full-word filter labels via ABBREVIATION_MAP (V Accuracy -> Voltage Accuracy)
  - Empty row filter removing visually empty data rows on load
  - Numeric filter min/max inputs on same horizontal row
affects: future QA and testing plans

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Collapsible sections via classList toggle on sidebar-section"
    - "Abbreviation map pattern for display label transformation"

key-files:
  created: []
  modified:
    - site/app.js

key-decisions:
  - "Band Scores and Flags collapsed by default; Numeric Filters open (user preference for visual clutter reduction)"
  - "Empty row filter uses state.allRows.filter() — does not mutate original data.rows"
  - "ABBREVIATION_MAP only has entries for 'V Accuracy' and 'I Accuracy'; all other column names pass through unchanged"

patterns-established:
  - "Filter section init (initCollapsibleSections) called in initUI() after sticky offset init, before header render"
  - "Abbreviation map used with fallback: ABBREVIATION_MAP[col] || col — safe for all column names"

requirements-completed: [UI-01, UI-06]

# Metrics
duration: 3min
completed: 2026-06-23
---

# Phase 02 Plan 05: Filter Section Collapsibility, Label Expansion, Empty Row Filter

**Collapsible filter sections with band/flag collapsed by default, full-word filter labels via abbreviation map, empty data row filtering on load, and numeric filter min/max side-by-side layout**

## Performance

- **Duration:** 3 min
- **Started:** 2026-06-23T19:30:00Z
- **Completed:** 2026-06-23T19:33:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Filter sections are collapsible — clicking any section h3 toggles its content open/closed
- Band Scores and Flags sections start collapsed on page load; Numeric Filters stay open
- V Accuracy and I Accuracy filter labels now show full words (Voltage Accuracy, Current Accuracy)
- Numeric filter min/max inputs rendered side by side on the same row using .numeric-filter-row
- Visually empty data rows (all cell values empty/whitespace) filtered out from state.allRows on initial load
- Empty state correctly uses state.allRows.length after filtering

## Task Commits

Each task was committed atomically:

1. **Task 1: Collapsible filter sections with default states** - `405f2ff` (feat)
   - Added `initCollapsibleSections()` function and wired call in `initUI()`
   - Band Scores and Flags collapsed by default via `.collapsed` class
   - Click handlers on each section h3 toggle the section

2. **Task 2: Filter labels, empty row filter, numeric inline layout** - `62f1c17` (feat)
   - Added `ABBREVIATION_MAP` constant for V Accuracy / I Accuracy
   - Applied abbreviation map to band, flag, and numeric filter labels
   - Restructured numeric filter HTML to use `numeric-filter-row` with `numeric-field` labels
   - Added empty row filter in `loadData()` after populating state.allRows
   - Fixed empty state check to use `state.allRows.length`

**Plan metadata:** (committed by orchestrator after wave merge)

## Files Modified
- `site/app.js` — Added `initCollapsibleSections()` function, `ABBREVIATION_MAP` constant, restructured numeric filter HTML, added empty row filter logic

## Decisions Made
- None — plan executed as written; all implementation choices were specified in the plan
- The abbreviation map approach (map with fallback to original name) ensures no unintended label changes for columns not in the map

## Deviations from Plan

None — plan executed exactly as written.

### Auto-fixed Issues

None — no bugs, missing critical functionality, or blocking issues encountered during execution.

## Issues Encountered

- **Worktree path resolution:** Edit tool initially rejected the shared-checkout path (`/Users/jc/multimeters/site/app.js`) because the agent is isolated in a worktree (`/Users/jc/multimeters/.claude/worktrees/agent-a644d9e3726f38a6f`). Resolved by using the worktree-relative path for all Edit operations.

## Threat Surface Scan

| Flag | Type | File | Description |
|------|------|------|-------------|
| *(none)* | | | No new network endpoints, auth paths, file access patterns, or schema changes introduced. All changes are DOM manipulation and data filtering within the same trust boundary. |

## Stub Tracking

No stubs detected. All new features are fully wired:
- `initCollapsibleSections()` is called in `initUI()`
- `ABBREVIATION_MAP` entries map to full-word strings (not placeholders)
- Empty row filter uses real `Object.values().some()` logic (not hardcoded empty)
- Numeric filter HTML uses proper CSS classes from Plan 04

## Self-Check: PASSED

- [x] `initCollapsibleSections` found 2 times (function + call)
- [x] `ABBREVIATION_MAP` found 4 times (definition + 3 usages)
- [x] `numeric-filter-row` found 1 time in JS
- [x] `.some(function` found 1 time (empty row filter)
- [x] Band Scores section starts collapsed (classList.add('collapsed'))
- [x] Flags section starts collapsed (classList.add('collapsed'))
- [x] Numeric Filters section stays open (no collapsed class added)
- [x] Empty state check uses `state.allRows.length` (not `data.rows.length`)

## Next Phase Readiness

- Filter section collapsibility complete — fully interactive with CSS-driven animation
- Filter labels use expanded full words for readability
- Empty rows are excluded from initial dataset, reducing noise in the table
- Numeric filter inputs are now side by side on the same row for better space usage
- All changes are in app.js; no new files or dependencies introduced

---
*Phase: 02-frontend-table-polish*
*Completed: 2026-06-23*
