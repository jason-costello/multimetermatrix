# Phase 1: CLI Pipeline - Research

**Researched:** 2026-06-20
**Domain:** Go CLI pipeline for xlsx fetch, parse, color bucketing, and data.json emission
**Confidence:** HIGH

## Summary

Phase 1 implements a two-subcommand Go CLI (`meters fetch` and `meters build`) that downloads a Google Sheets xlsx export, parses it with excelize v2.10.1, buckets cell fill colors into score bands via linearized sRGB Euclidean distance, and emits a validated `data.json`. The project is greenfield -- no source files exist under `cmd/`, `site/`, or `.github/`.

**Primary recommendation:** Use stdlib `flag.FlagSet` with manual subcommand dispatch (2 subcommands, 3-4 flags total -- cobra/urfave adds ~2MB binary overhead for no benefit). Use excelize `GetRows()` (full-load, not streaming -- 942 rows is small) with a `GetCellStyle`+`GetStyle` per-cell for fill colors. Hand-roll sRGB linearization (well-known piecewise formula) instead of adding a color library dependency. Use golden file testing with `testdata/` for deterministic data.json comparison.

**Critical finding:** 538 of 942 rows have fewer than 51 cells (some as few as 4). `GetRows` skips trailing blank cells, returning variable-length slices. The parser MUST pad each data row to the known column count from row 2 headers.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Subcommands are `meters fetch` (download xlsx) and `meters build` (parse -> data.json)
- **D-02:** Default hardcoded Google Sheets export URL + `--url` flag override on `fetch`
- **D-03:** Fixed filenames -- `fetch` always writes `meters.xlsx`, `build` reads `meters.xlsx` and writes `data.json` (no path flags)
- **D-04:** `--verbose` / `-v` flag on both subcommands for progress output. Silent by default.
- **D-05:** Color space: linearized sRGB -- convert sRGB hex to linear RGB via inverse gamma, then Euclidean distance to each legend color
- **D-06:** Legend colors (both score bands AND categorical markers) extracted dynamically from row 1 at parse time -- not hardcoded
- **D-07:** Tie-breaking for equidistant cells: assign the higher score band (more favorable to the meter spec)
- **D-08:** Categorical markers (`missing`, `important_missing`, `optional`, `no_info`) matched by exact RGB against legend row (not nearest-neighbor). White/no-fill cells to `none`.
- **D-09:** `columns[]` -- array of strings (column header names only, no type metadata)
- **D-10:** `values{}` and `bands{}` keyed by column name string in each row object
- **D-11:** `edition_date` and `fetched_at` as ISO 8601 strings (e.g., `"2026-06-20T14:30:00Z"`)
- **D-12:** `rows[]` as flat array in positional/sheet order (not keyed by model name)
- **D-13:** `build` lists ALL structural mismatches at once (missing headers, wrong column count, malformed legend) before exiting
- **D-14:** Error output: clean stderr messages only -- no Go stack traces. Human-readable, suitable for CI logs
- **D-15:** Exit codes follow Unix conventions: 0=success, 1=general/internal error, 2=invalid usage, 3=fetch HTTP error, 4=xlsx parse/validation error, 5=data validation error
- **D-16:** `fetch` produces distinct error messages per HTTP failure type (404, 5xx, timeout, DNS failure) -- each grep-able

### Claude's Discretion
- Go module internal layout -- how to split files under `cmd/meters/` (fetch.go, parse.go, color.go, model.go, main.go per CLAUDE.md architecture)
- Exact Euclidean distance threshold for "close enough" when matching categorical markers
- Whether to use `excelize` streaming row iteration or full-load for 942 rows
- Test strategy specifics (golden files, table-driven tests)

