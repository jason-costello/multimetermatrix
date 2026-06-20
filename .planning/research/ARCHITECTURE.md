# Architecture Research

**Domain:** Static data browser systems (CLI pipeline + faceted frontend)
**Researched:** 2026-06-20
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
                         ┌─────────────────────────────────────────┐
                         │         GitHub Actions (CI/CD)           │
                         │  ┌───────────────────────────────────┐  │
                         │  │         refresh.yml                │  │
                         │  │  weekly cron + workflow_dispatch  │  │
                         │  └──────────┬────────────────────────┘  │
                         └─────────────┼───────────────────────────┘
                                       │ triggers
                                       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                          CLI Pipeline (Go Binary)                         │
│                                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐       │
│  │  fetch cmd    │    │  build cmd   │    │   data.json          │       │
│  │               │    │              │    │   (committed output) │       │
│  │ HTTP GET xlsx │───▶│  excelize    │───▶│                      │       │
│  │ validate magic│    │  parse sheet │    │  edition_date        │       │
│  │ size check    │    │  extract RGB │    │  fetched_at          │       │
│  └──────┬─────── ┘    │  nearest-    │    │  columns[]           │       │
│         │             │  color match │    │  rows[]              │       │
│         ▼             │  bucket bands│    │   ├ values{}         │       │
│  ┌──────────────┐    │  flag markers│    │   ├ bands{}          │       │
│  │ meters.xlsx  │    └──────────────┘    │   └ flags{}          │       │
│  │ (local cache)│                       └──────────────────────┘       │
│  └──────────────┘                                                     │
└──────────────────────────────────────────────────────────────────────────┘
                                       │ committed to git repo
                                       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                     GitHub Pages /site (Static Hosting)                   │
│                                                                          │
│  ┌────────────┐     ┌───────────────────────────────────────────┐       │
│  │ index.html │     │              app.js                         │       │
│  │  (shell)   │────▶│                                           │       │
│  └────────────┘     │  ┌─────────┐  ┌──────────┐  ┌──────────┐ │       │
│                     │  │ Data    │  │ Filter   │  │ Render   │ │       │
│  ┌────────────┐     │  │ Layer   │─▶│/Sort     │─▶│ Layer    │ │       │
│  │ style.css  │     │  │ (JSON   │  │ Layer    │  │ (inner   │ │       │
│  └────────────┘     │  │  fetch) │  │ (pure    │  │  HTML)   │ │       │
│                     │  └─────────┘  │  funcs)  │  └──────────┘ │       │
│  ┌────────────┐     │               └──────────┘               │       │
│  │ data.json  │────▶│                                           │       │
│  │ (same-     │     └───────────────────────────────────────────┘       │
│  │  origin)   │                                                        │
│  └────────────┘                                                        │
└──────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|---------------|------------------------|
| `fetch` command | Download xlsx, validate ZIP magic bytes, size sanity check, save to disk | Go `net/http` GET with status check, file header peek for `PK` |
| `build` command | Open xlsx, parse sheet "6000+ count", extract legend/headers/data, bucket colors, emit JSON | `excelize.OpenFile()`, iterate rows with `GetRows()`, extract fill via `GetStyle()` |
| `color.go` | RGB distance computation, nearest-legend-color matching, categorical marker exact matching | Euclidean distance in 3D RGB space, threshold-based exact match |
| `data.json` | Single-file data contract consumed by frontend and inspectable in diffs | JSON with `edition_date`, `fetched_at`, `columns`, `rows[]` |
| `app.js` | Fetch data, manage filter/sort state, re-render table on changes | Three-layer (data/filter-sort/render) pure-function architecture |
| `index.html` | Shell: load script, contain table and facet controls, footer for timestamps | Semantic HTML with `<table>`, `<select>`/checkbox groups, no shadow DOM |
| `refresh.yml` | Weekly trigger, run pipeline, conditionally commit on change, deploy to Pages | `schedule: cron`, `git diff --cached --quiet`, conditional `git commit` |
| `style.css` | Table layout, facet panel styling, color band indicators, responsive breakpoints | CSS Grid/Flexbox for layout, CSS custom properties for color bands |

