---
phase: 02-frontend-table-polish
plan: 04
subsystem: ui
tags: [css, sticky, hover, column-visibility, collapsible-sections]

requires:
  - phase: 02
    plan: 03
    provides: Table rendering, sticky columns, filter UI structure
provides:
  - Sticky header with legend bar pinned below top bar
  - Box-shadow hover overlay preserving cell background colors
  - Column visibility dropdown positioned under its button
  - Numeric filter row CSS classes (wired by Plan 05)
  - Collapsible filter section CSS with +/- toggle indicators
affects: [02-05]

tech-stack:
  added: []
  patterns:
    - "CSS custom property --legend-bar-height for dynamic sticky top offset"
    - "box-shadow inset overlay pattern for hover highlighting without background replacement"

key-files:
  created: []
  modified:
    - site/style.css (sticky legend/header, hover overlay, col-vis-wrapper, numeric-filter-row, collapsible sections)
    - site/app.js (updateStickyOffsets function, initUI call, resize handler call)
    - index.html (col-vis-wrapper wrapper, sidebar-section classes)

key-decisions:
  - "Use box-shadow inset for hover instead of background override — preserves cell background colors"
  - "Use JS-measured --legend-bar-height CSS custom property for dynamic sticky header offset"
  - "Changes are CSS/HTML/JS-only — no new dependencies or npm packages"

requirements-completed: [UI-08, UI-09, POL-02]

duration: 8min
completed: 2026-06-23
---

# Phase 02 Plan 04: Layout/Visual Gap Closure Summary

**Sticky header with dynamic legend offset, box-shadow hover preserving cell colors, column dropdown wrapper, numeric filter row CSS, and collapsible section foundation**

## Performance

- **Duration:** 8 min
- **Started:** 2026-06-23 (session start)
- **Completed:** 2026-06-23
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Fixed sticky header: legend bar now pins below the top bar (48px), table header pins below legend bar with dynamic height measurement via JS
- Fixed hover text invisibility: replaced `background: !important` with `box-shadow: inset` overlay that preserves cell background colors and white text visibility
- Fixed column dropdown positioning: wrapped button+menu in `.col-vis-wrapper` (position: relative) so the dropdown positions under the button, not at viewport edge
- Added `.numeric-filter-row` and `.numeric-field` CSS classes for Plan 05's horizontal min/max filter layout
- Added `sidebar-section` class to all 3 filter sections with collapsible section CSS (max-height transition, +/- toggle indicators)

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix sticky header/legend scroll behavior** - `19aeec2` (fix)
2. **Task 2: Fix hover highlight text invisibility** - `673efd2` (fix)
3. **Task 3: Column dropdown, numeric filter CSS, collapsible sections** - `1da9c72` (fix)

**Plan metadata:** pending (docs: complete 02-04 plan)

## Files Created/Modified

- `site/style.css` - Sticky legend (position:sticky, top:48px), adjusted table-header top (calc with --legend-bar-height), box-shadow hover overlay, .col-vis-wrapper, .numeric-filter-row + .numeric-field classes, collapsible section CSS with max-height transition and +/- toggle
- `site/app.js` - updateStickyOffsets() function measuring legend bar height, called in initUI() after legend population and on window resize
- `index.html` - Column button+menu wrapped in .col-vis-wrapper div, sidebar-section class added to all 3 filter section elements

## Decisions Made

- **box-shadow inset for hover:** Using `inset 0 0 0 1000px rgba(37,99,235,0.04)` instead of a background override preserves the cell's original band/flag background color. White text on colored cells remains visible during hover. The large spread radius (1000px) ensures full cell coverage regardless of cell dimensions.
- **JS-measured sticky offset:** Using `var(--legend-bar-height, 44px)` with dynamic JS measurement allows the legend bar height to change based on content without hardcoding values. The 44px fallback ensures the header works even before JS runs or if the element is missing.
- **No increased z-index conflicts:** Legend bar gets z-index 8, table header stays at z-index 10, ensuring proper stacking: top bar (50) > table header (10) > legend bar (8).

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

- `.numeric-filter-row` CSS class exists but is not wired in `buildFiltersUI()` — Plan 05 will change the HTML structure to use this class. This is intentional forward-provisioning documented in the plan.
- `.sidebar-section.collapsed` CSS exists but no JS toggle handler — Plan 05 will add the click-to-toggle behavior. The CSS-only foundation ensures the visual collapse works when the class is toggled.

## Issues Encountered

None

## Threat Surface

No new security surface introduced. All changes are CSS style rules, DOM offset measurement (read-only, no user input), and HTML class additions. No new network endpoints, auth paths, file access patterns, or schema changes.

## Next Phase Readiness

- Plan 04 provides CSS/HTML foundation for Plan 05: numeric filter row classes (`.numeric-filter-row`, `.numeric-field`), collapsible section CSS (`.sidebar-section.collapsed`), and `sidebar-section` classes on filter sections
- Plan 05 can focus on JS toggle behavior for collapsible sections and horizontal layout for numeric filter min/max fields
- No blockers — all 3 tasks completed successfully

---
*Phase: 02-frontend-table-polish*
*Completed: 2026-06-23*