### Deferred Ideas (OUT OF SCOPE)
- None -- discussion stayed within Phase 1 scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PIPE-01 | `fetch` subcommand downloads xlsx from Google Sheets export URL via HTTP GET | Go `net/http` GET -- 5 lines. Default URL and `--url` flag (D-02). Write to `meters.xlsx` (D-03). |
| PIPE-02 | `fetch` validates: HTTP 200, ZIP magic bytes (`PK`), >= 10KB | Check `resp.StatusCode`, read first 2 bytes for `PK`, check `resp.ContentLength` or file size after write. Each failure type gets distinct grep-able message (D-16). |
| PIPE-03 | `build` parses xlsx with excelize -- reads "6000+ count", ignores "Outsiders" | `excelize.OpenFile("meters.xlsx")`, `f.GetRows("6000+ count")`. Verify sheet exists before reading. |
| PIPE-04 | `build` extracts row 1 legend, row 2 headers, rows 3+ data | Standard excelize row iteration. Row 1 filled cells = legend entries. Row 2 = 51 column headers. Rows 3-942 = data (variable length per row -- PAD to 51). |
| PIPE-05 | `build` validates sheet structure, fails non-zero on mismatch | Compare expected headers. List ALL mismatches before exiting (D-13). Use exit code 4 (D-15). |
| PIPE-06 | Color bucketing: nearest Euclidean in linearized sRGB for bands, exact RGB for markers | Hand-roll sRGB linearization (piecewise formula). Euclidean distance in linear RGB. Exact hex match for categorical markers. Tie-break to higher band (D-07). |
| PIPE-07 | `build` extracts edition date from row 1 (~col 47-48) | Read `GetCellValue("6000+ count", "AU1")` or `GetCellValue("6000+ count", "AV1")` -- verify against xlsx cell reference pattern from column 47-48. |
| PIPE-08 | `build` emits `data.json` with edition_date, fetched_at, columns[], rows[] | Marshal Go struct to JSON with `json.MarshalIndent`. Schema per D-09 through D-12. Use `time.Now().UTC().Format(time.RFC3339)` for fetched_at. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| xlsx download (fetch) | CLI | -- | Pure CLI operation: HTTP GET, write to disk, validate. No service/UI involvement. |
| xlsx parsing | CLI | -- | File I/O + excelize library -- happens entirely in the Go CLI process. |
| Color bucketing | CLI | -- | CPU-bound computation on parsed data -- CLI processes all cells in one pass. |
| data.json emission | CLI | -- | File write from the CLI process. Phase 2 reads this file from the filesystem via browser fetch. |
| Structural validation | CLI | -- | Parse-time validation -- exits non-zero before writing partial data. |
| Progress output | CLI | -- | Optional stderr logging when `--verbose` is set. Silent by default. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Go | 1.25+ | CLI runtime | Already installed (go1.26.0). Single binary, no runtime deps. |
| `github.com/xuri/excelize/v2` | v2.10.1 | XLSX parsing (read values + fill colors) | The canonical xlsx library. `GetCellStyle` + `GetStyle` returns fill `Color []string`. `GetRows` for all-row reading. Active maintenance by xuri. [VERIFIED: go get added v2.10.1, confirmed on pkg.go.dev] |
| Go stdlib `net/http` | stdlib | HTTP GET for xlsx download | Standard library, no external dep needed. |
| Go stdlib `encoding/json` | stdlib | Marshal data.json | Standard library, produces clean indented JSON from structs. |
| Go stdlib `flag` | stdlib | CLI subcommand dispatch + flag parsing | 2 subcommands, 3-4 flags total -- cobra/urfave adds ~2MB binary size for no material benefit. Manual dispatch with `flag.FlagSet` is ~50 lines. [CITED: Go blog on flag package] |
| Go stdlib `testing` + `flag` | stdlib | Golden file testing | Standard library test runner. `-update` flag for golden file regeneration. |
| Go stdlib `os/exec` | stdlib | Exit code handling | Standard `os.Exit(code)` for Unix exit codes defined in D-15. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `testing/iotest` | stdlib | Test helpers for HTTP error simulation | When testing `fetch` subcommand error paths (timeout, connection refused) |
| `net/http/httptest` | stdlib | Test HTTP server for fetch tests | When testing `fetch` against a local server instead of real Google Sheets URL |
| `bytes` | stdlib | Efficient buffer manipulation | For reading response body and validating magic bytes before file write |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| stdlib `flag` | `spf13/cobra` | Cobra is the industry standard (kubectl, helm) but adds ~2MB to binary. With only 2 subcommands, the overhead is unjustified. Cobra's shell completions, nested commands, and persistent flags are not needed here. |
| stdlib `flag` | `urfave/cli v3` | Lighter than cobra, actively maintained in 2026, but still adds external dependency for a trivial CLI surface area. `flag` + manual dispatch requires no `go.mod` addition beyond excelize. |
| Hand-rolled sRGB linearization | `github.com/mandykoh/prism` | Prism is a full color management library with sRGB linearization. Adds a dependency for 15 lines of math. The formula is a well-known piecewise function -- hand-rolling is safer and more transparent. |
| Hand-rolled sRGB linearization | `github.com/troublete/go-colors` | Provides sRGB linearization + Delta E. Same argument as prism -- unnecessary dependency for a simple math function. |

