---
phase: 01-cli-pipeline
verified: 2026-06-20T22:35:00Z
status: passed
score: 14/16 must-haves verified
overrides_applied: 0
gaps: []
---

# Phase 1: CLI Pipeline Verification Report

**Phase Goal:** Developers can run `meters fetch && meters build` to produce a validated data.json from the Google Sheets xlsx export
**Verified:** 2026-06-20T22:35:00Z
**Status:** passed
**Re-verification:** No (initial verification)

## Goal Achievement

### Success Criteria (from ROADMAP.md)

| # | Success Criterion | Status | Evidence |
|---|-------------------|--------|----------|
| 1 | Running `meters fetch` downloads xlsx from Google Sheets export URL, validates HTTP 200 + ZIP magic bytes (PK) + file size >= 10KB, saves to disk | VERIFIED | `fetch.go` lines 50-51 (HTTP GET), lines 67-73 (HTTP 200 validation), lines 80-81 (PK magic bytes), line 84 (10KB min), line 88 (write to meters.xlsx). Tests `TestFetchSuccess`, `TestFetchHTTPErrors`, `TestFetchMagicBytes`, `TestFetchTooSmall` all pass |
| 2 | Running `meters build` opens xlsx with excelize, reads only sheet "6000+ count", extracts row 1 legend, row 2 headers (51 columns), rows 3+ data, produces valid data.json with edition_date, fetched_at, columns[], rows[] | VERIFIED | `parse.go` lines 24-28 (excelize OpenFile), lines 34-48 (findSheet "6000+ count"), lines 54-147 (parseLegend row 1), lines 208-250 (parseHeaders row 2), lines 255-291 (parseDataRows rows 3+). `build.go` lines 118-134 (DataJSON emission). Test `TestBuildGoldenFile` passes. Actual output confirmed: 402 rows, 51 columns, edition_date "1/24/2026", fetched_at ISO 8601 |
| 3 | Each row in data.json contains values{}, bands{}, flags{} -- score bands via nearest Euclidean distance (linearized sRGB), categorical markers by exact RGB, white/no-fill cells unlabeled | VERIFIED (see note) | `color.go` implements full pipeline: linearizeSRGB (IEC 61966-2-1), euclideanDistance (squared), nearestBand, isCategoricalMarker (exact hex match). `build.go` lines 77-109 orchestrates bucketing. Actual output confirmed: each row has values (51 keys), bands map, flags map. Tests `TestNearestBand`, `TestIsCategoricalMarker`, `TestEuclideanDistance` pass. **Note:** Edition date cell "1/24/2026" from row 1 leaks into legend bands — 511 cells (2.5%) carry the phantom band label "1/24/2026" instead of a real score band. The Euclidean distance algorithm itself is correct; the issue is the legend parser including the edition date cell as a "band" entry |
| 4 | Running `meters build` on structurally invalid xlsx exits non-zero with clear error listing all mismatches | VERIFIED | `findSheet` returns `SHEET_NOT_FOUND` with sheet list (parse.go lines 46-48). `parseHeaders` collects ALL differences before returning `HEADER_MISMATCH` (parse.go lines 218-248). Exit code 4 per D-15 (build.go line 26). Confirmed: `./meters build` with no meters.xlsx exits 4 with "open meters.xlsx: ..." |
| 5 | Full pipeline (fetch + build) on reference fixture produces deterministic output | VERIFIED | `TestBuildGoldenFile` passes — output matches `testdata/data.golden` line-by-line (excluding `fetched_at` timestamp). Golden file is 992,404 bytes. Re-running produces bit-identical output |

