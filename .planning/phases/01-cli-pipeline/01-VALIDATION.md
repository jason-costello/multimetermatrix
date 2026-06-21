---
phase: 01-cli-pipeline
slug: 01-cli-pipeline
status: validated
nyquist_compliant: false
wave_0_complete: true
created: 2026-06-21
---

# Phase 01 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | go test (Go stdlib) |
| **Config file** | none -- go.mod at repo root |
| **Quick run command** | `go test ./cmd/meters/ -v -count=1 -run {TestName}` |
| **Full suite command** | `go test ./cmd/meters/ -v -count=1` |
| **Estimated runtime** | ~2 seconds |

---

## Sampling Rate

- **After every task commit:** Run `go test ./cmd/meters/ -v -count=1 -run {TestName}`
- **After every plan wave:** Run `go test ./cmd/meters/ -v -count=1`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| T-01 | 01 | 1 | PIPE-01 | T-01-01 / T-01-02 | fetch downloads xlsx from URL, validates HTTP 200 + ZIP magic bytes + file size >= 10KB | unit | `go test -run TestFetch` | yes | green |
| T-02 | 01 | 1 | PIPE-02 | T-01-01 / T-01-02 | fetch validates response: HTTP 200, PK magic bytes, >= 10KB | unit | `go test -run TestFetch` | yes | green |
| T-03 | 02 | 2 | PIPE-03 | T-02-01 | build parses xlsx with excelize, sheet "6000+ count" only | unit | `go test -run TestFindSheet` | yes | green |
| T-04 | 02 | 2 | PIPE-04 | T-02-02 | build extracts row 1 legend, row 2 headers, rows 3+ data | unit | `go test -run TestParse` | yes | green |
| T-05 | 02 | 2 | PIPE-05 | T-02-02 | build validates sheet structure, fails non-zero listing ALL mismatches | unit | `go test -run TestBuildErrors` | yes | green |
| T-06 | 02 | 2 | PIPE-06 | T-02-03 | Color bucketing: nearest Euclidean distance (linearized sRGB) for bands, exact RGB for markers, white/no-fill -> none; non-band cells excluded from legend | unit | `go test -run TestBuildBandLabelsValid` | yes | red |
| T-07 | 02 | 2 | PIPE-07 | -- | build extracts edition date from row 1 ~col 47-48 | unit | `go test -run TestScanEditionDate` | yes | green |
| T-08 | 02 | 2 | PIPE-08 | T-02-03 | build emits data.json with edition_date, fetched_at, columns[], rows[] (each with values{}, bands{}, flags{}) | integration | `go test -run TestBuildGoldenFile` | yes | green |
| T-09 | 02 | 2 | PIPE-06 | -- | Legend parser excludes non-band cells (edition date leak) | unit | `go test -run TestParseLegendExcludesNonBandLabels` | yes | red |
| T-10 | 02 | 2 | PIPE-07 / Plan 02 | -- | Edition date in ISO 8601 format (YYYY-MM-DD) | unit | `go test -run TestScanEditionDateISO8601` | yes | red |
| T-11 | 01 | 1 | CLI exit codes | D-15 | Correct exit codes for no args (2), unknown subcommand (2), build error (4) | smoke | `go test -run TestCLIExitCodes` | yes | green |
| T-12 | 02 | 2 | --verbose output | D-04 | --verbose prints progress to stderr; without --verbose is silent on success | unit | `go test -run TestBuildVerboseOutput` | yes | green |
| T-13 | 02 | 2 | PIPE-08 | -- | All band labels in data.json are valid score band names (subset of {V High, High, Average, Low, V Low}) | integration | `go test -run TestBuildBandLabelsValid` | yes | red |

*Status: green = test passes, red = test fails (implementation bug), yellow = flaky*

---

## Wave 0 Requirements