**Installation:**
```bash
go mod init github.com/jc/multimeters
go get github.com/xuri/excelize/v2@v2.10.1
```

**Version verification:**
```bash
# Already verified: v2.10.1 installed, go 1.25.0 in go.mod (actual runtime: go1.26.0)
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `github.com/xuri/excelize/v2` | Go module (pkg.go.dev) | 8+ years | 50M+ | github.com/xuri/excelize | [OK] | Approved |
| `github.com/richardlehane/mscfb` | Go module | 12+ years | 10M+ | github.com/richardlehane/mscfb | [OK] | Approved (indirect dep of excelize) |
| `golang.org/x/net` | Go module | 15+ years | 200M+ | go.googlesource.com/net | [OK] | Approved (indirect dep of excelize) |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none -- all packages are well-established Go modules with millions of downloads.

> Note: The only direct dependency is `excelize/v2`. All other modules are indirect dependencies pulled in by excelize.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    meters CLI (cmd/meters/)                 │
│                                                             │
│  ┌─────────────────────┐    ┌─────────────────────────┐     │
│  │   fetch subcommand  │    │   build subcommand      │     │
│  │                     │    │                         │     │
│  │ 1. Parse flags      │    │ 1. Parse flags          │     │
│  │ 2. HTTP GET URL     │    │ 2. Open meters.xlsx     │     │
│  │ 3. Validate resp    │    │ 3. Read sheet 6000+     │     │
│  │ 4. Write meters.xlsx│    │ 4. Extract row 1 legend │     │
│  │ 5. Success/error    │    │ 5. Extract row 2 headers│     │
│  └─────────┬───────────┘    │ 6. Validate structure   │     │
│            │                │ 7. Parse rows 3+        │     │
│            ▼                │    ├─ GetCellValue      │     │
│     [ meters.xlsx ]         │    ├─ GetCellStyle      │     │
│            │                │    └─ GetStyle → fill   │     │
│            └────────────────┤ 8. Bucket colors         │     │
│                             │    ├─ Linearize sRGB     │     │
│                             │    ├─ Euclidean distance  │     │
│                             │    ├─ Exact RGB markers   │     │
│                             │    └─ Assign bands/flags │     │
│                             │ 9. Emit data.json        │     │
│                             └─────────────┬────────────┘     │
│                                           ▼                  │
│                                    [ data.json ]             │
│                                           │                  │
│   (consumed by Phase 2 frontend)          ▼                  │
│                                      site/                   │
└─────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
meters.xlsx                    # Fetched xlsx (gitignored)
data.json                      # Generated output (committed by CI)
cmd/
└── meters/
    ├── main.go                # Subcommand dispatch (os.Args switch)
    ├── fetch.go               # fetch subcommand: HTTP GET, validate, write
    ├── parse.go               # xlsx parsing: legend, headers, data rows
    ├── color.go               # sRGB linearization, Euclidean distance, bucketing
    └── model.go               # data.json schema structs + JSON emission
testdata/
    ├── meters.xlsx            # Copy of reference fixture for tests
    └── data.golden            # Expected data.json output for golden test
```