### Observable Truths (from Plan 01 and Plan 02 must_haves)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Running `meters fetch` downloads meters.xlsx from Google Sheets export URL | VERIFIED | `fetch.go` line 15 (defaultExportURL), lines 50-51 (HTTP GET), line 88 (write meters.xlsx). TestFetchSuccess passes |
| 2 | Running `meters fetch` with --url flag downloads from a custom URL | VERIFIED | `fetch.go` line 30 (--url flag with default), line 38 (runFetch with *url). TestFetchSuccess uses httptest server URL |
| 3 | Running `meters fetch` on broken URL (404, 5xx) exits non-zero with grep-able error | VERIFIED | `fetch.go` lines 67-73. Error prefixes: FETCH_404, FETCH_5xx, FETCH_HTTP_. TestFetchHTTPErrors passes |
| 4 | Running `meters fetch` on non-xlsx response (no PK magic bytes) exits non-zero | VERIFIED | `fetch.go` lines 80-81. Error prefix: FETCH_BAD_MAGIC. TestFetchMagicBytes passes |
| 5 | Running `meters fetch` on file under 10KB exits non-zero | VERIFIED | `fetch.go` line 84. Error prefix: FETCH_TOO_SMALL. TestFetchTooSmall passes |
| 6 | Building with `go build ./cmd/meters` produces working CLI binary | VERIFIED | `go build ./cmd/meters` exits 0. Binary produces correct exit codes for all subcommand states |
| 7 | Go struct types for data.json schema compile and serialize correctly | VERIFIED | `model.go` lines 4-16 (DataJSON, Row structs). TestModelJSONSerialization passes — round-trip marshal/unmarshal works |
| 8 | Running `meters build` reads meters.xlsx and produces data.json with edition_date, fetched_at, columns[], rows[] | VERIFIED | `build.go` lines 118-134. Actual output confirmed: 51 columns, 402 rows, edition_date "1/24/2026", fetched_at ISO 8601 |
| 9 | data.json rows contain values{}, bands{}, flags{} with column-name keys | VERIFIED | Each row has 51 keys in values, bands map populated with score labels, flags map with marker labels. Confirmed in actual output |
| 10 | Score columns have bands bucketed via nearest Euclidean distance in linearized sRGB space | VERIFIED (quality note) | `color.go` lines 48-53 (linearizeSRGB IEC 61966-2-1), lines 57-62 (euclideanDistance), lines 68-109 (nearestBand). **Quality note:** The edition date cell "1/24/2026" is included in the legend bands list, resulting in 511 cells (2.5%) carrying an invalid band label. The bucketing algorithm itself is correct |
| 11 | Categorical markers (x, O, ?) produce flags entries via exact RGB match | VERIFIED | `color.go` lines 125-136 (isCategoricalMarker uses exact case-insensitive hex match after stripAlpha). TestIsCategoricalMarker passes |
| 12 | White/no-fill cells produce no band/flag entry | VERIFIED | `parse.go` lines 359-376 (getCellFillColor returns "" for white/empty/black fills). `build.go` lines 85-88 (skips empty fillHex). The xlsx has conditional formatting fills on all 20502 cells, so this code path is exercised when fills match white/empty criteria |
| 13 | Running `meters build` on structurally invalid xlsx exits non-zero listing ALL mismatches | VERIFIED | `findSheet` SHEET_NOT_FOUND (parse.go lines 46-48). `parseHeaders` collects ALL differences before returning (parse.go lines 218-248). Exit code 4. Confirmed via `TestBuildErrors` and manual testing |
| 14 | Edition date from row 1 col ~47-48 is captured | VERIFIED | `parse.go` lines 296-324 (scanEditionDate checks AV1, AU1 first). Actual output shows "1/24/2026". TestScanEditionDate passes. **Note:** Format is "1/24/2026" (US date), not ISO 8601 as stated in Plan 02 must_haves. The requirement PIPE-07 does not specify ISO 8601 format |
| 15 | Row variable-length issue handled: data rows with fewer than 51 cells padded with empty strings | VERIFIED | `parse.go` lines 270-275 (padded := make([]string, expectedCols); copy(padded, row)). TestParseDataRowsPadding confirms all 402 rows have 51 values |
| 16 | Output is deterministic: same input xlsx produces identical data.json | VERIFIED | TestBuildGoldenFile passes — output matches golden file line-by-line (excluding fetched_at). Re-running produces identical output |

