---
phase: 02-frontend-table-polish
reviewed: 2026-06-21T20:30:00Z
depth: deep
files_reviewed: 5
files_reviewed_list:
  - site/engine.js
  - site/app.js
  - site/style.css
  - index.html
  - test/engine.test.mjs
findings:
  critical: 0
  high: 7
  medium: 2
  low: 6
  total: 15
status: issues_found
---

# Phase 02: Frontend Table Polish -- Code Review Report

**Reviewed:** 2026-06-21T20:30:00Z
**Depth:** deep (cross-file analysis of engine.js, app.js, style.css, index.html, engine.test.mjs)
**Files Reviewed:** 5
**Status:** issues_found

## Summary

This review covers 1,799 lines of source code across the Phase 2 frontend: a zero-dependency data processing engine (engine.js), an application controller (app.js), a design system (style.css), the page shell (index.html), and a manual test suite (engine.test.mjs). The code is well-structured overall with clear separation of concerns between the pure-function engine and the stateful controller, proper batch DOM insertion, and good test coverage for pure functions.

Seven high-severity findings were identified: two data-loss bugs from `||` instead of `??` when rendering cell values, missing `try/catch` around `localStorage` access in privacy-restricted browsing, unhandled `NaN` from `parseFloat` in numeric filter input, a null-reference crash path when data loading fails, and debounce inconsistency between search (debounced) and numeric input (not debounced) on 940-row re-renders. The CSS class-vs-attribute selector mismatch for the mobile backdrop is a logic gap that breaks `hidden` attribute behavior in some browsers if UA stylesheets lack `!important` on `[hidden]`.

All high-severity findings are reproducible by testing edge inputs or inspecting browser behavior. None are speculative.

---

## High Issues

### HI-01: Data loss -- `||` instead of `??` drops falsy cell values

**File:** `/Users/jc/multimeters/site/app.js:251`
**Issue:** `const value = row.values[col] || ''` uses logical-OR, which replaces any falsy value (including `0`, `false`, `""`) with empty string. If a cell in the data contains the value `0` (e.g., Price `$0`, Count `0`, or any spec column with a zero reading), it renders as blank -- silently losing the data. The same pattern appears at lines 252-253 for bands and flags.

This is not theoretical: numeric spec columns commonly contain `0` as a legitimate value (ranges, minimums, precision, price). Under the current code, any cell with value `0` would show as empty, breaking both display and search.

**Fix:** Use nullish coalescing (`??`) which only replaces `null`/`undefined`:
```javascript
const value = row.values[col] ?? '';
const band = row.bands[col] ?? '';
const flag = row.flags[col] ?? '';
```

---

### HI-02: NaN silently stored in numeric filter state from invalid input

**File:** `/Users/jc/multimeters/site/app.js:503`
**Issue:** `parseFloat(val)` returns `NaN` for non-numeric input (e.g., user types "abc" in a min/max field). `NaN` is stored in `state.activeFilters.numeric[col]`. In `filterRows` (engine.js:163-168), `NaN !== null` is `true`, so the range check fires: `val < NaN` produces `undefined` (falsy), meaning `return false` is never reached. Result: invalid input silently does nothing -- no feedback to the user, and no filter applied. Worse, if a user types a partial number like "1-" while typing "-1", the intermediate state stores `NaN` briefly, then later corrects itself. This creates confusing, unreproducible "it didn't work" moments.

**Fix:** Validate parseFloat result before storing:
```javascript
var val = e.target.value;
var parsed = val !== '' ? parseFloat(val) : null;
state.activeFilters.numeric[col][bound] = (parsed !== null && !isNaN(parsed)) ? parsed : null;
```

---

### HI-03: localStorage access without try/catch crashes in privacy-restricted browsing