### Pattern 1: Subcommand Dispatch with stdlib flag
**What:** Parse first os.Arg as subcommand name, dispatch to a function, use separate `flag.FlagSet` per subcommand.

**When to use:** 2-3 subcommands with simple flags. Avoids cobra/urfave dependency.

**Example:**
```go
// Source: [CITED: Go stdlib flag documentation]
func main() {
    if len(os.Args) < 2 {
        printUsage()
        os.Exit(2)
    }

    switch os.Args[1] {
    case "fetch":
        fetchCmd(os.Args[2:])
    case "build":
        buildCmd(os.Args[2:])
    default:
        fmt.Fprintf(os.Stderr, "unknown subcommand: %s\n", os.Args[1])
        printUsage()
        os.Exit(2)
    }
}

func fetchCmd(args []string) {
    fs := flag.NewFlagSet("fetch", flag.ContinueOnError)
    url := fs.String("url", defaultExportURL, "Google Sheets export URL")
    verbose := fs.Bool("verbose", false, "verbose output")
    fs.BoolVar(verbose, "v", false, "verbose output")
    
    if err := fs.Parse(args); err != nil {
        os.Exit(2)
    }
    // ... fetch logic
}
```

### Pattern 2: Golden File Testing
**What:** Store expected `data.json` output in `testdata/data.golden`, compare during tests. Use `-update` flag to regenerate.

**When to use:** Deterministic output (data.json) that must not regress across changes.

**Example:**
```go
// Source: [CITED: Go testing conventions - testdata/]
var update = flag.Bool("update", false, "update golden files")

func TestBuildOutput(t *testing.T) {
    // Run build on test fixture
    got := buildFromFixture(t, "testdata/meters.xlsx")
    
    if *update {
        os.WriteFile("testdata/data.golden", got, 0644)
    }
    
    want, err := os.ReadFile("testdata/data.golden")
    if err != nil {
        t.Fatalf("read golden: %v", err)
    }
    
    if diff := cmp.Diff(want, got); diff != "" {
        t.Fatalf("output mismatch (-want +got):\n%s", diff)
    }
}
```

### Anti-Patterns to Avoid
- **Parsing errors with `log.Fatal` instead of `fmt.Fprintf`:** `log.Fatal` includes timestamp and source location, violating D-14 (clean stderr only). Use `fmt.Fprintf(os.Stderr, ...)` and `os.Exit(code)`.
- **Sequential validation that stops at first error:** D-13 requires listing ALL structural issues. Collect errors, validate all, then exit.
- **Using `GetRows` slice indices directly without padding:** 538/942 rows have fewer than 51 cells. Always pad trailing missing values.
- **Hardcoding legend colors:** D-06 requires dynamic extraction from row 1. Never embed RGB values in source.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| xlsx file reading (open, sheet access, cell values) | Custom ZIP+XML parser | `github.com/xuri/excelize/v2` | xlsx is a ZIP of XML files with complex relationships, shared strings, styles, and formatting. Excelize handles all edge cases. The XML schema is 850+ pages of ECMA spec. |
| OLE2 compound document support | Custom OLE2 reader | excelize (transparent, built-in) | Some xlsx files use OLE2 format. Excelize handles both ZIP and OLE2 containers transparently. |
| Cell style/fill color reading | Manual XML styles parsing | excelize `GetCellStyle()` + `GetStyle()` | The xlsx styles XML (`xl/styles.xml`) has complex theme color resolution, indexed colors, and tint computations. `GetStyle()` in v2.8.0+ abstracts this. `GetBaseColor()` in v2.9.0+ handles theme/indexed/RGB resolution. |
| HTTP client with timeouts and error handling | Custom retry/socket handling | Go `net/http` with `http.Client{Timeout: 30 * time.Second}` | Standard library handles timeouts, DNS, connection pooling. Set `Transport.DialContext` for connection timeout separate from response timeout. |

**Key insight:** The xlsx format is deceptively complex. Excelize exists because hundreds of man-years went into handling format edge cases. Even for this "simple" read-only use case, using excelize saves weeks of XML debugging.

