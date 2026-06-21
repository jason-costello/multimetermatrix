---
phase: 01-cli-pipeline
plan: 02
subsystem: cmd/meters
tags: ["xlsx-parsing", "excelize", "sRGB-linearization", "color-bucketing", "golden-file-test"]

requires:
  - phase: 01-01
    provides: ["cli-frame", "model-schema", "fetch-subcommand"]
provides:
  - build-subcommand: parses meters.xlsx, buckets colors, emits data.json
  - color-bucketing: nearest Euclidean distance in linearized sRGB for bands, exact hex match for markers
  - xlsx-parsing: legend extraction, header validation, data row parsing with trailing-blank padding
  - golden-file-test: deterministic comparison of data.json output

affects: ["phase-03-frontend", "phase-04-ci-cd"]

tech-stack:
  added: ["github.com/xuri/excelize/v2@v2.10.1 (promoted from indirect to direct dep)"]
  patterns: ["slice-index-truncation-for-legend-order", "golden-file-test-with-update-flag", "os.Chdir+tmpDir-for-file-isolation"]

key-files:
  created:
    - cmd/meters/color.go
    - cmd/meters/parse.go
    - cmd/meters/build.go
    - cmd/meters/color_test.go
    - cmd/meters/parse_test.go
    - cmd/meters/build_test.go
    - testdata/data.golden
  modified:
    - cmd/meters/main.go (removed stub buildCmd)

key-decisions:
  - "Legend row parsing uses heuristic to distinguish bands vs markers: single-char symbols (x, O, ?) + adjacent description cells for marker labels, known score-band keywords for band labels, sub-header cells skipped"
  - "Expected headers list fixed to match actual xlsx output via GetRows (compound cells like □Hz merged, single-char marker symbols preserved)"
  - "Golden file test uses -update flag pattern with temp directory isolation, compares line-by-line while skipping fetched_at timestamp"

patterns-established:
  - "color.go: all pure math/string, no I/O, no excelize imports"
  - "parse.go: import excelize, use GetRows for full-load (402 rows), per-cell GetCellStyle+GetStyle for fills"
  - "build.go: orchestrates in phases (open, find, parse legend, parse headers, parse data, bucket colors, marshal, write)"
  - "Testing: temp directory with os.Chdir for filesystem isolation, fixture path resolution with absolute-path fallback"

requirements-completed: [PIPE-03, PIPE-04, PIPE-05, PIPE-06, PIPE-07, PIPE-08]

metrics:
  duration: 35min
  completed: 2026-06-21
---

# Phase 01 Plan 02: Build Subcommand with xlsx Parsing and Color Bucketing

**Complete data pipeline: `meters build` reads meters.xlsx with excelize, extracts legend and headers, parses 402 data rows with trailing-blank padding, buckets cell fill colors via linearized sRGB Euclidean distance (score bands) and exact hex match (categorical markers), captures edition date from row 1, and emits a validated data.json with 2-space indent.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-06-21T03:08:00Z
- **Completed:** 2026-06-21T03:43:00Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- `meters build` subcommand reads meters.xlsx and produces data.json with edition_date, fetched_at, 51 columns, and 402 rows
- Color bucketing correctly classifies cells into 5 score bands (V High through V Low) using Euclidean distance in linearized sRGB space, and 4 categorical markers (missing, important_missing, optional, no_info) using exact hex match
- Structural validation (header count and name matching) reports ALL mismatches at once (D-13) with SHEET_NOT_FOUND and HEADER_MISMATCH error prefixes
- Sparse data rows with fewer than 51 cells are properly padded with trailing empty strings (64 of 402 rows affected)
- Edition date "1/24/2026" captured from cell AV1
- Golden file test ensures deterministic, bit-identical output across runs

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement color.go with sRGB linearization, Euclidean distance, and bucketing** - `1acd76d` (feat)
2. **Task 2: Implement parse.go (xlsx reader) and build.go (build subcommand)** - `5a5086e` (feat)
3. **Task 3: Write tests and golden file** - `7c10006` (test)

## Files Created/Modified

- `cmd/meters/color.go` - sRGB linearization (IEC 61966-2-1), Euclidean distance, nearestBand, isCategoricalMarker, stripAlpha, legendEntry/sRGB types
- `cmd/meters/parse.go` - openXLSX, findSheet, parseLegend, parseHeaders, parseDataRows, scanEditionDate, getCellFillColor, expectedHeaders list
- `cmd/meters/build.go` - buildCmd (flag parsing), runBuild (full pipeline orchestration)
- `cmd/meters/main.go` - removed stub buildCmd (now in build.go), dispatch intact
- `cmd/meters/color_test.go` - 6 test functions for all color bucketing functions
- `cmd/meters/parse_test.go` - 6 test functions for all xlsx parsing functions
- `cmd/meters/build_test.go` - golden file test with -update flag, build error test
- `testdata/data.golden` - expected data.json output (deterministic comparison)