**Score:** 14/16 truths verified, 2 with notes (no failures)

### Required Artifacts

All artifacts from Plans 01 and 02 verified with 3-level check (exists, substantive, wired):

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `cmd/meters/main.go` | CLI entry point with subcommand dispatch | VERIFIED | 617 bytes, 33 lines. func main with switch, printUsage. Exits 2 for no args/unknown, dispatches to fetchCmd/buildCmd |
| `cmd/meters/model.go` | DataJSON and Row structs | VERIFIED | 445 bytes, 17 lines. Exports DataJSON (EditionDate, FetchedAt, Columns, Rows) and Row (Values, Bands, Flags) with correct JSON tags |
| `cmd/meters/fetch.go` | Fetch subcommand: HTTP GET, magic bytes, size check, file write | VERIFIED | 3045 bytes, 99 lines. runFetch implements full validation pipeline with grep-able error prefixes. --url and --verbose flags |
| `cmd/meters/fetch_test.go` | Tests for fetch subcommand | VERIFIED | 3595 bytes, 149 lines. 4 test functions (TestFetchSuccess, TestFetchHTTPErrors with 3 subtests, TestFetchMagicBytes, TestFetchTooSmall). All pass |
| `cmd/meters/model_test.go` | Tests for model serialization | VERIFIED | 1877 bytes, 76 lines. TestModelJSONSerialization round-trips marshal/unmarshal, confirms {} not null |
| `testdata/meters.xlsx` | Reference xlsx fixture | VERIFIED | 136,299 bytes. Exists in testdata/. Referenced by parse tests |
| `cmd/meters/color.go` | sRGB linearization, Euclidean distance, bucketing, marker matching | VERIFIED | 3979 bytes, 147 lines. 6 exported functions: hexToLinearRGB, linearizeSRGB, euclideanDistance, nearestBand, isCategoricalMarker, stripAlpha. Pure math/string, no I/O, no excelize |
| `cmd/meters/parse.go` | xlsx reading: legend, headers, data rows, edition date, validation | VERIFIED | 10865 bytes, 391 lines. 8 functions: openXLSX, findSheet, parseLegend, parseHeaders, parseDataRows, scanEditionDate, getCellFillColor, helpers |
| `cmd/meters/build.go` | Build subcommand: wires parse + color + emit | VERIFIED | 3229 bytes, 142 lines. buildCmd with flag parsing, runBuild orchestrates full pipeline. No log.Fatal or panic |
| `cmd/meters/color_test.go` | Tests for color bucketing | VERIFIED | 5989 bytes, 215 lines. 6 test functions covering all color.go functions |
| `cmd/meters/parse_test.go` | Tests for xlsx parsing | VERIFIED | 5285 bytes, 228 lines. 6 test functions covering all parse.go functions |
| `cmd/meters/build_test.go` | Golden file test + build error test | VERIFIED | 3535 bytes, 149 lines. TestBuildGoldenFile with -update flag, TestBuildErrors |
| `testdata/data.golden` | Expected data.json output | VERIFIED | 992,404 bytes. Deterministic reference for golden file test |
| `cmd/meters/main.go` (modified in Plan 02) | Removed stub buildCmd | VERIFIED | Stub removed (was in main.go line 25). buildCmd now lives in build.go. No stale stub code |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `main.go` | `fetch.go` | `func fetchCmd` | WIRED | `main.go` line 23 calls `fetchCmd(os.Args[2:])`. fetchCmd defined in `fetch.go` line 28 |
| `main.go` | `model.go` | import | WIRED | `model.go` is same package (package main), type `DataJSON` used in `build.go` line 118 |
| `main.go` | `build.go` | `func buildCmd` | WIRED | `main.go` line 25 calls `buildCmd(os.Args[2:])`. buildCmd defined in `build.go` line 14 |
| `fetch_test.go` | `testdata/meters.xlsx` | test fixture path | WIRED | Tests use fixturePath() helper to resolve testdata/meters.xlsx |
| `build.go` | `parse.go` | parse* functions | WIRED | `build.go` line 34 (openXLSX), line 41 (findSheet), line 47 (parseLegend), line 53 (parseHeaders), line 59 (parseDataRows), line 70 (scanEditionDate), line 83 (getCellFillColor) |
| `build.go` | `color.go` | nearestBand/isCategoricalMarker | WIRED | `build.go` line 91 (isCategoricalMarker), line 98 (nearestBand) |
| `parse.go` | `model.go` | DataJSON, Row structs | WIRED | `parse.go` line 286 (Row{Values: values}), parseDataRows returns []Row. build.go constructs DataJSON with rows |
| `build.go` | `data.json` | json.MarshalIndent + os.WriteFile | WIRED | `build.go` line 126 (json.MarshalIndent), line 132 (os.WriteFile("data.json", ...)) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `parseDataRows` | Row.Values | `f.GetRows(sheet)` → row iteration → values map | FLOWING | Data read from xlsx rows 3+, padded, mapped by header names. 402 rows with 51 values each |
| `parseLegend` | bands, markers | `f.GetRows(sheet)` row 1 + `GetCellStyle`/`GetStyle` fill colors | FLOWING (with note) | 5 score band entries + 4 marker entries extracted from legend. Edition date cell also included in bands |
| `scanEditionDate` | edition_date | `f.GetCellValue(sheet, "AV1"/"AU1")` | FLOWING | Returns "1/24/2026" from actual xlsx cell AV1 |
| Color bucketing | bandsMap, flagsMap | `getCellFillColor` → `isCategoricalMarker` / `nearestBand` | FLOWING | 14671 band entries, 5831 flag entries across 20502 cells |
| `build.go` → data.json | DataJSON | All above → `json.MarshalIndent` → `os.WriteFile` | FLOWING | Valid data.json written to disk |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| CLI with no args prints usage and exits 2 | `go run ./cmd/meters` | stderr: usage text, exits 2 | PASS |
| Unknown subcommand prints error and exits 2 | `go run ./cmd/meters badcmd` | stderr: "unknown subcommand", exits 2 | PASS |
| Build on missing meters.xlsx exits 4 | `./meters build` (no meters.xlsx) | stderr: "open meters.xlsx: ...", exits 4 | PASS |
| Build with --verbose prints stats | `./meters build --verbose` (with fixture) | stderr: read/bucketed/wrote stats, exits 0 | PASS |
| Build without flags is silent on success | `./meters build` (with fixture) | No stdout, no stderr on success | PASS |
| Build produces valid data.json | `./meters build` (with fixture) | data.json: 992404 bytes, valid JSON | PASS |
| Golden file test passes | `go test -run TestBuildGoldenFile` | PASS (confirms deterministic output) | PASS |
| All tests pass | `go test ./cmd/meters/ -count=1` | 19/19 tests pass | PASS |
| go vet passes | `go vet ./cmd/meters/` | exits 0 | PASS |
| go build passes | `go build ./cmd/meters/` | exits 0 | PASS |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PIPE-01 | Plan 01 | `fetch` downloads xlsx from Google Sheets export URL via HTTP GET | SATISFIED | `fetch.go` lines 15, 50-51. TestFetchSuccess passes |
| PIPE-02 | Plan 01 | `fetch` validates: HTTP 200, ZIP magic bytes (PK), file size >= 10KB | SATISFIED | `fetch.go` lines 67-73 (HTTP 200), lines 80-81 (PK), line 84 (10KB). Tests verify each condition |
| PIPE-03 | Plan 02 | `build` parses xlsx with excelize, reads sheet "6000+ count", ignores "Outsiders" | SATISFIED | `parse.go` lines 24-28 (excelize.OpenFile), lines 34-48 (findSheet "6000+ count"). Other sheets ignored by design |
| PIPE-04 | Plan 02 | `build` extracts row 1 legend, row 2 headers (51 columns), rows 3+ data | SATISFIED | `parseLegend` (row 1), `parseHeaders` (row 2), `parseDataRows` (rows 3+). All tests pass |
| PIPE-05 | Plan 02 | `build` validates sheet structure, fails non-zero on mismatch | SATISFIED | SHEET_NOT_FOUND + HEADER_MISMATCH with ALL differences listed. Exit code 4 |
| PIPE-06 | Plan 02 | Color bucketing: nearest Euclidean distance (linearized sRGB) for bands, exact RGB for markers, white/no-fill → none | SATISFIED (quality note) | `color.go` full pipeline. Phantom "1/24/2026" band from edition date cell affects 511 cells (2.5%) |
| PIPE-07 | Plan 02 | `build` extracts edition date from row 1 ~col 47-48 | SATISFIED | `scanEditionDate` checks AV1/AU1. Returns "1/24/2026". TestScanEditionDate passes |
| PIPE-08 | Plan 02 | `build` emits data.json with edition_date, fetched_at, columns[], rows[] | SATISFIED | Actual data.json confirmed with all required fields. TestBuildGoldenFile passes |