- [x] `cmd/meters/main_test.go` -- CLI exit code tests
- [x] `cmd/meters/build_test.go` -- verbose output tests, band label quality test
- [x] `cmd/meters/parse_test.go` -- non-band label exclusion test, edition date ISO 8601 test
- [x] Existing infrastructure covers all other phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| fetch timeout error (FETCH_TIMEOUT) | PIPE-02 | Requires real network timeout conditions; httptest cannot simulate transport timeouts | `go run ./cmd/meters fetch --url http://localhost:1/export?format=xlsx` (connect refused -> FETCH_FAILED, not timeout). To test actual timeout: run against a slow endpoint that exceeds 30s timeout. CI integration tests cover this. |
| fetch DNS failure error (FETCH_DNS_FAILURE) | PIPE-02 | Requires real DNS resolution failure; httptest cannot simulate no-such-host | `go run ./cmd/meters fetch --url http://nonexistent-domain-xyz.example.com/export` should exit 3 with FETCH_DNS_FAILURE. CI integration tests cover this. |
| fetch general transport error (FETCH_FAILED) | PIPE-01 | Real network conditions vary by environment | `go run ./cmd/meters fetch --url http://192.0.2.1/export` (unreachable IP) should exit 1 with FETCH_FAILED. |
| Legend parser excludes date/non-band cells | PIPE-06 | Implementation bug in `parse.go:parseLegend` — `skipLabel` does not filter date-like values ("1/24/2026" leaks into bands). **Tests written** (TestParseLegendExcludesNonBandLabels) but fail. Fix: extend skipLabel or add coordinate-based exclusion for AV1. | Run `go test -run TestParseLegendExcludesNonBandLabels` after fix. Expected: 5 bands, all labels in {V High, High, Average, Low, V Low}. |
| Edition date ISO 8601 format | PIPE-07 / Plan 02 | Implementation gap — `scanEditionDate` returns raw cell value "1/24/2026" (US format). Plan 02 must_have specifies ISO 8601. **Test written** (TestScanEditionDateISO8601) but fails. Fix: add date format conversion in scanEditionDate or runBuild. | Run `go test -run TestScanEditionDateISO8601` after fix. Expected: date matches YYYY-MM-DD. |
| Band label quality (phantom "1/24/2026" labels) | PIPE-08 | Cascading bug from PIPE-06 — 511 cells carry invalid band label "1/24/2026". Fixing parseLegend resolves this automatically. **Test written** (TestBuildBandLabelsValid) but fails. | Run `go test -run TestBuildBandLabelsValid` after Gap 1 fix. Expected: 0 invalid band labels. |

---

## Validation Audit 2026-06-21

| Metric | Count |
|--------|-------|
| Requirements audited | 8 |
| Gaps found | 6 |
| Resolved (tests passing) | 3 |
| Escalated (implementation bugs) | 3 |
| Manual-only (environment-dependent) | 1 |
| Nyquist compliant | false |

**Phase status:** PARTIAL — 3 new passing tests (CLI exit codes, verbose output), 3 failing tests detecting real implementation bugs (legend parser date leak, edition date format, band label quality).

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 2s
- [ ] `nyquist_compliant: true` set in frontmatter -- **NOT COMPLIANT**: 3 implementation bugs found

**Approval:** pending

---

## Gap Analysis

### Gap 1 (PIPE-06): Legend parser includes non-band cells (edition date leak)
- **Test:** `TestParseLegendExcludesNonBandLabels` in `parse_test.go`
- **Result:** FAIL -- `parseLegend` returns 6 bands instead of 5, including "1/24/2026" as a band label
- **Root cause:** `skipLabel` in `parse.go` line 101 filters only "Legend:", "Score:", "Edition:", and ":"-prefixed cells. The date value "1/24/2026" does not match any skip pattern, so it falls through to the `bands = append(bands, ...)` path at line 143.
- **Classification:** BLOCKER -- implementation bug in `parse.go:parseLegend`
- **Action:** ESCALATE to developer

### Gap 2 (PIPE-07 / Plan 02): Edition date format not ISO 8601
- **Test:** `TestScanEditionDateISO8601` in `parse_test.go`
- **Result:** FAIL -- `scanEditionDate` returns "1/24/2026" (US format), not ISO 8601
- **Root cause:** `scanEditionDate` in `parse.go` line 296 returns the raw cell value from AV1 without format conversion. Plan 02 must_have specifies "ISO 8601 string" but no conversion logic exists.
- **Note:** PIPE-07 requirement only says "extracts edition date stamp from row 1 (~col 47-48)" which is satisfied. The Plan 02 must_have specifies ISO 8601. Requires developer resolution of spec vs. plan conflict.
- **Classification:** BLOCKER -- implementation does not match Plan 02 ISO 8601 requirement
- **Action:** ESCALATE to developer

### Gap 3 (PIPE-08): Band label quality in data.json output
- **Test:** `TestBuildBandLabelsValid` in `build_test.go`
- **Result:** FAIL -- 511 cells carry the invalid band label "1/24/2026" instead of a valid score band name
- **Root cause:** Same as Gap 1 -- the edition date cell leaks into the legend bands list during `parseLegend`, and its fill color is close enough to certain data cells (primarily Brand and Light columns) that `nearestBand` assigns "1/24/2026" as the band label.
- **Classification:** BLOCKER -- implementation bug cascading from `parseLegend`
- **Action:** ESCALATE to developer

### Gap 4 (CLI exit codes): No automated test coverage
- **Test:** `TestCLIExitCodes` in `main_test.go`
- **Result:** PASS -- correct exit codes for no args (2), unknown subcommand (2), build error (4)
- **Action:** FILLED

### Gap 5 (--verbose flag output): No automated test coverage
- **Test:** `TestBuildVerboseOutput` and `TestBuildNonVerboseOutput` in `build_test.go`
- **Result:** PASS -- verbose produces expected progress messages; non-verbose is silent
- **Action:** FILLED

### Gap 6 (fetch timeout/DNS errors): Manual-only verification
- **Result:** Documented in manual-only table above
- **Action:** SKIP (documented as manual-only, per Plan 01-01 Task 3 note)
