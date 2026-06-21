---
phase: 01-cli-pipeline
reviewed: 2026-06-20T23:30:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - cmd/meters/main.go
  - cmd/meters/model.go
  - cmd/meters/fetch.go
  - cmd/meters/build.go
  - cmd/meters/parse.go
  - cmd/meters/color.go
  - cmd/meters/fetch_test.go
  - cmd/meters/build_test.go
  - cmd/meters/parse_test.go
  - cmd/meters/color_test.go
  - cmd/meters/model_test.go
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-06-20T23:30:00Z
**Depth:** Standard
**Files Reviewed:** 11
**Status:** Issues found

## Summary

Reviewed 11 Go source files across the `cmd/meters/` CLI pipeline: subcommand dispatch (main.go), data model (model.go), HTTP fetch (fetch.go), xlsx parsing (parse.go), color bucketing (color.go), build orchestration (build.go), and their test files. No security vulnerabilities or crashes found. However, 9 issues were identified: 5 warnings (data loss edge cases, dead code, misleading error handling, dependency metadata) and 4 info items (code duplication, test gaps, redundant I/O).

The code is generally well-structured with good error prefixing and test coverage. The most impactful issues are: (1) `openXLSX` hardcoding the filename in error messages (misleading when called from tests), (2) a dead `parseNumber` function, (3) `excelize` incorrectly marked as an indirect dependency, (4) silent data loss potential for fills with non-standard alpha, and (5) the `noneCount` metric conflating empty fills with unmapped fills.

---

## Warnings

### WR-01: openXLSX error message hardcodes filename instead of using actual path

**File:** `cmd/meters/parse.go:26`
**Issue:** The error message in `openXLSX` always reads "open meters.xlsx: ..." regardless of the actual `path` argument. Tests call `openXLSX(fixturePath(t))` which may resolve to `../../testdata/meters.xlsx` or an absolute path; a failure would print the wrong filename, misleading debugging.

**Fix:**
```go
func openXLSX(path string) (*excelize.File, error) {
    f, err := excelize.OpenFile(path)
    if err != nil {
        return nil, fmt.Errorf("open xlsx %s: %w", path, err)
    }
    return f, nil
}
```

---

### WR-02: Dead code -- parseNumber function defined but never called

**File:** `cmd/meters/parse.go:380-390`
**Issue:** `parseNumber` is defined (removes decimal suffix, calls `strconv.Atoi`) but has no callers anywhere in the codebase. This is dead code that also contains a subtle bug: if the input is `.5` (string starting with "."), `s[:idx]` produces `""`, and `strconv.Atoi("")` silently returns `(0, true)` instead of an error.

**Fix:** Remove the unused `parseNumber` function entirely. If Excel serial date parsing is needed later, implement it properly with Excel epoch handling rather than a stripped-down Atoi wrapper.

---

### WR-03: excelize/v2 incorrectly marked as indirect dependency in go.mod

**File:** `go.mod:11`
**Issue:** `github.com/xuri/excelize/v2 v2.10.1` carries the `// indirect` annotation, but it is directly imported in both `cmd/meters/build.go` (line 10) and `cmd/meters/parse.go` (line 8). Running `go mod tidy` will remove the `// indirect` annotation, producing a spurious diff. This indicates `go.mod` was not tidied after direct imports were introduced.

**Fix:** Run `go mod tidy` (Go 1.25) to move `excelize/v2` out of the indirect annotation. Verify the module graph resolves correctly:
```bash
go mod tidy
```

---

### WR-04: getCellFillColor + stripAlpha silently drops fills with non-standard alpha prefix

**File:** `cmd/meters/parse.go:360-376`, `cmd/meters/color.go:141-146`, `cmd/meters/color.go:24`
**Issue:** When a cell fill color has an 8-character ARGB hex where the alpha is not "FF" (e.g., "0076923C"), `stripAlpha` returns the 8-character string as-is (because only strings starting with "FF" are stripped). Downstream, `hexToLinearRGB` checks `len(hex) != 6` and returns an error, causing `nearestBand` to return ("", false). `isCategoricalMarker` also fails because the 8-char hex never matches the 6-char marker values. The cell is silently treated as "none" -- data loss for fills that happen to carry a non-opaque alpha value.

Google Sheets conditional formatting typically uses "FF" alpha for solid fills, so this bug is latent with the current data source. However, if the xlsx export format changes or different conditional formatting rules produce semi-transparent fills, color data will be silently lost.