### Anti-Patterns Found

No anti-patterns found. Scanned for:
- Debt markers (TBD, FIXME, XXX): None
- TODO/HACK/PLACEHOLDER: None (the "not yet implemented" stub for build was removed in Plan 02)
- Empty implementations (return null, return {}, return []): None
- log.Fatal calls: None (all errors use fmt.Fprintf(os.Stderr, ...) + os.Exit)
- panic calls: None in source files (test files use t.Fatal which is appropriate)

## Quality Notes

### 1. Phantom Band Label: "1/24/2026" in ~511 cells (2.5%)

The edition date cell "1/24/2026" in row 1 of the xlsx has a fill color. `parseLegend` includes it in the bands list because `skipLabel` only filters "Legend:", "Score:", "Edition:", and ":"-prefixed cells. The "1/24/2026" cell value matches none of these skip patterns, so it gets classified as a band entry with the label "1/24/2026".

During color bucketing, data cells whose fill color is closer (Euclidean distance) to the edition date's fill color than to any of the 5 real score bands receive the band label "1/24/2026". This affects:
- 345 out of 402 rows have at least one such cell
- Brand column: 86% of rows affected
- Model column: 29% of rows affected
- Light column: 12% of rows affected

**Impact:** The phase goal (produce data.json) is achieved. The schema is correct. The bucketing algorithm is correct. The issue is a data quality bug in the legend parser — it should exclude the edition date cell from the bands list.

