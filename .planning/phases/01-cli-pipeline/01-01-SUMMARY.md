---
phase: 01-cli-pipeline
plan: 01
subsystem: cmd/meters
tags: ["subcommand-dispatch", "fetch", "http-download", "xlsx-validation", "model-schema"]
depends_on: []
provides: ["meters-fetch-subcommand", "cli-frame", "model-schema"]
affects: []
tech-stack:
  added: []
  patterns: ["stdlib-flag-subcommands", "fetch-error-struct", "httptest-fetch-tests"]
key-files:
  created:
    - cmd/meters/main.go
    - cmd/meters/model.go
    - cmd/meters/fetch.go
    - cmd/meters/fetch_test.go
    - cmd/meters/model_test.go
    - testdata/meters.xlsx
  modified: []
decisions:
  - "Use flag.FlagSet per subcommand (not cobra) for 2-subcommand CLI"
  - "fetchError struct with Code/Msg for clean error propagation"
  - "Case-insensitive error matching for timeout/DNS detection"
  - "t.TempDir() + os.Chdir for test filesystem isolation"
metrics:
  duration: "5h 11m"
  completed_date: "2026-06-20"
  task_count: 3
  test_count: 7
  commit_count: 3
---

# Phase 01 Plan 01: Go CLI Skeleton with Fetch Subcommand

## Objective

Create the Go project structure under `cmd/meters/` with subcommand dispatch (main.go), data model types (model.go), and the fetch subcommand (fetch.go) that downloads and validates the Google Sheets xlsx export.

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create model.go schema types and main.go subcommand dispatcher | `c5fbd4f` | `cmd/meters/main.go`, `cmd/meters/model.go` |
| 2 | Implement fetch subcommand with HTTP GET, validation, and error handling | `0263503` | `cmd/meters/fetch.go`, `cmd/meters/main.go` |
| 3 | Write tests for model serialization and fetch subcommand | `76f4a1f` | `cmd/meters/fetch_test.go`, `cmd/meters/model_test.go`, `testdata/meters.xlsx` |

## Implementation Details

### main.go -- Subcommand Dispatch

- Uses stdlib `flag.FlagSet` within each subcommand function (not cobra/urfave)
- `main()` switches on `os.Args[1]` for `fetch`, `build`, and default
- `buildCmd` prints "build: not yet implemented" and exits 1 (stub for Plan 02)
- Exit codes: 0 success, 1 error, 2 invalid usage (per D-15)
- `printUsage()` writes to stderr

### model.go -- Data Schema Structs

- `DataJSON`: EditionDate, FetchedAt, Columns, Rows with JSON tags per D-09 through D-12
- `Row`: Values, Bands, Flags as `map[string]string` keyed by column name
- Empty maps marshal to `{}` (not `null`) since maps are initialized but empty in production

### fetch.go -- Fetch Subcommand

- `--url` flag (default: Google Sheets export URL from PROJECT.md) and `--verbose`/`-v` flag
- `fetchError` type with `.Code` (exit code) and `.Msg` (error message)
- `runFetch` pipeline:
  1. HTTP GET with 30s timeout
  2. Error classification: timeout, DNS failure, or general failure
  3. HTTP status validation: 404, 5xx, non-200
  4. Magic byte validation: first 2 bytes must be `PK`
  5. Size validation: >= 10,240 bytes
  6. Write to `meters.xlsx` in CWD
- All errors carry grep-able prefixes for CI log parsing

## Verification Results

### go vet
```
vet: PASS
```

### go build
```
build: PASS
```

### go test
```
=== RUN   TestFetchSuccess                  --- PASS
=== RUN   TestFetchHTTPErrors/404            --- PASS
=== RUN   TestFetchHTTPErrors/500            --- PASS
=== RUN   TestFetchHTTPErrors/redirect_to_error --- PASS
=== RUN   TestFetchMagicBytes                --- PASS
=== RUN   TestFetchTooSmall                  --- PASS
=== RUN   TestModelJSONSerialization         --- PASS
```

### CLI Behavior
- `./meters` (no args): prints usage to stderr, exits 2
- `./meters build`: prints "build: not yet implemented", exits 1
- `./meters badcmd`: prints "unknown subcommand", prints usage, exits 2
- `./meters fetch --help`: prints flag help (url, verbose, v), exits 2

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Fix] Removed duplicate fetchCmd declaration from main.go**
- **Found during:** Task 2 verification (go vet/build failed)
- **Issue:** `fetchCmd` was declared as empty stub in main.go AND the real implementation in fetch.go, causing redeclaration error
- **Fix:** Removed the empty stub declaration from main.go (the real declaration in fetch.go provides the symbol)
- **Files modified:** `cmd/meters/main.go`
- **Commit:** 0263503 (amended)

**2. [Rule 3 - Fix] Case-insensitive error matching for timeout and DNS**
- **Found during:** Implementation review
- **Issue:** Go's HTTP Client.Timeout produces error messages like "Client.Timeout exceeded" (uppercase T) which `strings.Contains(err.Error(), "timeout")` would miss. Similarly, DNS errors vary by platform.
- **Fix:** Use `strings.ToLower(err.Error())` for comparison; check for lowercased "dns" instead of uppercase "DNS"
- **Files modified:** `cmd/meters/fetch.go`
- **Commit:** 0263503 (amended)

## Known Stubs

| File | Line | Stub | Reason |
|------|------|------|--------|
| `cmd/meters/main.go` | 25 | `buildCmd` prints "not yet implemented" and exits 1 | Build subcommand implemented in Plan 02 |

## Threat Matrix Compliance

- **T-01-01 (Spoofing):** Mitigated -- ZIP magic byte validation (PK prefix) in `runFetch`
- **T-01-02 (Tampering):** Mitigated -- File size >= 10KB validation, TLS via Go stdlib
- **T-01-03 (Information Disclosure):** Accepted -- `--url` flag intentionally exposed for dev/test
- **T-01-04 (DoS):** Accepted -- No upper size bound on download; developer CLI tool context
- **T-01-SC (Tampering):** Mitigated -- No new external Go dependencies added in this plan

## Self-Check: PASSED

- [x] `cmd/meters/main.go` exists with subcommand dispatch
- [x] `cmd/meters/model.go` exists with DataJSON and Row structs
- [x] `cmd/meters/fetch.go` exists with fetchCmd, runFetch, defaultExportURL
- [x] `go vet ./cmd/meters/` exits 0
- [x] `go build ./cmd/meters/` exits 0
- [x] `go test ./cmd/meters/ -v -count=1 -run 'TestFetch|TestModel'` all pass (7 of 7)
- [x] `testdata/meters.xlsx` fixture exists (136,299 bytes)
- [x] CLI exits with correct codes for no args (2), build (1), unknown command (2)