## Decisions Made

- **Legend marker label derivation:** Single-char marker cells ("x", "O", "?") derive their labels from adjacent description cells (": Missing feature", ":Optional", ": No info"). Description cells themselves are skipped to avoid duplicate entries.
- **Expected headers list:** Fixed the header list to match actual GetRows output. The Project.md list had compound chars split (e.g., `□Hz` vs `□`+`Hz`, `T°` vs `T`+`°`) but excelize GetRows merges them. The golden-file-verified header list matches what GetRows actually returns.
- **Golden file comparison:** Line-by-line comparison that skips the `fetched_at` line (which varies by run) but checks all other lines including structural elements and data values.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Fixed expected headers list to match actual xlsx output**
- **Found during:** Task 2 (parse.go implementation)
- **Issue:** The PLAN.md's expected header list (from PROJECT.md) listed compound symbols split across cells (e.g., `□`+`Hz` as separate headers), but excelize GetRows merges merged cells, returning `□Hz` as a single header. This caused header validation to always fail.
- **Fix:** Updated `expectedHeaders` to match GetRows output exactly. The list was verified by running `GetRows` on the actual xlsx and recording all 51 headers.
- **Files modified:** `cmd/meters/parse.go`
- **Verification:** `TestParseHeaders` passes, golden file test passes
- **Committed in:** 5a5086e (Task 2 commit)

**2. [Rule 3 - Blocking] Fixed fmt.Errorf non-constant format string vet warning**
- **Found during:** Task 2 verification (go vet failed)
- **Issue:** `fmt.Errorf(strings.Join(...))` uses a non-constant format string, which triggers `go vet` warning
- **Fix:** Changed to `fmt.Errorf("%s", strings.Join(...))`
- **Files modified:** `cmd/meters/parse.go`
- **Verification:** `go vet ./cmd/meters/` exits 0
- **Committed in:** 5a5086e (Task 2 commit, amended)

**3. [Rule 3 - Blocking] Fixed golden file test path resolution after os.Chdir**
- **Found during:** Task 3 verification (golden file generation failed)
- **Issue:** The golden file path was resolved from a relative `fixturePath` AFTER `os.Chdir(tmpDir)`, causing it to resolve relative to the temp directory instead of the package directory.
- **Fix:** Convert `fixturePath` to an absolute path before calling `os.Chdir`
- **Files modified:** `cmd/meters/build_test.go`
- **Verification:** `go test -update` creates golden file, re-run without flag passes
- **Committed in:** 7c10006 (Task 3 commit, amended)

---

**Total deviations:** 3 auto-fixed (1 missing critical, 2 blocking)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep.

## Issues Encountered

- **Header list mismatch:** The PROJECT.md header list (used as expected in the plan) did not match GetRows output because GetRows merges merged cells that appear as separate cells in the raw XML. Fixed by using the verified GetRows output as the expected list.
- **testdata path resolution:** The golden file test needed careful path handling because `os.Chdir` changes the CWD before writing the golden file. Converted relative fixture paths to absolute before changing directory.

## Threat Compliance

| Threat ID | Category | Disposition | Status |
|-----------|----------|-------------|--------|
| T-02-01 | Spoofing | Mitigate | Implemented: findSheet validates sheet name, returns SHEET_NOT_FOUND |
| T-02-02 | Tampering | Mitigate | Implemented: parseHeaders validates count + names, lists ALL mismatches |
| T-02-03 | Tampering | Mitigate | Implemented: runBuild returns error before any data.json write |
| T-02-04 | Disclosure | Accept | No change (public data) |
| T-02-05 | DoS | Accept | No change (942 rows is small) |
| T-02-SC | Tampering | Mitigate | No new deps; excelize already locked in go.sum |

## Known Stubs

- None. All previously stubbed functionality (build subcommand) is now fully implemented.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Full data pipeline operational: `meters fetch && meters build` produces structured data.json
- Phase 2 (Frontend) can consume data.json for table rendering, sorting, and filtering
- Phase 3 (CI/CD) can use the CLI for automated weekly refreshes
- Deterministic output verified by golden file test

---

*Phase: 01-cli-pipeline*
*Completed: 2026-06-21*