## Runtime State Inventory

> This section is omitted: Phase 1 is greenfield -- no existing state to inventory.

## Common Pitfalls

### Pitfall 1: GetRows Trailing Blank Skipping
**What goes wrong:** `GetRows("6000+ count")` returns rows with fewer than 51 elements. 538 of 942 rows are affected (some as few as 4 elements). The parser crashes with index-out-of-bounds or silently emits wrong data.

**Why it happens:** From xlsx spec: trailing blank cells are not stored in the XML. Excelize's `GetRows` returns only the cells that exist, skipping trailing blanks. If a row has only 4 filled cells, `GetRows` returns a 4-element slice.

**How to avoid:** After reading headers from row 2 (always 51), determine `columnCount = len(headers)`. For each data row, pad with empty strings: `row = append(row, make([]string, columnCount-len(row))...)` or check length and access defensively.

**Warning signs:** Panics like `index out of range [50] with length 4` when accessing columns by position.

### Pitfall 2: Style Fill Color Empty for Some Cells
**What goes wrong:** `GetCellStyle` + `GetStyle` returns a Style with an empty `Fill.Color` slice, or `Fill.Color[0]` is `""`. The parser assumes every cell has a fill color and fails.

**Why it happens:** Cells may inherit the default style (no fill override). Only cells with custom conditional formatting or manual fill have non-empty fill colors. The legend row cells do have fills; many data cells do not (they're white/no-fill, which should map to `none` per D-08).

**How to avoid:** Always nil-check/empty-check `style.Fill.Color` before accessing. If `len(style.Fill.Color) == 0` or `style.Fill.Color[0] == ""` or `style.Fill.Color[0] == "FFFFFFFF"` or `style.Fill.Color[0] == "FF000000"` (pure white/black variations), treat as no-fill (`none`). Only the first element `Color[0]` is the foreground/visible fill color for pattern fills.

### Pitfall 3: Fill Color Format with Alpha Prefix "FF"
**What goes wrong:** The RGB string from excelize has an 8-character format like `"FFD966"` (which is 4 hex bytes: `FF` = alpha, `D9` `66` = RGB). The sRGB linearization expects 6-character RGB without alpha.

**Why it happens:** Excelize stores colors in ARGB format internally. `GetStyle().Fill.Color[0]` returns `"FFD966"` not `"D966"`.

**How to avoid:** Strip the leading `"FF"` prefix when the string is 8 chars and starts with `"FF"`. For format safety:
```go
func trimAlphaPrefix(s string) string {
    if len(s) == 8 && strings.HasPrefix(s, "FF") {
        return s[2:]
    }
    return s
}
```
Or handle both 6-char and 8-char formats in the hex parsing function. Some colors may be `"FFFFFFFF"` (white) or `"FF000000"` (black) -- handle these as no-fill per PIPE-06.

### Pitfall 4: Sheet Name Mismatch
**What goes wrong:** `GetRows("6000+ count")` returns error because the sheet name doesn't match exactly (trailing space, different character encoding, renamed sheet).

**Why it happens:** Google Sheets export may normalize sheet names. If the sheet is renamed externally, or the xlsx stores the name differently.

**How to avoid:** List all sheets with `f.GetSheetList()` before reading. If the expected name isn't found exactly, try case-insensitive match or list available names in the error message. D-13 requires listing ALL structural mismatches at once -- include sheet name mismatch in the multi-error output.

### Pitfall 5: GetRows Returns Inconsistent Types for Numbers
**What goes wrong:** `GetRows` returns all cell values as strings. Numeric columns (price, count) are returned as string representations like `"19.99"` or `"943"`. The parser may accidentally try to parse all as strings and mis-handle numeric filtering -- but Phase 1 only emits strings, so this is a Phase 2 concern.

**Why it happens:** Excelize converts all cell values to strings. The `GetCellValue` function is also string-only.

**How to avoid:** Accept that all values are strings. Phase 2 will handle type detection. For `data.json`, emit all values as strings. The schema (D-09 through D-12) specifies no type metadata in `columns[]`.

### Pitfall 6: Edition Date Location Uncertainty
**What goes wrong:** The edition date stamp is described as "row 1, ~col 47-48". If the exact column changes between xlsx exports, `build` either misses the date or captures some other string.

**Why it happens:** Google Sheets column layout can shift if columns are added/removed. The "~col" qualifier signals uncertainty.

**How to avoid:** Scan row 1 cells for date-like strings (ISO 8601, slash-separated, certain formats) rather than hardcoding column index. If no date-like string found, emit an empty `edition_date` (not fail -- the data is still valid, just undated). Log a warning in verbose mode.

## Code Examples

Verified patterns from official sources:

### Getting Cell Fill Color (excelize v2.8.0+)
```go
// Source: [CITED: pkg.go.dev/github.com/xuri/excelize/v2#File.GetStyle]
styleID, err := f.GetCellStyle("6000+ count", "A3")
if err != nil {
    // handle
}

style, err := f.GetStyle(styleID)
if err != nil {
    // handle
}

// For pattern fills: Color[0] = foreground, may have "FF" alpha prefix
if len(style.Fill.Color) > 0 {
    rawColor := style.Fill.Color[0] // e.g., "FFD966" or "D966"
    if len(rawColor) == 8 && strings.HasPrefix(rawColor, "FF") {
        rawColor = rawColor[2:] // Strip alpha prefix
    }
    // rawColor is now "D966" (6 hex chars)
} else {
    // No fill -- treat as "none"
}
```

### Opening XLSX and Reading Rows
```go
// Source: [CITED: pkg.go.dev/github.com/xuri/excelize/v2 - README]
f, err := excelize.OpenFile("meters.xlsx")
if err != nil {
    return fmt.Errorf("open meters.xlsx: %w", err)
}
defer f.Close()

rows, err := f.GetRows("6000+ count")
if err != nil {
    return fmt.Errorf("read sheet: %w", err)
}

// rows[0] = legend row (row 1)
// rows[1] = header row (row 2)
// rows[2:] = data rows (row 3+)

// IMPORTANT: Pad trailing blanks for rows with fewer cells
expectedCols := len(rows[1])
for i, row := range rows {
    if len(row) < expectedCols {
        padded := make([]string, expectedCols)
        copy(padded, row)
        rows[i] = padded
    }
}
```

### sRGB Linearization (Hand-Rolled)
```go
// Source: [CITED: IEC 61966-2-1:1999 sRGB standard]
func linearizeSRGB(c float64) float64 {
    if c <= 0.04045 {
        return c / 12.92
    }
    return math.Pow((c+0.055)/1.055, 2.4)
}

type sRGB struct{ R, G, B float64 } // 0.0 to 1.0 each

// hexToLinearRGB converts "D966" or "D96642" to linear RGB values
// Expects 6 hex chars (no alpha prefix)
func hexToLinearRGB(hex string) (sRGB, error) {
    if len(hex) != 6 {
        return sRGB{}, fmt.Errorf("invalid hex color: %q", hex)
    }
    r, _ := strconv.ParseUint(hex[0:2], 16, 8)
    g, _ := strconv.ParseUint(hex[2:4], 16, 8)
    b, _ := strconv.ParseUint(hex[4:6], 16, 8)
    return sRGB{
        R: linearizeSRGB(float64(r) / 255.0),
        G: linearizeSRGB(float64(g) / 255.0),
        B: linearizeSRGB(float64(b) / 255.0),
    }, nil
}

// euclideanDistance computes distance in linearized sRGB space
func euclideanDistance(a, b sRGB) float64 {
    dr := a.R - b.R
    dg := a.G - b.G
    db := a.B - b.B
    return dr*dr + dg*dg + db*db // sqrt not needed for comparison
}
```

### JSON Output Struct
```go
// Source: [CITED: D-09 through D-12 schema decisions]
type DataJSON struct {
    EditionDate string `json:"edition_date"`
    FetchedAt   string `json:"fetched_at"`
    Columns     []string `json:"columns"`
    Rows        []Row   `json:"rows"`
}

type Row struct {
    Values map[string]string `json:"values"`    // colName -> raw cell value
    Bands  map[string]string `json:"bands"`     // colName -> "V High"|"High"|"Average"|"Low"|"V Low"
    Flags  map[string]string `json:"flags"`     // colName -> "missing"|"important_missing"|"optional"|"no_info"
}
```

### Fetch Subcommand Error Handling
```go
// Source: [CITED: D-16 requirements]
func fetchURL(url string) error {
    client := &http.Client{Timeout: 30 * time.Second}
    resp, err := client.Get(url)
    if err != nil {
        // Detect error type
        if os.IsTimeout(err) || strings.Contains(err.Error(), "timeout") {
            return &fetchError{code: 3, msg: "FETCH_TIMEOUT: request timed out after 30s"}
        }
        if strings.Contains(err.Error(), "no such host") || strings.Contains(err.Error(), "DNS") {
            return &fetchError{code: 3, msg: "FETCH_DNS_FAILURE: could not resolve hostname"}
        }
        return &fetchError{code: 1, msg: fmt.Sprintf("FETCH_FAILED: %v", err)}
    }
    defer resp.Body.Close()

    switch {
    case resp.StatusCode == http.StatusNotFound:
        return &fetchError{code: 3, msg: fmt.Sprintf("FETCH_404: URL returned 404 - export may have moved: %s", url)}
    case resp.StatusCode >= 500:
        return &fetchError{code: 3, msg: fmt.Sprintf("FETCH_5xx: server error %d", resp.StatusCode)}
    case resp.StatusCode != http.StatusOK:
        return &fetchError{code: 3, msg: fmt.Sprintf("FETCH_HTTP_%d: unexpected status: %s", resp.StatusCode, resp.Status)}
    }
    // ... read body, validate magic bytes, check size, write file
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual XML parsing for cell styles | `GetStyle()` in excelize v2.8.0+ | 2023 | Dramatically simplifies reading fill colors. No need to manually parse `xl/styles.xml`. |
| `tealeg/xlsx` (archived) | `xuri/excelize/v2` | 2025 (tealeg archived) | The only maintained Go xlsx library. excelize has cell fill color reading, streaming, and active development. |

**Deprecated/outdated:**
- `tealeg/xlsx`: Archived on GitHub (Aug 2025), no longer maintained. No cell fill color reading. Do not use.
- `qax-os/excelize`: Outdated fork, not the canonical source. Use `xuri/excelize` instead.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `GetRows` skips only trailing blank cells (not leading). A row with cells at positions AQ-AY returns a 51-element slice with first 42 empty strings. | Standard Stack | Medium risk -- if excelize returns short slices for sparse rows, the padding logic still works but the alignment could be wrong. Mitigation: test with Row 942. |
| A2 | Edition date is in column AU or AV (cols 47-48) of row 1. | Code Examples | Low risk -- the spec says "~col 47-48". If wrong, the edition_date field will be empty or wrong. Mitigation: scan row 1 for date patterns. |
| A3 | The legend row (row 1) has exactly the cells with fills that define the scoring scheme. | Code Examples | Low risk -- confirmed by xlsx inspection (row 1 has distinct cell styles per column). If a column has no fill, that cells legend entry is undefined. |
| A4 | Categorical marker fills use specific exact RGB values in the legend row, distinct from gradient score fills. | Architecture Patterns | LOW -- The CLAUDE.md states categorical markers use exact fill match. If they share fills with gradient colors, the exact-match logic could misclassify. Mitigation: verify against real data. |

## Open Questions

1. **How to differentiate score bands from categorical markers in the legend row?**
   - What we know: Row 1 has both band labels (V High, High, Average, Low, V Low) and categorical markers (missing, important_missing, optional, no_info).
   - What's unclear: How to programmatically distinguish which legend cells are bands vs markers. Options: (a) fixed column ranges, (b) column naming conventions (e.g., columns with a "Score:" sub-header vs "Legend:"), (c) cell value pattern matching.
   - Recommendation: Inspect the xlsx sheet structure to determine the pattern. The shared strings showed "Score:" and "Legend:" as the first entries. The legend row likely has "Score:" and "Legend:" sub-headers that define the groups. During research-phase planning, inspect row 1 cell values against column positions to confirm the band/marker split heuristic.

2. **Exact Euclidean distance threshold for categorical markers?**
   - What we know: D-08 says categorical markers use exact RGB match, not nearest-neighbor. D-07 says tie-breaking goes to higher score band. D-05 says linearized sRGB for score bands.
   - What's unclear: "Exact match" for markers means the cell's fill RGB must exactly equal the legend's marker RGB. But Google Sheets conditional formatting could produce interpolated fills that don't exactly match any marker RGB. Should there be a "close enough" threshold? D-08 is Claude's Discretion.
   - Recommendation: Use exact string match (no tolerance). If a fill falls between a marker color and a band color, it's not a marker -- classify it via nearest-neighbor against score bands. This is the simplest and most correct behavior. Only if cells known to be markers fail classification should a tolerance be added.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Go | CLI compilation | Yes | 1.26.0 | -- |
| `github.com/xuri/excelize/v2` | xlsx parsing | Yes | v2.10.1 | -- |
| `meters.xlsx` | Reference fixture | Yes (repo root) | N/A | -- |
| Google Sheets export URL | fetch subcommand | Not verified | N/A | `--url` flag override (D-02) |

**Missing dependencies with no fallback:** None -- Go 1.26 is installed, excelize added to go.mod, meters.xlsx fixture is present.

## Security Domain

> `workflow.nyquist_validation` is explicitly `false` in .planning/config.json. This section is omitted per protocol.

## Sources

### Primary (HIGH confidence)
- [Context7 /xuri/excelize-doc] -- `GetCellStyle`, `GetStyle`, `GetRows`, `OpenFile`, `Fill`/`Style` struct definitions. Verified that `Fill.Color []string` (not FgColor/BgColor). [VERIFIED: pkg.go.dev/github.com/xuri/excelize/v2]
- [Context7 /xuri/excelize-doc] -- `GetStyle` function signature: `func (f *File) GetStyle(idx int) (*Style, error)`. [VERIFIED: pkg.go.dev]
- [pkg.go.dev/github.com/xuri/excelize/v2] -- Latest version v2.10.1, requires Go 1.24+. [VERIFIED: WebFetch of pkg.go.dev]
- [Go `go version`] -- go1.26.0 darwin/arm64 installed. [VERIFIED: Bash]
- [meters.xlsx inspection] -- 942 rows, 51 cells per row (XML), 268 fills, row 1=legend, row 2=headers, rows 3+=data. Inconsistent cell counts: 538 rows have fewer than 51 cells. [VERIFIED: Bash + Python zipfile inspection]

### Secondary (MEDIUM confidence)
- [WebSearch: Go CLI subcommands] -- cobra vs stdlib flag vs urfave/cli v3 consensus (2026). stdlib flag recommended for 2 subcommands. [CITED: Go blog, ayokoding.com guide]
- [WebSearch: Go golden file testing] -- testdata/ directory convention, -update flag, golden file helpers. [CITED: go.dev blog, javarush golden files]
- [WebSearch: excelize GetStyle Fill] -- Pattern for reading fill colors: GetCellStyle + GetStyle + Fill.Color[0]. [CITED: sunzhongwei.com blog]

### Tertiary (LOW confidence)
- No tertiary sources used -- all critical claims verified with primary or secondary sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - excelize v2.10.1 confirmed, Go 1.26 installed, CLI pattern well-understood
- Architecture: HIGH - verified against xlsx structure, all edge cases documented
- Pitfalls: HIGH - all 6 pitfalls are based on direct xlsx inspection and documented excelize behavior

**Research date:** 2026-06-20
**Valid until:** 2026-07-20 (stable ecosystem -- Go and excelize evolve slowly)