## Recommended Project Structure

```
/cmd/meters/
  main.go         — CLI entry: `fetch` and `build` subcommands
  fetch.go         — HTTP download, validation
  build.go         — xlsx parsing, JSON emission orchestration
  color.go         — Euclidean RGB nearest-color + exact-match marker logic
  model.go         — Meter struct, data.json schema, JSON tags

/site/
  index.html       — Shell markup with facet controls, table, footer
  app.js           — Three-layer frontend: data, filter/sort, render
  style.css        — All styling (zero external deps)

data.json          — Generated artifact (committed to repo)

.github/workflows/
  refresh.yml      — Weekly scheduler + conditional commit + Pages deploy

go.mod
go.sum
meters.xlsx        — Dev/test fixture (commit once, not regenerated on every run)
```

### Structure Rationale

- **`/cmd/meters/`:** Go convention: one package per binary, with `main.go` as thin entry point dispatching to sub-commands. Each file owns a single concern (fetch, build, color, model). Keeps the CLI understandable at a glance.
- **`/site/`:** All static frontend assets. Zero build step means these files are served as-is by GitHub Pages. No `dist/` or `build/` directory — what you see is what ships.
- **`data.json` at root:** Single generated artifact. Committed to repo so history is trackable in git diffs. Served by GitHub Pages alongside `/site/` content (or referenced via relative path).
- **`meters.xlsx`:** Committed once as a test fixture so `build` can be run offline during development without hitting the live Google Sheets URL every time.

## Architectural Patterns

### Pattern 1: Pipeline Stages (ETL with explicit validation gates)

**What:** The CLI is structured as sequential stages with validation gates between them. Each stage either succeeds (produces output) or fails (non-zero exit, clear error message). This mirrors the ETL pattern common in data pipelines.

**When to use:** Any data pipeline where a failure mid-way should stop processing loudly rather than silently producing partial output.

**Trade-offs:**
- Pros: Fail-fast, easy to debug, each stage independently testable, clear error messages for CI logs
- Cons: Slightly more code than a monolithic script, requires explicit stage state

**Example:**
```
FetchStage: HTTP GET → validate PK magic bytes → validate size ≥ 10KB → save to meters.xlsx
                                                    ↓ fail: exit 1, "Downloaded file is not a valid xlsx"
ParseStage: Open xlsx → validate row 1 has legend → validate row 2 has 51 headers → iterate rows 3+
                                                    ↓ fail: exit 1, "Expected 51 columns, found N"
ColorStage: For each cell → extract fill RGB → exact match against markers? → else nearest legend color? → else none
EmitStage: Assemble data.json struct → marshal JSON → write file
                                                    ↓ fail: exit 1, "Failed to marshal JSON"
```

**Validation gates are the key architectural insight:** Each stage validates its input assumptions before proceeding. The `build` command must fail if the sheet structure changes (different number of columns, missing legend row, etc.) so a sheet reorg doesn't silently ship broken data.

### Pattern 2: Data-as-Contract (single JSON file as interface boundary)

**What:** The `data.json` file serves as the formal interface contract between the Go pipeline and the JS frontend. Both sides are developed against this schema independently. The schema is versioned in git, so any breaking change is visible in diffs.

**When to use:** Any system where a generated data artifact crosses a language boundary (Go → JS, Python → JS, etc.). Avoids tight coupling between pipeline and frontend.

**Trade-offs:**
- Pros: Frontend and pipeline can be developed/tested independently; schema changes are explicit in git; JSON is human-readable for debugging
- Cons: Schema drift is possible (must validate at build time); large JSON files bloat git history