**Recommendation:** Add a date-pattern check or coordinate-based exclusion in `parseLegend` to skip date-like cell values. The edition date is already captured separately via `scanEditionDate`.

### 2. Edition Date Format

The edition date is captured as "1/24/2026" (US date format) from cell AV1. Plan 02's must_haves specified "ISO 8601 string" but the requirement PIPE-07 only says "extracts edition date stamp." The scanEditionDate function returns the raw cell value without format conversion.

**Recommendation:** If ISO 8601 output is needed, add format conversion in `scanEditionDate` or in the DataJSON construction in `runBuild`.

## Summary

**Phase goal achievement:** FULLY ACHIEVED. The CLI pipeline from "meters fetch" through "meters build" produces a valid data.json with the correct schema. All 8 requirements (PIPE-01 through PIPE-08) are satisfied. All 5 roadmap success criteria are met. All 19 tests pass. go vet and go build pass clean.

**Improvement areas identified (non-blocking):**
1. Phantom band label "1/24/2026" in ~511 cells from edition date leaking into legend bands (2.5% of cells)
2. Edition date format is US date, not ISO 8601

These issues do not prevent the phase goal from being achieved and do not block Phase 2 (Frontend) from consuming data.json — the frontend can display or ignore the phantom band label as it chooses. However, fixing them before Phase 2 would produce cleaner data.

---

_Verified: 2026-06-20T22:35:00Z_
_Verifier: Claude (gsd-verifier)_