**Fix:** In `stripAlpha` (or `getCellFillColor`), handle non-FF alpha prefixes by checking for length 8 regardless of prefix:
```go
func stripAlpha(hex string) string {
    if len(hex) == 8 {
        return hex[2:] // strip any 2-char alpha, not just "FF"
    }
    return hex
}
```

This change must be validated against the existing test expectations in `TestStripAlpha` (`"FFD966"` with 6 chars returns unchanged -- still passes since `len("FFD966") == 8` is false).

---

### WR-05: noneCount conflates empty-fill cells with unmapped-fill cells

**File:** `cmd/meters/build.go:86,104`
**Issue:** The `noneCount` variable is incremented in two places: (1) when `fillHex == ""` (white/no-fill cell, line 86) and (2) when a non-empty fill does not match any band or marker (line 104). The verbose diagnostic prints "bucketed X, Y markers, Z none" but Z conflates two semantically different cases. If fills exist in the data that are neither bands nor markers, the diagnostic cannot distinguish expected omissions from potential data loss.

**Fix:** Add a separate counter for unmapped fills, or make line 104 a no-op (since an unmapped fill is an unexpected condition that should at least be logged in verbose mode):
```go
unmappedCount := 0
// ...
if label, _ := nearestBand(fillHex, bands); label != "" {
    bandsMap[header] = label
    bucketed++
    continue
}
unmappedCount++
// ...
if verbose {
    fmt.Fprintf(os.Stderr,
        "bucketed %d cells, %d markers, %d no-fill, %d unmapped (total %d cells)\n",
        bucketed, markerHits, noneCount, unmappedCount, totalCells)
}
```

---

## Info

### IN-01: Identical white/black fill check duplicated in parseLegend and getCellFillColor

**File:** `cmd/meters/parse.go:88-89`, `cmd/meters/parse.go:372-373`
**Issue:** The check `fill == "" || fill == "FFFFFFFF" || fill == "FF000000"` appears verbatim in both `parseLegend` and `getCellFillColor`. While this is not a bug (the contexts are different -- legend row vs. data rows), extracting to a helper like `isMeaningfulFill(fill string) bool` would improve consistency and reduce duplication.

---

### IN-02: scanEditionDate fallback path not tested

**File:** `cmd/meters/parse_test.go:208-227`
**Issue:** The `TestScanEditionDate` test only verifies that a non-empty date is returned from the fixture (where AV1 contains "1/24/2026"). It does not test the fallback path that scans all row-1 cells when the known cells (AV1, AU1) are empty. A test injecting a sheet with no date in the known location but a date elsewhere in row 1 would validate this path.

---

### IN-03: parseDataRows truncates over-long rows without warning

**File:** `cmd/meters/parse.go:270-276`
**Issue:** When a data row has MORE cells than `expectedCols`, the code does `padded = row` (line 275) and iterates only up to `len(headers)` (line 280), silently ignoring extra cells. This is likely correct by design (extra columns not in the header list are noise), but the behavior is undocumented and could mask upstream structural changes.

---

### IN-04: Triple f.GetRows(sheet) call on the same sheet data

**File:** `cmd/meters/parse.go:55`, `cmd/meters/parse.go:209`, `cmd/meters/parse.go:256`
**Issue:** `parseLegend`, `parseHeaders`, and `parseDataRows` each independently call `f.GetRows(sheet)` on the fully-loaded excelize file handle. This reads and parses the entire sheet XML three times for the same data. For 402 rows and 51 columns (~20K cells total) this is not a performance bottleneck, but it is redundant I/O. Consider calling `GetRows` once in `runBuild` and passing the result to each function, or caching/streaming the row data.

---

## Files Review Summary

| File | Lines | Issues | Key Concerns |
|------|-------|--------|--------------|
| cmd/meters/main.go | 33 | 0 | Clean |
| cmd/meters/model.go | 17 | 0 | Clean |
| cmd/meters/fetch.go | 99 | 0 | Clean |
| cmd/meters/build.go | 142 | 1 | unmapped-fill counting (WR-05) |
| cmd/meters/parse.go | 391 | 4 | WR-01, WR-02, WR-04, IN-01, IN-03, IN-04 |
| cmd/meters/color.go | 147 | 0 | Part of WR-04 root cause |
| cmd/meters/fetch_test.go | 149 | 0 | Clean |
| cmd/meters/build_test.go | 149 | 0 | Clean |
| cmd/meters/parse_test.go | 228 | 1 | Fallback not tested (IN-02) |
| cmd/meters/color_test.go | 215 | 0 | Clean |
| cmd/meters/model_test.go | 76 | 0 | Clean |
| go.mod | 16 | 1 | Indirect dependency (WR-03) |

---

_Reviewed: 2026-06-20T23:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