**Schema (from PROJECT.md):**
```json
{
  "edition_date": "2026-01-24",
  "fetched_at": "2026-06-20T06:00:00Z",
  "columns": ["Model", "Brand", "Count", "AC+", "..."],
  "rows": [
    {
      "values":  {"Model": "S Energy", "Brand": "Gossen", "Count": 60000},
      "bands":   {"AC+": "high", "uV": "v_high", "Price": "low"},
      "flags":   {"DUT": "optional", "Light": "missing"}
    }
  ]
}
```

The three sub-objects per row (`values`, `bands`, `flags`) separate concerns: `values` is the raw data for display/sorting, `bands` is the color-bucketed score for faceting, and `flags` is the categorical markers for faceting. This avoids mixing types in a single field.

### Pattern 3: Re-render-on-change (no virtual DOM, no reactivity system)

**What:** The frontend stores all state in a plain JS object and re-renders the entire `<tbody>` on every filter/sort change. There is no virtual DOM diffing, no two-way binding, no reactivity system. The render function is a pure function of `(data, filters, sortKey, sortDir) → HTML string`.

**When to use:** Small-to-medium datasets (up to low thousands of rows) where re-render performance is not a concern. Avoids framework complexity for no benefit.

**Trade-offs:**
- Pros: Zero dependencies, trivially debuggable, works forever without maintenance, no build step
- Cons: Full re-render is wasteful for large datasets (not an issue at ~940 rows); loses scroll position on re-render (mitigate: `scrollTop` save/restore on the container)

**Example flow:**
```javascript
// State
const state = {
  data: null,          // full row array from data.json
  filters: {},         // { columnKey: Set<string> } for checkbox facets
  textFilters: {},     // { columnKey: string } for free-text
  sortKey: null,
  sortDir: 'asc'
}

// Pure filter/sort pipeline
function getFilteredRows(state) {
  let rows = state.data
  for (const [col, values] of Object.entries(state.filters)) {
    if (values.size > 0) {
      rows = rows.filter(r => values.has(r.bands[col]) || values.has(r.flags[col]))
    }
  }
  if (state.sortKey) {
    rows = [...rows].sort((a, b) => {
      const va = a.values[state.sortKey], vb = b.values[state.sortKey]
      return (va < vb ? -1 : va > vb ? 1 : 0) * (state.sortDir === 'asc' ? 1 : -1)
    })
  }
  return rows
}

// Explicit re-render
function render() {
  const rows = getFilteredRows(state)
  tbody.innerHTML = rows.map(buildRowHTML).join('')
}
```

### Pattern 4: Git Scraping (conditional commit on data change)

**What:** The CI workflow runs the pipeline, stages the generated `data.json`, and only commits if the file actually changed. This avoids a clutter of "no changes" commits in git history. Pattern coined by Simon Willison in 2020.

**When to use:** Any CI-driven data refresh where the source data may or may not have changed since the last run.

**Trade-offs:**
- Pros: Clean git history (no empty commits), easy to spot data changes in diffs, low storage overhead
- Cons: Must handle the `git commit` exit code (1 when nothing to commit); need `fetch-depth: 0` or careful diff targeting

**Example workflow fragment:**
```yaml
- name: Build data
  run: go run ./cmd/meters build

- name: Stage data.json
  run: git add data.json

- name: Check for changes
  id: diff
  run: |
    if git diff --cached --quiet; then
      echo "changed=false" >> $GITHUB_OUTPUT
    else
      echo "changed=true" >> $GITHUB_OUTPUT
    fi

- name: Commit and push
  if: steps.diff.outputs.changed == 'true'
  run: |
    git config user.name "multimeter-bot"
    git config user.email "bot@users.noreply.github.com"
    git commit -m "chore(data): weekly refresh $(date +'%Y-%m-%d')"
    git push
```

### Pattern 5: Nearest-Color Bucketing (Euclidean distance in RGB space)

**What:** Cell fill colors from Google Sheets conditional formatting are interpolated gradient values, not exact legend colors. The pipeline computes the nearest of 5 known legend colors by Euclidean distance in RGB space and assigns the corresponding score band.

