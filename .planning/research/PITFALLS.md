# Pitfalls Research

**Domain:** Static multimeter spec browser (xlsx data pipeline, plain JS frontend, GitHub Pages)
**Researched:** 2026-06-20
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Excelize Cannot Read Cell Fill Colors Without Manual Internal Traversal (Pre-v2.8)

**What goes wrong:**
`GetCellStyle()` returns only a style ID integer. There is no exported `GetCellBgColor()` method. Developers attempt to read fill colors via `GetCellStyle` and get nothing useful, or crash with nil pointer dereferences when accessing internal style structures.

**Why it happens:**
The Excelize API was designed primarily for writing Excel files, not reading formatting. `GetCellStyle` returns the style index, but the fill color is buried in the internal `File.Styles.CellXfs.Xf[styleID].FillID` and `File.Styles.Fills.Fill[fillID].PatternFill.FgColor` fields. Accessing these directly is fragile — theme colors, nil `SysClr`, and missing `SrgbClr` values all cause panics. The older manual approach (from Issue #526) involves mapping theme indices through `File.Theme.ThemeElements.ClrScheme.Children`, which can contain nil pointers if the file was created by third-party editors.

**How to avoid:**
- Use Excelize **v2.8.0 or later** which provides the official `GetStyle(styleID)` function that returns a full `excelize.Style` struct with a `Fill` field.
- `GetStyle` is the recommended approach from the maintainer and abstracts away the internal traversal.
- Pin to v2.8+ in `go.mod` and verify with `go.sum`.

**Warning signs:**
- Code that accesses `f.Styles.CellXfs.Xf[styleID]` directly
- Nil pointer panics when processing theme-based colors
- Missing fill color for cells known to have conditional formatting fills

**Phase to address:**
Phase 1 (XLSX parsing) — vet which Excelize version, use `GetStyle` from the start.

---

### Pitfall 2: sRGB Gamma Encoding Distorts Nearest-Color Euclidean Distance

**What goes wrong:**
Raw sRGB hex values (like `76923C` or `FF7A00`) are gamma-encoded (non-linear). Computing Euclidean distance directly on these values gives perceptually wrong results — colors that should be "close" numerically look very different to the human eye, and vice versa. This causes mis-bucketing: colors that clearly belong to "High" get bucketed as "Average" or worse.

**Why it happens:**
sRGB applies a gamma compression of approximately 1/2.2 to efficiently encode luminance, exploiting human sensitivity to contrast at low luminance. This means mid-tone differences are compressed and dark-region differences are exaggerated. A Euclidean distance of 50 between two reds in sRGB space looks very different from 50 between two blues, but the math treats them identically. Additionally, the human eye is far more sensitive to green variations than blue, but RGB Euclidean treats all channels equally.

Perceptual accuracy studies show that Euclidean distance in raw sRGB has an average perceptual error (CIEDE2000) of ~12.3, while OKLab's Euclidean distance achieves ~4.1 — a 3x improvement.

**How to avoid:**
- At minimum, linearize sRGB before computing distance: `if c <= 0.04045 { c / 12.92 } else { ((c + 0.055) / 1.055) ^ 2.4 }`.
- For better perceptual accuracy, convert to **OKLab** (Bjorn Ottosson, 2020) and compute Euclidean distance there. OKLab is designed specifically so that Euclidean distance equals perceived difference.
- Available Go libraries: `github.com/soypat/colorspace` (most comprehensive, includes OKLab/OKLCH), or `github.com/georgy7/oklab` (minimal reference implementation).
- For this project's purposes (bucketing into 5 coarse bands), the simpler path — linearize sRGB then compute Euclidean — is likely sufficient. The gradient colors are spread widely enough that even gamma-corrected distance will bucket correctly. The issue is only at gradient boundaries.

**Warning signs:**
- Colors near decision boundaries get bucketed into adjacent bands inconsistently
- A visibly "High"-looking cell repeatedly buckets as "Average"
- Using hex/RGB values directly in distance calculation without linearization

**Phase to address:**
Phase 1 (color module) — implement linearization before Euclidean, or use OKLab.

---

### Pitfall 3: GITHUB_TOKEN Suppresses Downstream Workflows — Commit-and-Deploy Chain Breaks Silently

**What goes wrong:**
The scheduled workflow runs `go run ./cmd/meters build`, commits the generated `data.json` back to the repo using the default `GITHUB_TOKEN`, then expects the GitHub Pages deployment workflow to trigger automatically. **It does not.** The Pages deployment never runs, and the site serves stale data silently.

**Why it happens:**
GitHub explicitly prevents events triggered by the repository's `GITHUB_TOKEN` from spawning new workflow runs (with the exception of `workflow_dispatch` and `repository_dispatch`). This is a security feature to prevent infinite recursive workflow loops. When the scheduled workflow commits `data.json` using `GITHUB_TOKEN`, the `push` event does not trigger the Pages deployment workflow.

**How to avoid:**
Three options:

1. **Switch to artifact-based deployment (recommended):** Use `actions/upload-pages-artifact@v4` and `actions/deploy-pages@v4` in the same workflow. The generated `data.json` goes to the Pages artifact, not committed to the repo. This avoids the push-trigger problem entirely and prevents repository bloat. Requires setting Pages source to "GitHub Actions" in repo settings.

2. **Use a Personal Access Token (PAT):** Override the checkout token with a PAT stored as a secret. PAT-triggered events DO fire downstream workflows. Use `actions/checkout@v4` with `token: ${{ secrets.PAGES_PAT }}`. Risk: can cause infinite loops if not guarded with `[skip ci]` commit messages.

3. **Use explicit `workflow_dispatch`:** From the data-refresh job, call `gh workflow run deploy.yml --ref ${{ github.ref_name }}`. This is allowed even with `GITHUB_TOKEN` since `workflow_dispatch` is an exception.

**Warning signs:**
- `data.json` is committed to the repo but the site doesn't update
- GitHub Pages workflow shows no recent runs
- Only the first manual deploy works; scheduled updates are invisible

**Phase to address:**
Phase 2 (CI/CD) — decide deployment strategy before writing the workflow YAML.

---

### Pitfall 4: Inserting 1000 Table Rows One at a Time Causes Multi-Second Freeze

**What goes wrong:**
The frontend iterates over 942 rows and calls `tableBody.appendChild(tr)` for each one, or uses `innerHTML +=` in a loop. The browser freezes for several seconds while performing 942 separate layout recalculations (each `appendChild` triggers reflow for the entire table). 51 columns means each row has 51 `<td>` children — that's ~48,000 DOM nodes total, each triggering layout recalculation.

**Why it happens:**
Table layout is the most expensive DOM operation. Every structural change to a `<table>` forces the browser to recalculate column widths based on ALL rows before rendering any of them. Doing this 942 times sequentially blocks the main thread. Even `innerHTML +=` in a loop re-parses and re-renders the entire table each iteration.

**How to avoid:**
- Build a single HTML string from all rows: `const html = rows.map(r => buildRow(r)).join('')`, then insert once: `tbody.innerHTML = html` or `tbody.insertAdjacentHTML('beforeend', html)`.
- For even better perceived performance with very large datasets, insert in batches of 200-500 rows with `setTimeout(0)` or `requestAnimationFrame` between batches to yield to the event loop.
- Always set `table-layout: fixed` on the `<table>` and pre-define column widths via `<colgroup>` — this eliminates per-row width calculation.
- Use `textContent` (not `innerHTML`) for any live cell updates after initial render.

**Warning signs:**
- Page takes 3+ seconds to become interactive after data loads
- Browser console shows long task warnings (>50ms main thread blocks)
- Scroll jitter after initial render
- Visible incremental row rendering

**Phase to address:**
Phase 2 (frontend) — use string-batch pattern from the start. Not a virtualization problem at 942 rows; the single-insert optimization is sufficient.

---

### Pitfall 5: No Validation That Google Sheets Structure Changed — Silent Corruption

**What goes wrong:**
The Google Sheet maintainer renames a column, adds a new row type above the header, changes the legend format, or moves the edition date. The Go CLI silently parses the new structure and generates `data.json` with wrong headers, missing values, or incorrect color bands. Because the workflow auto-commits, the broken data ships to production without anyone noticing.

**Why it happens:**
The project spec correctly identifies this risk ("fail loudly on data structure changes") but the default implementation often just iterates cells by position (row 1 = legend, row 2 = headers, rows 3+ = data). Without structural validation, any layout change produces garbage data. The sheet is externally maintained (by a community, not the developer), so changes happen unpredictably.

**How to avoid:**
- Validate expected headers: maintain a map of known column names and their expected positions. If the actual column count or known header names don't match, abort with a clear error message.
- Validate row count minimum (reject if fewer rows than headers + 1).
- Validate legend: confirm that row 1 contains recognizable legend patterns (e.g., at least some hex color strings in expected positions).
- Validate the edition date cell pattern matches `Edition: YYYY-MM-DD` or similar.
- Include a `--dry-run` flag that validates structure without writing output.
- Consider a `schema_version` field in `data.json` to track structural evolution.

**Warning signs:**
- `data.json` is regenerated successfully but shows different column count or names
- Headers in the output don't match the expected 51 columns
- Color bands are all `none` (no cell fills found)
- Historical: 51 columns → sheet changes produces 48 or 52

**Phase to address:**
Phase 1 (parsing) — implement structural validation before any data extraction.

---

### Pitfall 6: Concurrency Race Condition Between Data Refresh and GitHub Pages Build

**What goes wrong:**
The scheduled data-refresh workflow pushes `data.json` to `main`, which triggers the built-in `pages-build-deployment` workflow. If the data-refresh workflow hasn't finished before Pages tries to build, or if two scheduled runs overlap, the workflow reports "cancelled" or deploys stale content. Worse: the `pages-build-deployment` built-in workflow uses the source branch name as its concurrency group key, which can collide with the scheduled workflow's own concurrency group, cancelling the scheduled run.

**Why it happens:**
GitHub's built-in `pages-build-deployment` workflow uses the branch name as its concurrency group. When your scheduled workflow pushes to `main` while a Pages build is already running on `main`, the Pages workflow cancels the scheduled workflow run. Additionally, the built-in Pages workflow has `cancel-in-progress: true` by default, so rapid pushes only deploy the last one.

**How to avoid:**
- Use a custom deployment workflow with `actions/deploy-pages@v4` instead of the built-in Pages bot. This gives you full control over concurrency.
- Set `concurrency:` group without cancellation: `cancel-in-progress: false`.
- Combine data refresh and deployment into a single workflow to avoid cross-workflow race conditions entirely.
- If using the built-in Pages deployment, use a unique concurrency group name in your scheduled workflow (not the branch name).

**Warning signs:**
- Workflow runs showing "Canceling since a higher priority waiting request for 'pages build and deployment @ main' exists"
- Scheduled runs reporting "cancelled" without errors
- Site serving yesterday's data even though today's workflow succeeded

**Phase to address:**
Phase 2 (CI/CD) — single workflow for both refresh and deploy, with explicit concurrency control.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Committing `data.json` to main branch | Simple, zero-config deployment on GitHub Pages | Repository bloat (weekly commits of ~500KB file), Git history pollution, workflow trigger issues, merge conflicts on concurrent pushes | Only if artifact-based deployment is infeasible; cap with `.gitattributes` binary diff |
| Euclidean distance in raw sRGB | One line of math, no dependencies | Wrong color bucketing at gradient boundaries (perceptually inaccurate); hard to fix later because bucketed data is in production | Never — linearizing sRGB is ~5 lines of code and avoids re-bucketing later |
| No structural validation in `build` | Faster development, fewer checks to maintain | Silent data corruption when sheet changes — broken data ships to production unnoticed | Never — this is a data pipeline; validation is the core quality guarantee |
| One-by-one DOM insertion in JS | Simplest first-pass code | 2-5 second browser freeze on load, users think site is broken | Never — single string build is equally simple and 50x faster |
| Using `GITHUB_TOKEN` for commit-and-deploy | No secrets management needed | Deployment chain breaks silently, site goes stale | Only if using artifact-based deployment (no commit needed) |
| Hardcoding column width assumptions (51 cols at fixed positions) | Simple parser code | Brittle against sheet reorgs; downstream tools that re-export add/drop columns | Acceptable for MVP with structural validation as safety net |
| Using `[skip ci]` in auto-commits | Less CI noise | Blocks downstream CI from running; PR branch protection rules can't see skipped check runs | Never in auto-commits that need to trigger other workflows |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Google Sheets XLSX export | Assuming cells have the exact legend RGB colors | They don't — conditional formatting interpolates a gradient. Always bucket via nearest-color algorithm. |
| Excelize v2.7.x or older | Calling `GetCellStyle` and expecting fill color directly | Upgrade to v2.8+ and use `GetStyle(styleID)`, which returns a `Style` struct with `Fill` fields |
| Google Sheets export URL | Using a URL that requires auth or session cookies | The export URL must have "Anyone with the link" viewer access. Test with `curl` to confirm it returns ZIP (magic bytes `PK`) not an HTML login page. |
| GitHub Pages with `_` prefixed directories | Files not found (404) after deploy | Add `.nojekyll` file to deployment root — Jekyll ignores `_` prefixed directories by default |
| `actions/upload-pages-artifact` | Uploading wrong path (e.g. repo root instead of `/site`) | Verify the `path:` parameter matches where `index.html` lives. Use `path: './site'` or similar. |
| `actions/deploy-pages@v4` | Error "in progress deployment" because a prior deploy is still running | Add concurrency group with `cancel-in-progress: false` (queue) or throttle to prevent overlap |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| No `table-layout: fixed` | Scroll jank, slow initial render, resizing columns during load | Set `table-layout: fixed` + `<colgroup>` widths | 200+ rows with 50+ columns |
| One-at-a-time `appendChild` | 3-10 second freeze on load, browser "long task" warnings | Build HTML string, single `innerHTML` or `insertAdjacentHTML` | 200+ rows |
| No `requestIdleCallback` / batched sort | 1-2 second freeze when user clicks column header | Debounce sort operations, consider Web Worker for sort logic on 51 columns x 942 rows | 500+ rows |
| All columns visible by default without horizontal scroll management | Page width exceeds viewport, unreadable on mobile | `overflow-x: auto` on table container, sticky first 2 columns, hide non-essential columns behind "show more" | 30+ columns |
| Re-rendering entire table on every filter change | One-second pauses each time user checks a facet | Cache sorted/filtered rows, only re-render on change, use documentFragment or innerHTML for batch replace | 200+ rows with frequent facet toggling |
| No debounce on free-text search facet | Re-renders on every keystroke | Debounce 150-300ms before filtering | Real-time input |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Hardcoding Google Sheets export URL in source | Low risk (public sheet), but URL could leak to unintended audiences | Store as a GitHub Actions secret if the sheet has sensitive data; otherwise a public URL in Go code is acceptable for a public sheet |
| Exposing all 51 columns including "Price" | Price data could be sensitive for B2B distributors | None needed — the sheet is already public; consider adding `column_visibility` config to hide certain columns |
| `GITHUB_TOKEN` scope leaks | The auto-commit workflow has broad access to the repo | Use minimal permissions: `permissions: contents: write, pages: write, id-token: write` — never use `all` |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No loading state while data.json loads | Blank page while parsing ~500KB JSON, users think page is broken | Show a progress bar or skeleton table immediately; parse JSON asynchronously with streaming if available |
| All 51 columns shown by default | Horizontal scrolling hell on mobile, unusable | Start with a sensible subset (Model, Brand, Count, Price, etc.) and let users add columns |
| No visual indication that facets are filtering | Users forget they have active filters, think data is missing | Show active filter count or chips; provide a "clear all" button |
| No feedback on stale data | Users see last week's data and think it's current | Show "Data as of: YYYY-MM-DD (refreshed: ...)" in footer always |
| No handling of empty/null cells | "undefined" or "NaN" in cells ruin sorting and display | Render empty cells as "—" (em dash) and sort them last/consistently |
| Sort indicator missing or ambiguous | Users can't tell which column is sorted or direction | Show visible sort arrow (up/down) on active column header |
| No column resize or text truncation | Long values break table layout | `text-overflow: ellipsis` on cells; tooltip on hover for full value |

---

## "Looks Done But Isn't" Checklist

- [ ] **Data pipeline:** Validates that row 1 is actually the legend (not an empty row or title), row 2 has expected column headers, and row count is > 3
- [ ] **Color bucketing:** Handles white/no-fill cells gracefully (doesn't bucket them into "V Low" because white happens to be closer to FF5700 than to 76923C) — white cells should be `none`
- [ ] **Color module:** Uses linearized sRGB (or OKLab) for distance calculation, not raw hex values
- [ ] **CI/CD:** Deployment uses artifact-based approach (not commit to main) or uses PAT to trigger downstream workflows
- [ ] **CI/CD:** `.nojekyll` file is present in deployment root
- [ ] **CI/CD:** Concurrency group is configured to prevent overlapping deployments
- [ ] **CI/CD:** Workflow has `workflow_dispatch` for manual triggering (debugging, emergency refresh)
- [ ] **Frontend:** `table-layout: fixed` is set on `<table>` with explicit column widths
- [ ] **Frontend:** Rows are inserted as a single batch (string join), not one-by-one `appendChild`
- [ ] **Frontend:** Empty/null cells render as "—" not "undefined"
- [ ] **Frontend:** JSON parsing is async with a loading state; data.json is ~500KB at 942 rows x 51 cols
- [ ] **Frontend:** Horizontal scroll container wraps the table on small screens
- [ ] **Error handling:** Failed `fetch` step exits non-zero (detected by CI)
- [ ] **Error handling:** Missing expected headers cause `build` to exit non-zero
- [ ] **Error handling:** Color bucket fallback — if fill color can't be read or computed, the cell has `"bands": {}` not a crash
- [ ] **Edge case:** Sheet "Outsiders" is explicitly ignored (not processed)
- [ ] **Edge case:** Edition date is parsed correctly even if the cell format varies slightly

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Sheet structure changed, bad data shipped | HIGH — users see wrong data, manual intervention needed | 1. Identify which column structure changed (check GitHub Actions log). 2. Update parser to handle new layout. 3. Pin to stable column names (match by header string, not position). 4. Re-run workflow manually. |
| Color bucket algorithm wrong (raw sRGB vs linear) | MEDIUM — all band data is perceptually wrong | 1. Fix color.go with linearization or OKLab. 2. Rebuild data.json. 3. Redeploy. Old site serves bad bands until redeploy. Historical data is lost (but bands are approximate anyway). |
| Workflow token permission issue | LOW — just the schedule fails | 1. Identify the issue (GITHUB_TOKEN vs PAT). 2. Update workflow. 3. Run manually via `workflow_dispatch`. 4. Set up alert for missed scheduled runs. |
| Repository bloat from committed data.json | MEDIUM — git history grows, clones slow | 1. Switch to artifact-based deployment (this avoids committing entirely). 2. Optionally `git filter-branch` to remove historical data.json blobs from history (as a separate cleanup PR). |
| Frontend freezing on sort/filter | MEDIUM — users can't interact | 1. Profile which operation is slow (sort vs render). 2. Move sort to a Web Worker (942x51 = ~48K cells sorted by any column). 3. Batch DOM updates. 4. If still slow, add virtual scrolling. |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Excelize GetStyle API version requirement | Phase 1 (parsing) | `go test` verifies GetStyle returns correct fill for known sample cells in meters.xlsx |
| sRGB gamma in color distance | Phase 1 (color module) | Unit test verifies linearized distance produces same banding as raw (for sample) OK; integration test with known gradient colors validates buckets |
| GITHUB_TOKEN deployment chain breaks | Phase 2 (CI/CD) | Workflow test: manually trigger workflow_dispatch, verify Pages updates. Review concurrency settings before merge. |
| One-at-a-time row insertion | Phase 2 (frontend) | Load with 942 rows, measure Time To Interactive < 1s, no long task warnings |
| Sheet structure validation | Phase 1 (parsing) | Unit test with modified headers (add/remove/reorder) — build must exit non-zero |
| Concurrency race condition | Phase 2 (CI/CD) | Run workflow twice in quick succession, verify only one deploy at a time, no cancellations |
| `.nojekyll` missing | Phase 2 (CI/CD) | CI step creates the file in deployment root before upload |
| Feature parity: sync/async fetch, loading states | Phase 2 (frontend) | Slow network throttling in DevTools shows loading state before data appears |
| Empty/null cell handling | Phase 2 (frontend) | Seed cells with empty values in test data.json, verify "—" rendering |
| Sheet "Outsiders" exclusion | Phase 1 (parsing) | Integration test confirms only "6000+ count" sheet is processed |

---

## Sources

- **Excelize GetStyle / cell fill reading:** [Issue #526 - getCellBgColor error](https://github.com/qax-os/excelize/issues/526)
- **Excelize fill color with GetStyle (v2.8+):** [Modifying background color without affecting styles](https://blog.gitcode.com/ac89a5d808033235d83dbfc90230c354.html)
- **Excelize GetBaseColor nil pointer:** [GetBaseColor() null pointer analysis](https://blog.gitcode.com/dd646a72fda915cdf49873e330df7b94.html)
- **Excelize concurrency panic:** [Issue #1903 - concurrent GetCellStyle panic](https://github.com/qax-os/excelize/issues/1903)
- **Excelize v2.10.0 release notes:** [xuri.me/excelize/en/releases/v2.10.0.html](https://xuri.me/excelize/en/releases/v2.10.0.html)
- **sRGB gamma/linear RGB distance:** [sRGB to linear conversion formula (sRGB standard)](https://web.archive.org/web/20060913000000/http://en.wikipedia.org:80/wiki/SRGB_color_space)
- **OKLab vs RGB color matching:** [OKLab vs RGB: Why Your Color Matching Algorithm is Wrong](https://dev.to/bmbrick/oklab-vs-rgb-why-your-color-matching-algorithm-is-wrong-2dd0)
- **Linear RGB and XYZ calculation:** [image-engineering.de](https://image-engineering.de/library/technotes/958-how-to-convert-between-srgb-and-ciexyz)
- **Go OKLab library:** [github.com/soypat/colorspace](https://github.com/soypat/colorspace)
- **Go OKLab minimal:** [github.com/georgy7/oklab](https://github.com/georgy7/oklab)
- **GITHUB_TOKEN workflow suppression:** [GitHub Docs — GITHUB_TOKEN](https://docs.github.com/en/actions/concepts/security/github_token#when-github_token-triggers-workflow-runs)
- **Cascading GitHub Action workflows:** [Parker Higgins — 2025-07](https://parkerhiggins.net/2025/07/cascading-github-action-workflows-for-static-sites/)
- **GitHub Pages deployment race condition:** [Qiskit Issue #3342](https://github.com/Qiskit/documentation/issues/3342), [Stack Overflow](https://stackoverflow.com/questions/75988524/pages-build-and-deployment-workflow-run-cancelled-from-main-branch/75988572)
- **Pages concurrency group collision:** [Adafruit Issue #2327](https://github.com/adafruit/Adafruit_Learning_System_Guides/issues/2327)
- **Large DOM table performance:** [bench-dom-insert-nodes](https://github.com/node-vision/bench-dom-insert-nodes)
- **GitHub Pages artifact deployment:** [GitHub Docs — Custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- **Scheduled workflow 60-day suspension:** [GitHub Community Discussion #185828](https://github.com/orgs/community/discussions/185828)
- **Keepalive workflow:** [GitHub Marketplace](https://github.com/marketplace/actions/keepalive-workflow)
- **Google Sheets API conditional formatting:** [Google Developers](https://developers.google.com/workspace/sheets/api/samples/conditional-formatting)
- **Parsing Google Sheet with colors:** [Stack Overflow #77967799](https://stackoverflow.com/questions/77967799/parsing-google-sheet-with-colors)

---
*Pitfalls research for: Handheld Meters Browser (static multimeter spec browser)*
*Researched: 2026-06-20*
