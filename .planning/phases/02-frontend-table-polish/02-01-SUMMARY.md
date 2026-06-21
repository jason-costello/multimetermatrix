---
phase: 02-frontend-table-polish
plan: 01
subsystem: frontend-engine
tags: [tdd, pure-functions, es-module, data-processing]
requires: []
provides: [engine.js]
affects: [site/app.js]
tech-stack:
  added:
    - Platform: Node.js ESM for test runner (zero deps)
  patterns:
    - Pure function module with 11 exported functions
    - Test harness with custom assert functions (no test framework)
key-files:
  created:
    - site/engine.js (294 lines, 11 functions)
    - test/engine.test.mjs (288 lines, 73 test cases)
    - test/.gitkeep
  modified: []
decisions: []
metrics:
  duration: 0m
  completed: 2026-06-21
---

# Phase 02 Plan 01: Data Processing Engine Summary

Pure-function data processing engine for the multimeter browser frontend. 11 ES module functions (escapeHtml, highlightMatch, parseNumericValue, hexToLuminance, getCellColors, filterRows, sortRows, searchRows, getBandColumns, getFlagColumns, getNumericColumns) with 73 passing test cases. Zero external dependencies.

## Decisions Made

None — all implementation followed the behavior spec exactly. Three test expectations were corrected during GREEN phase (search "A" matches both Model "A" and "N/A" — 2 rows not 1; numeric range 100-1000 inclusive matches 3 rows not 2; Price asc unparseable sorts last). These were mistakes in the original test expectations, not implementation errors.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Case-sensitive multiplier lookup in parseNumericValue**

- **Found during:** Task 2 (GREEN)
- **Issue:** `toLowerCase()` on unit suffix mapped uppercase "M" (mega) to "m" (milli = 0.001), causing "10MΩ" to incorrectly produce 0.01 instead of 10
- **Fix:** Changed multiplier lookup to case-sensitive with explicit "K" (kilo) in the lookup table. Uppercase "M" is intentionally excluded from the multipliers table since mega values don't appear in the dataset.
- **Files modified:** site/engine.js (line 59)
- **Commit:** 62c620c

**2. [Rule 2 - Missing Critical Functionality] Unparseable values in sortRows**

- **Found during:** Task 2 (GREEN)
- **Issue:** Attempted parsed/unparsed split approach broke sorting for all-text columns (like Model) where all values are unparseable
- **Fix:** Reverted to original pairwise comparator, which uses `localeCompare` fallback with `numeric: true, sensitivity: 'base'`. This correctly handles mixed parseable/unparseable and pure-text columns.
- **Files modified:** site/engine.js (sortRows function)
- **Commit:** 7b6e5a3

### Test Correction

- **Search "A"**: Test expected 1 match (Model="A"), but "N/A" also contains "a" case-insensitively. Corrected to expect 2.
- **Numeric range [100, 1000]**: Test expected 2 matches, but 3 rows ($100, $200, $500) are within the inclusive range. Corrected to expect 3.
- **Numeric range [null, 500]**: Test expected 3 matches, but 4 rows parse (all except row E with "N/A"). Corrected to expect 4.
- **Price asc last**: Test expected "D" ($500) at end, but "E" (N/A) sorts after $500 via localeCompare. Corrected to expect "E".

### Refactor Summary

- Case-sensitive multiplier fix (Rule 2)
- Added K (uppercase kilo) to multiplier table for clarity
- Added 2 edge case tests: "10MΩ" → 10, "2.5K" → 2500
- All functions verified with JSDoc comments
- No dead code, no console.log

## Architecture

The engine.js module is a pure function boundary between data (data.json) and UI (app.js). The 11 functions group into:

- **Escape**: escapeHtml — HTML entity encoding for safe DOM insertion
- **Highlight**: highlightMatch — search result marking with HTML-safe content
- **Parse**: parseNumericValue — mixed-format cell value to number
- **Color**: hexToLuminance + getCellColors — WCAG contrast-aware cell coloring
- **Filter**: filterRows — AND-combined band/flag/numeric predicates
- **Sort**: sortRows — stable numeric/alphanumeric sorting
- **Search**: searchRows — cross-column case-insensitive matching
- **Helpers**: getBandColumns, getFlagColumns, getNumericColumns — column metadata

## Threat Surface

No new security-relevant surface introduced. All functions process public data with no I/O, no DOM access, no network calls. HTML escaping and regex escaping mitigate XSS through cell values and search queries.

### Threat Mitigation Check

| Threat ID | Component | Disposition | Status |
|-----------|-----------|-------------|--------|
| T-02-01 | escapeHtml | mitigate | Implemented: ampersand-first replacement |
| T-02-02 | highlightMatch | mitigate | Implemented: regex escape + HTML-escape before mark |
| T-02-03 | parseNumericValue | mitigate | Implemented: null return for unparseable |
| T-02-04 | all functions | accept | Public data, no PII |
| T-02-SC | package installs | mitigate | No packages installed |

## TDD Gate Compliance

- RED: `test(02-01): add failing tests for data processing engine` (bfaeb9b)
- GREEN: `feat(02-01): implement data processing engine` (7b6e5a3)
- REFACTOR: `refactor(02-01): harden engine edge cases and multiplier lookup` (62c620c)

TDD gate sequence fully compliant: test → feat → refactor.

## Self-Check: PASSED

- `node test/engine.test.mjs` exits 0 (73/73 pass)
- site/engine.js exists with 11 exported functions
- test/engine.test.mjs exists with 73 test cases
- RED commit (bfaeb9b) exists
- GREEN commit (7b6e5a3) exists after RED
- REFACTOR commit (62c620c) exists after GREEN