**File:** `/Users/jc/multimeters/site/app.js:192`
**Issue:** `localStorage.getItem('rowDensity')` on line 192 and `localStorage.setItem('rowDensity', mode)` on line 553 are called without `try/catch`. In Safari private browsing, Firefox with strict tracking protection, or some embedded WebViews, reading or writing `localStorage` can throw a `SecurityError` or `QuotaExceededError`. Line 192 is inside `initUI()` called from `loadData()` -- if it throws, `initUI` never completes, the loading state is hidden, no error state is shown, and the page hangs with no table, no footer, no legend. The entire app is broken for users with privacy restrictions.

**Fix:** Guard all localStorage access:
```javascript
function getLocalStorage(key, fallback) {
  try { return localStorage.getItem(key) ?? fallback; }
  catch (e) { return fallback; }
}
function setLocalStorage(key, value) {
  try { localStorage.setItem(key, value); }
  catch (e) { /* storage unavailable */ }
}
```

---

### HI-04: Null reference crash on column visibility toggle after failed data load

**File:** `/Users/jc/multimeters/site/app.js:631-636`
**Issue:** If `loadData()` throws (network error, malformed JSON, HTTP error), `state.visibleColumns` remains `null` -- it is set only at line 116 after a successful fetch and parse. However, the event wiring at lines 627-636 (column visibility checkbox change handler) and 643-658 (Show All / Hide All buttons) is registered unconditionally on DOMContentLoaded. If a user clicks a column visibility checkbox after a failed load, `state.visibleColumns.add(col)` (line 632) throws `TypeError: Cannot read properties of null (reading 'add')`. This crashes the remaining handler and leaves the page in an inconsistent state.

**Fix:** Guard the access or reset state on failure:
```javascript
if (e.target.checked) {
  if (state.visibleColumns) state.visibleColumns.add(col);
}
```
Or, set `state.visibleColumns = new Set()` in the initial state definition (line 47) instead of `null`, and only clear/add to it after data loads.

---

### HI-05: No debounce on numeric filter input -- full re-render per keystroke

**File:** `/Users/jc/multimeters/site/app.js:495-509`
**Issue:** The numeric range input handler (line 495) listens for the `input` event without debounce and calls `applyAndRender()` on every keystroke. Typing "150" triggers three full re-renders: each rebuilds the entire table HTML string (940 rows x ~51 columns = ~48K cells) and calls `insertAdjacentHTML`. Contrast this with the search handler (line 448-450) which has a 250ms debounce. The inconsistency is a performance bug: typing a three-digit number causes 3x the render cost, which on slower devices or when all columns are visible can cause noticeable input lag.

**Fix:** Apply debounce matching the search handler pattern:
```javascript
var numericTimer = null;
el.sidebar.addEventListener('input', function (e) {
  if (e.target.dataset.filterType !== 'numeric') return;
  clearTimeout(numericTimer);
  numericTimer = setTimeout(function () {
    // ... update filter state ...
    applyAndRender();
  }, 200);
});
```

---

### HI-06: CSS class selector `.hidden` does not match `hidden` attribute

**File:** `/Users/jc/multimeters/site/style.css:513-515`
**Issue:** The backdrop CSS uses `.hidden` class selector (`#sidebar-backdrop.hidden`) but the HTML (index.html:39) has `hidden` as an attribute, not a class. The JS (app.js:566) sets `el.sidebarBackdrop.hidden = true/false`, which sets/removes the `hidden` attribute. The CSS rule `#sidebar-backdrop.hidden { display: none; }` never applies because no element ever gets class `hidden`. Compare with line 429-432 which correctly uses `[hidden]` attribute selector: `#column-visibility-menu[hidden]`.

In browsers where the UA stylesheet applies `[hidden]` with `!important`, the `hidden` attribute works through UA defaults and this is merely dead code. In any environment where UA defaults are weaker (XML content types, XHTML, some embedded WebViews), the backdrop is always visible on mobile -- blocking the entire page.

**Fix:** Change the class to attribute selector for consistency with the column visibility menu pattern:
```css
#sidebar-backdrop[hidden] {
  display: none;
}
```