**When to use:** Any system that needs to classify continuous color-scale values into discrete categories. Particularly relevant for extracting meaning from spreadsheet conditional formatting.

**Trade-offs:**
- Pros: Simple to implement, fast (51 columns x ~940 rows = ~48k lookups at most), deterministic
- Cons: Euclidean RGB distance does not perfectly match human color perception; colors near the boundary between two legend colors may be misclassified at the boundary

**Implementation sketch:**
```go
var legendColors = map[string]RGB{
    "v_high":  {0x76, 0x92, 0x3C},
    "high":    {0x99, 0xCC, 0x00},
    "average": {0xD4, 0xCC, 0x00},
    "low":     {0xFF, 0xCC, 0x00},
    "v_low":   {0xFF, 0x57, 0x00},
}

var markerColors = map[RGB]string{
    {0xDD, 0xD9, 0xC3}: "missing",
    {0x7F, 0x7F, 0x7F}: "important_missing",
    {0x8D, 0xB3, 0xE2}: "optional",
    {0xCC, 0xC0, 0xD9}: "no_info",
}

func nearestLegendColor(cell RGB) string {
    // First: exact match against markers
    if flag, ok := markerColors[cell]; ok {
        return flag // distinguished from bands by the caller
    }
    // Then: nearest Euclidean distance to legend scores
    minDist := math.MaxFloat64
    var best string
    for label, legend := range legendColors {
        d := math.Pow(float64(cell.R-legend.R), 2) +
             math.Pow(float64(cell.G-legend.G), 2) +
             math.Pow(float64(cell.B-legend.B), 2)
        if d < minDist {
            minDist = d
            best = label
        }
    }
    return best
}
```

## Data Flow

### Pipeline Data Flow (CI execution)

```
Google Sheets Export URL
    │
    ▼
┌──────────────────────────────────────────┐
│  fetch command                            │
│  ├─ net/http GET xlsx export URL         │
│  ├─ validate: first 2 bytes == "PK"       │
│  ├─ validate: file size >= 10KB           │
│  └─ save to: meters.xlsx                  │
└──────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────┐
│  build command                            │
│  ├─ excelize.OpenFile("meters.xlsx")     │
│  ├─ validate: sheet "6000+ count" exists │
│  ├─ parse row 1 → legend map + edition   │
│  ├─ validate: row 2 has 51 headers       │
│  ├─ parse rows 3+ → iterate cells:       │
│  │   ├─ GetCellValue() → raw value       │
│  │   ├─ GetStyle() → fill RGB             │
│  │   ├─ nearestColor() → band/flag       │
│  │   └─ assemble Meter struct            │
│  ├─ capture: edition_date from row 1     │
│  └─ marshal + write data.json            │
└──────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────┐
│  post-pipeline (in CI)                    │
│  ├─ git add data.json                     │
│  ├─ git diff --cached --quiet             │
│  ├─ if changed: commit + push             │
│  └─ GitHub Pages redeploys (auto)         │
└──────────────────────────────────────────┘
```

### Frontend Data Flow (user interaction)

```
Page Load
    │
    ▼
Fetch data.json (same-origin fetch)
    │
    ▼
Initialize state.data = rows[]
    │
    ▼
render() ─────────────────────────────────────┐
    │                                          │
    ├─ getFilteredRows(state)                  │
    │   ├─ apply checkbox facet filters        │
    │   ├─ apply text/range filters            │
    │   └─ apply sort (key + direction)        │
    │                                          │
    └─ tbody.innerHTML = rows.map(buildRow)    │
        ↑                                      │
        │                                      │
User Event (click facet, type filter,          │
            click column header) ──────────────┘
    │
    ▼
Update state (filters, sortKey, sortDir)
    │
    ▼
render() (re-enters the loop)
```

### Key Data Flows

