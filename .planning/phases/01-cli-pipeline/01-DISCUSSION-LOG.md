# Phase 1: CLI Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-20
**Phase:** 1-CLI Pipeline
**Areas discussed:** CLI interface design, Color space for bucketing, data.json schema details, Error reporting strategy

---

## CLI Interface Design

| Option | Description | Selected |
|--------|-------------|----------|
| fetch + build (as spec'd) | `meters fetch` downloads xlsx, `meters build` parses and emits data.json | ✓ |
| download + parse | `meters download` gets the file, `meters parse` reads and emits | |
| Single command: meters run | One command does both fetch + build | |

**User's choice:** `fetch` + `build` — matches PROJECT.md and REQUIREMENTS.md exactly.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Default hardcoded URL + --url flag override | URL baked into binary, `--url` flag overrides for testing | ✓ |
| --url flag only (required) | No default — user must always pass the URL | |
| Environment variable | `METERS_EXPORT_URL` env var | |

**User's choice:** Default URL + `--url` override — convenient default with flexibility.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed filenames (meters.xlsx, data.json) | No path flags — always reads/writes from working directory | ✓ |
| Flags: --out for fetch, --in/--out for build | Maximum flexibility for CI and local dev | |
| Positional arguments | Traditional Unix pattern | |

**User's choice:** Fixed filenames — simplest, matches current spec.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Verbose mode (--verbose / -v) | Print progress info: row count, color buckets matched, output file size | ✓ |
| --version flag | Print version string | |
| Both --version and --verbose | Version string + progress output | |

**User's choice:** `--verbose` / `-v` flag for progress output. Silent by default.

---

## Color Space & Bucketing

| Option | Description | Selected |
|--------|-------------|----------|
| Linearized sRGB | Convert sRGB hex → linear RGB, then Euclidean distance | ✓ |
| OKLab | Perceptually uniform color space | |

**User's choice:** Linearized sRGB — simple, standard, fast. Good enough for spreadsheet cell colors.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Extract from row 1 at parse time | Read legend row's fill colors dynamically | ✓ |
| Hardcode the 5 score band colors | Compile expected legend colors into binary | |

**User's choice:** Dynamic extraction from row 1 — adapts if the sheet changes its color scheme.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Assign to higher band | Bias toward the better score when ambiguous | ✓ |
| First match wins | Deterministic but order-dependent | |
| Leave unlabeled | Flag as ambiguous, most conservative | |

**User's choice:** Assign higher band — more favorable/generous to the meter spec.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Extract from legend row (same as score bands) | Parse categorical legend from row 1 dynamically | ✓ |
| Hardcode categorical marker colors | Well-defined meanings, more reliable | |

**User's choice:** Dynamic extraction, same strategy as score bands.

---

## data.json Schema

| Option | Description | Selected |
|--------|-------------|----------|
| By column name (string keys) | Self-describing, easier for frontend JS | ✓ |
| By column index (numeric keys) | Compact but fragile | |

**User's choice:** Column name string keys — readable, self-describing.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Just name (string array) | Minimal, frontend renders headers directly | ✓ |
| name + type | Frontend can auto-detect filter inputs | |
| name + type + display | Full metadata for rendering and filtering | |

**User's choice:** Strings only — minimal, simple.

---

| Option | Description | Selected |
|--------|-------------|----------|
| ISO 8601 strings | Standard, machine-parseable, human-readable | ✓ |
| Unix timestamps (seconds) | Compact, easy to compare | |

**User's choice:** ISO 8601 strings.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Flat array (positional) | Simple iteration, natural for table rendering | ✓ |
| Object keyed by model name | Fast lookup but fragile keys | |

**User's choice:** Flat array — positional order, natural for table iteration.

---

## Error Reporting Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| List all mismatches at once | Report every problem found in one error dump | ✓ |
| First error only (fail fast) | Stop at first problem | |

**User's choice:** All mismatches at once — best for debugging.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Clean stderr messages only | Human-readable, no Go stack trace noise | ✓ |
| Clean message + debug trace with --verbose | Both worlds via flag | |

**User's choice:** Clean stderr messages only.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Standard Unix: 0/1/2/3/4/5 | Different codes per error type | ✓ |
| Simple 0/1 | Success or failure only | |

**User's choice:** Standard Unix exit codes with distinct values per error category.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Distinct messages per error type | Each failure mode gets a specific, grep-able message | ✓ |
| Generic message + HTTP status | Simpler but less actionable | |

**User's choice:** Distinct messages per HTTP failure type.

---

## Claude's Discretion

- Go module internal layout under `cmd/meters/`
- Exact Euclidean distance threshold for categorical marker matching
- excelize streaming vs full-load for 942 rows
- Test strategy specifics (golden files, table-driven tests)

## Deferred Ideas

None — discussion stayed within Phase 1 scope.