---

### HI-07: Unhandled promise rejection from loadData when catch block itself throws

**File:** `/Users/jc/multimeters/site/app.js:93, 129-136`
**Issue:** `loadData()` is called without `.catch()` (line 444). The function has its own try/catch (lines 100-136), but the catch block can throw: line 132-134 does `el.errorState.querySelector('p')` and accesses `.textContent` on the result. If `#error-state p` is missing from the DOM (or was removed), `querySelector` returns `null` and accessing `.textContent` on null throws a `TypeError`. This secondary error is unhandled -- the async function rejects, but no `.catch()` is attached to the promise returned by `loadData()` on line 444. This produces an unhandled promise rejection that goes silent in most browsers (console warning only) but leaves the loading state visible forever.

**Fix:** Add fallback for the querySelector and attach a rejection handler:
```javascript
} catch (err) {
  el.loadingState.hidden = true;
  el.errorState.hidden = false;
  var errorMsg = el.errorState.querySelector('p');
  if (errorMsg) {
    errorMsg.textContent = 'The data file could not be loaded. (' + err.message + ')';
  }
}
```
And at the call site:
```javascript
loadData().catch(function (err) {
  console.error('Unhandled load error:', err);
});
```

---

## Medium Issues

### MD-01: getFlagColumns has redundant `!== ''` dead code

**File:** `/Users/jc/multimeters/site/engine.js:285`
**Issue:** `row.flags[col] && row.flags[col] !== ""` -- the `!== ""` check is never reached. If `row.flags[col]` is an empty string, it is falsy, so the `&&` short-circuits at `row.flags[col]`. If it is a non-empty string (truthy), the `!== ""` is always `true`. The only way `!== ""` would be meaningful is if `row.flags[col]` were a truthy value that could equal `""`, which is impossible for strings. This is not a correctness bug, but it is misleading dead code that suggests the author expected a case the logic cannot reach.

**Fix:** Simplify to `row.flags[col]`:
```javascript
return data.columns.filter(function (col) {
  return data.rows.some(function (row) { return !!row.flags[col]; });
});
```

---

### MD-02: Empty data.rows exits loadData without initializing footer or legend

**File:** `/Users/jc/multimeters/site/app.js:120-123`
**Issue:** When `data.rows.length === 0`, `loadData` returns early showing only the empty state overlay. `initUI()` is never called, so the footer (edition date, fetched-at timestamp) and legend bar are never populated. If data is empty but has valid `edition_date` and `fetched_at`, the user sees "Loading data..." followed by an empty state with no footer information. The metadata should still be displayed.

**Fix:** Populate footer metadata before returning:
```javascript
if (data.rows.length === 0) {
  el.loadingState.hidden = true;
  el.editionDate.textContent = data.edition_date || '';
  try { el.fetchedAt.textContent = new Date(data.fetched_at).toLocaleString(); } catch (e) {}
  el.emptyState.hidden = false;
  return;
}
```

---

## Low Issues

### LO-01: Redundant `<script>` tag loads engine.js twice

**File:** `/Users/jc/multimeters/index.html:104-105`
**Issue:** `<script type="module" src="site/engine.js"></script>` on line 104 loads `engine.js` as a module directly, but no code in this file invokes any export from it. Line 105 loads `app.js` which does `import { ... } from './engine.js'`, so the module system evaluates `engine.js` once and shares the exports. The first `<script>` tag is redundant -- it loads a module whose bindings are never consumed by that script scope. The browser may still download it (module deduplication caches the URL), so it is not a double-fetch, but it is dead markup that misleads readers into thinking engine.js has standalone behavior.

**Fix:** Remove line 104; `app.js` imports `engine.js` on its own.

---

### LO-02: File-wide `var` usage inconsistent with engine.js ES6 conventions