1. **Pipeline emission flow:** Raw cell values (strings/numbers) + raw fill colors (RGB ints) → combined into Meter struct → marshaled as data.json with `values`/`bands`/`flags` split per row. The split at the pipeline boundary means the frontend never needs to understand xlsx or color math.

2. **Frontend fetch flow:** `data.json` loaded via `fetch()` at page load (same-origin, no CORS issues since it's co-located in the Pages site). Single fetch, all data in memory. No lazy loading or pagination needed at ~940 rows (~200-400KB JSON).

3. **Filter render flow:** User toggles a facet checkbox → `state.filters[col]` updated → `render()` called → filter pipeline re-executes on full dataset → `tbody.innerHTML` replaced. The pure-function pipeline ensures no stale state issues.

4. **CI commit flow:** Workflow runs → fetch + build produce new `data.json` → git add → git diff detects whether actual content changed → conditional commit. If the xlsx is unchanged, no commit happens, no Pages redeploy, no noise.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| ~940 rows (current) | Direct HTML table, full re-render on every filter change, single JSON file. No optimization needed. |
| 10K-100K rows | Add pagination or virtual scrolling to the frontend. Consider chunking `data.json` into compressed segments. |
| 100K+ rows | Move to a client-side database (SQLite via `sql.js`) or server-side API. Static JSON approach breaks down. |

### Scaling Priorities

1. **First bottleneck (frontend re-render):** At ~940 rows with 51 columns, a full innerHTML rebuild takes <10ms. Not a concern. If rows grow to 10K+, add windowed rendering (render only visible rows) or debounced re-render on rapid filter changes.

2. **Second bottleneck (JSON size):** The full JSON is ~200-400KB. Gzipped this is ~50-80KB. GitHub Pages supports gzip. If it grows past 5MB (unlikely for this domain), consider compressing the JSON or splitting into a metadata index + data chunks.

**Neither bottleneck is expected to matter for this project.** The architecture is intentionally simple for the scale.

## Anti-Patterns

### Anti-Pattern 1: Adding a JavaScript framework "just in case"

**What people do:** Include React/Vue/Svelte because the project "might grow" or "a framework is standard."

**Why it's wrong:** This adds a build step, npm dependency tree, CI install step, and framework upgrade burden to a static page that renders ~940 rows. The complexity cost is immediate; the "need" is hypothetical. GitHub Pages serves static files — a build step means either committing `dist/` or using a Pages Actions deploy. Neither is simpler than plain HTML/JS.

**Do this instead:** Use the three-layer pattern (data → filter/sort → render with innerHTML). If the project genuinely outgrows it (it won't at this scale), the data layer and filter layer are pure functions and trivially portable to any framework.

### Anti-Pattern 2: Silently handling sheet structure changes

**What people do:** Parse the xlsx with flexible column detection, skip unknown columns, emit whatever data exists without validation.

**Why it's wrong:** If someone renames a column, adds columns, or rearranges the sheet, the pipeline silently emits data that doesn't match the frontend's expected columns. The table renders wrong columns or wrong order, and the data refresh CI succeeds, shipping broken data to production.

**Do this instead:** The `build` command MUST validate that row 2 contains exactly the 51 expected headers (whitespace-trimmed, case-insensitive comparison). If the count differs or any expected header is missing, exit non-zero with a clear error listing what was expected vs what was found. This triggers a CI failure alert, and the developer can investigate before data goes live.

### Anti-Pattern 3: Loading data via `<script>` tag with inline JSON

**What people do:** Embed `data.json` content directly in a `<script>` tag in `index.html` to avoid a fetch.

**Why it's wrong:** This couples the HTML generation to the data pipeline, requires regenerating `index.html` during the build, and makes the HTML file change on every data refresh (noisy diffs). It also prevents the browser from caching `data.json` independently of the page.

**Do this instead:** Fetch `data.json` at runtime with a simple `fetch('./data.json')`. The file is same-origin (GitHub Pages), so no CORS issues. Cache headers can be set independently for the HTML (immutable) and the JSON (shorter TTL if desired).

### Anti-Pattern 4: Processing the "Outsiders" sheet

**What people do:** Process both sheets in the xlsx because "more data is better" or "it's there."

**Why it's wrong:** The "Outsiders" sheet has a different structure, different meaning, and is explicitly out of scope per the project spec. Processing it adds complexity, risks data corruption, and produces a confusing user experience (mixing different meter categories).

**Do this instead:** Explicitly check the sheet name is `"6000+ count"`. If the sheet doesn't exist (renamed, deleted), fail loudly. Only process the one known-good sheet.

### Anti-Pattern 5: Using Cobra or other CLI framework for 2 subcommands

**What people do:** Pull in `spf13/cobra` (43k stars, de-facto standard) for the CLI.

**Why it's wrong:** Cobra is a heavy dependency for a binary with exactly 2 subcommands (`fetch`, `build`) that have no shared flags, no persistent flags, no shell completion requirement, and no nested subcommands. The `flag` stdlib package with a `switch` statement in `main.go` is simpler, has zero dependencies, and is easier to understand.

**Do this instead:** Use `os.Args[1]` switch with `flag.NewFlagSet` per subcommand in `main.go`. The pattern is well-documented and sufficient for this scope. If the CLI grows to 5+ subcommands, consider Cobra.

```
Example of what's sufficient:

func main() {
    if len(os.Args) < 2 {
        fmt.Fprintln(os.Stderr, "usage: meters <fetch|build>")
        os.Exit(1)
    }
    switch os.Args[1] {
    case "fetch":
        fetch.Run()
    case "build":
        build.Run()
    default:
        fmt.Fprintf(os.Stderr, "unknown command: %s\n", os.Args[1])
        os.Exit(1)
    }
}
```

This pattern keeps the binary small (faster CI install from module cache), and the two subcommands are structurally simple enough that Cobra's help generation and flag inheritance provide no benefit.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Google Sheets API | HTTP GET to export URL (`format=xlsx`) | Public sheet, no auth. Must validate response isn't HTML login page. URL is stable but not guaranteed — have a fallback plan. |
| GitHub Actions | Scheduled workflow + workflow_dispatch | Free for public repos. PAT may be needed for commit-triggered workflows if using a protected branch. |
| GitHub Pages | Branch-based (main:/site or gh-pages) | Auto-deploys after push to source. Confirm exact source folder once repo exists. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `fetch.go` → `meters.xlsx` | File system write | No in-memory handoff. The file is the contract between fetch and build. Allows running `build` independently with the committed test fixture. |
| `build.go` → `data.json` | File system write + JSON marshal | `data.json` is the single source of truth for the frontend. The schema is the interface contract. |
| `data.json` → `app.js` | HTTP fetch at page load | Same-origin; no CORS. The fetch is async but completes quickly (~200-400KB). `app.js` treats this as immutable once loaded. |
| Pipeline ↔ CI | Exit code + stdout/stderr | Non-zero exit on validation failure triggers CI failure. Clear error messages go to stderr for inspection in CI logs. |

## Sources

- Simon Willison, "Git scraping: track changes over time by scraping to a Git repository" (2020): https://simonwillison.net/2020/Oct/9/git-scraping/
- Simon Willison, git-scraper-template: https://github.com/simonw/git-scraper-template
- Build Interactive Comparison Tools with Zero Dependencies (dev.to): https://dev.to/profiterole/build-interactive-comparison-tools-with-zero-dependencies-1k7l
- Excelize v2.8 GetStyle documentation: https://pkg.go.dev/github.com/xuri/excelize/v2
- Excelize Issue #526 (getCellBgColor): https://github.com/qax-os/excelize/issues/526
- Flat Data GitHub Action: https://github.com/githubocto/flat
- simonw/datasette (inspiration for data-as-contract approach)

---
*Architecture research for: Handheld Meters Browser (static multimeter spec browser)*
*Researched: 2026-06-20*
