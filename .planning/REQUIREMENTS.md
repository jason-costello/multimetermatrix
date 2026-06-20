# Requirements: Handheld Meters Browser

**Defined:** 2026-06-20
**Core Value:** Users can quickly find and compare handheld multimeters by filtering and sorting across 51 spec columns.

## v1 Requirements

### CLI Pipeline

- [ ] **PIPE-01**: `fetch` subcommand downloads xlsx from Google Sheets export URL via HTTP GET
- [ ] **PIPE-02**: `fetch` validates response: HTTP 200, ZIP magic bytes (`PK`), file size >= 10KB
- [ ] **PIPE-03**: `build` subcommand parses xlsx with excelize — reads sheet "6000+ count", ignores "Outsiders"
- [ ] **PIPE-04**: `build` extracts row 1 legend (fill RGB → label), row 2 headers (51 columns), rows 3+ data
- [ ] **PIPE-05**: `build` validates sheet structure (expected headers, column count) and fails non-zero on mismatch
- [ ] **PIPE-06**: Color bucketing: nearest Euclidean distance (linearized sRGB or OKLab) for score bands, exact RGB match for categorical markers (x, O, ?), white/no-fill → none
- [ ] **PIPE-07**: `build` extracts edition date stamp from row 1 (~col 47-48)
- [ ] **PIPE-08**: `build` emits `data.json` with `edition_date`, `fetched_at`, `columns[]`, `rows[]` (each with `values{}`, `bands{}`, `flags{}`)

### Frontend Table

- [ ] **UI-01**: Render all rows and columns from `data.json` as an HTML table
- [ ] **UI-02**: Column header click sort with asc/desc/unsorted cycle
- [ ] **UI-03**: Free-text search across all columns with visible results count (e.g. "342 of 940")
- [ ] **UI-04**: Band facet checkboxes (V High / High / Average / Low / V Low) per gradient column
- [ ] **UI-05**: Flag facet checkboxes (missing / important missing / optional / no info) per categorical column
- [ ] **UI-06**: Numeric range filter (min/max) on key spec columns (Price, Count, etc.)
- [ ] **UI-07**: Color-coded cell backgrounds from band/flag data
- [ ] **UI-08**: Legend display showing score colors and categorical marker meanings
- [ ] **UI-09**: Sticky table header on vertical scroll
- [ ] **UI-10**: Empty state when filters match zero results
- [ ] **UI-11**: Footer with edition date + last refreshed timestamp from `data.json`

### Polish

- [ ] **POL-01**: Mobile responsive — horizontal scroll wrapper for table
- [ ] **POL-02**: Row hover highlight
- [ ] **POL-03**: Batch DOM insertion (`insertAdjacentHTML`) — no per-row `appendChild`

### CI/CD

- [ ] **CI-01**: GitHub Actions workflow — scheduled weekly (`0 6 * * 1`) + `workflow_dispatch`
- [ ] **CI-02**: Workflow steps: checkout → setup-go → fetch → build → deploy to GitHub Pages
- [ ] **CI-03**: Artifact-based GitHub Pages deployment (upload-pages-artifact + deploy-pages) with concurrency control
- [ ] **CI-04**: `.nojekyll` file in site root for GitHub Pages

## v2 Requirements

### URL State & Column Controls

- **URL-01**: URL-encoded filter/sort state for deep linking and shareable URLs
- **URL-02**: Column visibility toggle with localStorage persistence
- **URL-03**: Sticky first column (Model name always visible during horizontal scroll)

### Compare Mode

- **COMP-01**: Checkbox row selection for side-by-side comparison
- **COMP-02**: Side-by-side table view of selected meters
- **COMP-03**: Differences-only toggle in compare mode

## Out of Scope

| Feature | Reason |
|---------|--------|
| Backend/API server | Static only — GitHub Pages |
| User authentication | Public data, no accounts needed |
| npm/Webpack build step | Zero-dependency constraint |
| Virtualization library | 940 rows renders fine without |
| React/Vue/Svelte framework | Plain JS only |
| Dark mode (v1) | Defer to v2 |
| Keyboard navigation (v1) | Defer to v2 |
| CSV export | Defer to v2 |
| AI-powered recommendations | Anti-feature for this domain |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PIPE-01 | Phase 1 | Pending |
| PIPE-02 | Phase 1 | Pending |
| PIPE-03 | Phase 1 | Pending |
| PIPE-04 | Phase 1 | Pending |
| PIPE-05 | Phase 1 | Pending |
| PIPE-06 | Phase 1 | Pending |
| PIPE-07 | Phase 1 | Pending |
| PIPE-08 | Phase 1 | Pending |
| UI-01 | Phase 2 | Pending |
| UI-02 | Phase 2 | Pending |
| UI-03 | Phase 2 | Pending |
| UI-04 | Phase 2 | Pending |
| UI-05 | Phase 2 | Pending |
| UI-06 | Phase 2 | Pending |
| UI-07 | Phase 2 | Pending |
| UI-08 | Phase 2 | Pending |
| UI-09 | Phase 2 | Pending |
| UI-10 | Phase 2 | Pending |
| UI-11 | Phase 2 | Pending |
| POL-01 | Phase 2 | Pending |
| POL-02 | Phase 2 | Pending |
| POL-03 | Phase 2 | Pending |
| CI-01 | Phase 3 | Pending |
| CI-02 | Phase 3 | Pending |
| CI-03 | Phase 3 | Pending |
| CI-04 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-20*
*Last updated: 2026-06-20 after initial definition*