**File:** `/Users/jc/multimeters/site/app.js` (pervasive)
**Issue:** `app.js` uses `var` declarations (lines 222, 256, 275, 316, 365, 397, 399, 409, 415, 425, 433, 447, 454-467, 495, 503, etc.) while `engine.js` consistently uses `const` and `let`. The project has no explicit `var` vs `let`/`const` rule in CLAUDE.md, but using `var` in ES6 modules is a style inconsistency. More importantly, `var` declarations inside `for` loops (line 222: `var sortDir`) are function-scoped, creating potential confusion if future refactoring adds closures or async callbacks inside the loop. Currently all uses are synchronous and safe, but they violate the principle of block scoping.

---

### LO-03: Duplicated sticky-brand-offset logic between updateStickyBrandOffset and resize handler

**File:** `/Users/jc/multimeters/site/app.js:315-323` and `716-724`
**Issue:** The sticky brand offset logic (measure first `<th>` width, set `--brand-sticky-left` CSS variable) is implemented in two places: `updateStickyBrandOffset()` (lines 315-323) and inlined in the resize handler (lines 721-723). The resize handler duplicates the computation without calling `updateStickyBrandOffset()`. If the measurement logic needs to change (e.g., to handle hidden columns), it must be updated in two places.

**Fix:** Call `updateStickyBrandOffset()` from the resize handler instead of inlining:
```javascript
window.addEventListener('resize', function () {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(updateStickyBrandOffset, 100);
});
```

---

### LO-04: getFlagColumns and hexToLuminance have no test coverage

**File:** `/Users/jc/multimeters/test/engine.test.mjs`
**Issue:** Two exported functions from `engine.js` have zero tests: `hexToLuminance` (a pure function used for color contrast) and `getFlagColumns` (used to build the flag filter sidebar). All other exported functions have tests. These are simple functions, so the gap is low severity, but `hexToLuminance` involves floating-point computation (sRGB-to-linear conversion, WCAG coefficients) that should have at least one test ensuring output is in the [0,1] range for known inputs.

---

### LO-05: Numeric parse silently treats mega (M) suffix as no multiplier

**File:** `/Users/jc/multimeters/site/engine.js:61`
**Issue:** The `multipliers` table explicitly excludes uppercase `M` (mega) with a comment saying "intentionally excluded -- not present in our data." If a value like `10MΩ` appears in data, it parses as `10` (string `"10"` * 1 = 10) instead of the correct `10000000`. The test (engine.test.mjs:215-216) documents this as expected behavior. This is a latent bug: if new data is added that uses megaohm or megavolt values, sorting and numeric filtering for those columns becomes incorrect. The comment documents the assumption, but the assumption should be either verified against the source schema or the `M` multiplier should be added.

**Fix:** Either add `M: 1000000` to the multiplier table, or add a runtime guard that detects `M` and throws loudly (consistent with the project's "fail loudly" principle).

---

### LO-06: Sorting M-suffix values produces incorrect order

**File:** `/Users/jc/multimeters/site/engine.js:63`
**Issue:** Related to LO-05. The `unitChar = match[2][0] || ""` approach (line 59) only reads the FIRST character of the unit suffix. For a value like `10mV`, unit suffix is `mV` and `match[2][0]` is `m` (milli, correct). But for `10nA`, unit suffix is `nA` and `match[2][0]` is `n` (nano, correct). The first-char approach happens to work for all currently tested patterns, but it is fragile: `10kV` would be parsed as `10 * 1000 = 10000` (correct for kilo), while `10MV` would be `10 * 1000000` if mega were added. The weakness is that compound units like `mmV` (millimillivolt, unlikely) or `nF` would have first char `n` (nano) but could also be `mF` (millifarad) with first char `m` (milli). No bug in current data, but the heuristic is fragile for new unit combinations.

---

## Structural Findings (fallow)

No structural pre-pass was provided. All findings above are derived from direct code review.

---

_Reviewed: 2026-06-21T20:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep (cross-file, call-chain tracing)_
