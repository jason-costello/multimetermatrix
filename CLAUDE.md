# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Static, faceted/sortable browser for handheld multimeter specs. Data sourced from a
Google Sheets export, processed by a Go CLI into `data.json`, served as a plain
HTML/JS page on GitHub Pages. No backend, no auth, no npm build step.

Full spec: `PROJECT.md`

Example data: `meters.xlsx` (in repo root) — the actual Google Sheets export,
used for development and testing without hitting the live URL.

## Build & run

```bash
# Download Google Sheets xlsx export
go run ./cmd/meters fetch

# Parse meters.xlsx → data.json
go run ./cmd/meters build
```

`fetch` must fail (non-zero exit) on: HTTP status != 200, file not valid xlsx
(magic bytes `PK`), or file size < 10KB.

`build` must fail loudly on missing/renamed headers — never silently emit partial data.

## Architecture

```
cmd/meters/       Go CLI — fetch.go, parse.go, color.go, model.go, main.go
site/             Static frontend — index.html, app.js, style.css
data.json         Generated output, committed by CI
.github/workflows/refresh.yml
```

### Data pipeline

1. **fetch**: HTTP GET the export URL → `meters.xlsx`
2. **parse** (excelize): Read sheet "6000+ count" — row 1 legend (fill RGB → label), row 2 column headers, rows 3+ data
3. **color**: For each cell, bucket fill RGB into nearest score band (`V High`/`High`/`Average`/`Low`/`V Low`) by Euclidean RGB distance, or match exact categorical markers (`missing`, `important_missing`, `optional`, `no_info`). White/no-fill → `none`.
4. **model**: Emit `data.json` with `edition_date`, `fetched_at`, `columns`, `rows[].values`, `rows[].bands`, `rows[].flags`

### Color handling nuance

The score legend defines 5 exact colors, but Google Sheets conditional formatting
produces a **continuous gradient** — interpolated fills like `FF7A00`, `FFA900`
not exact legend matches. Bucket by nearest Euclidean RGB distance. Categorical
markers (x, O, ?) use exact fill match, not nearest-neighbor.

## Frontend

Static HTML/JS, zero dependencies. 942 rows, ~51 columns. Features:
- Table with column sort (click header, toggle asc/desc)
- Facet filters per column — checkbox lists for bands/flags, free text/range for raw values
- Footer: edition date + last-refreshed timestamp from `data.json`

## CI/CD

Weekly refresh (`0 6 * * 1`) + `workflow_dispatch`. Steps: checkout → setup-go →
`go run ./cmd/meters fetch` → `go run ./cmd/meters build` → commit `data.json` if
changed → push. GitHub Pages serves from `main` or `gh-pages` branch (TBD).

## Key constraints

- Sheet structure (headers/legend position) assumed stable — `build` must fail clearly if assumptions break
- Ignore sheet "Outsiders", only process "6000+ count"
- Edition date stamp in row 1 (~col 47-48) must be captured
- No external runtime JS dependencies (keep it GitHub-Pages-trivial)

<!-- GSD:project-start source:PROJECT.md -->
## Project

**Handheld Meters Browser**

Static, faceted/sortable browser for ~940 handheld multimeter specs sourced from a Google Sheets export. Go CLI downloads and parses the xlsx into `data.json`; a zero-dependency HTML/JS frontend renders the table with column sort, per-column facet filters, and score-band color bucketing. Hosted on GitHub Pages, refreshed weekly via GitHub Actions. No backend, no auth, no npm build step.

**Core Value:** Users can quickly find and compare handheld multimeters by filtering and sorting across 51 spec columns — replacing manual spreadsheet scrolling with a fast, faceted browser.

### Constraints

- **Tech stack**: Go (excelize for xlsx parsing), plain HTML/CSS/JS (no framework, no CDN deps)
- **Hosting**: GitHub Pages
- **Refresh**: Weekly via GitHub Actions, must fail loudly on data structure changes
- **No runtime dependencies**: Frontend must work with zero external JS/CSS fetches
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Core Technologies
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Go | 1.24+ | CLI for xlsx fetch/parse/build pipeline | Single binary, excellent standard library (net/http for download, encoding/json for output), zero runtime deps, trivial CI. Chosen over Node/Python because excelize is the best Go xlsx library and Go produces a self-contained binary with no runtime to install in CI. |
| `github.com/xuri/excelize/v2` | v2.10.x | XLSX parsing (read cell values + fill colors) | **Only serious option** for Go xlsx reading in 2025-26. tealeg/xlsx is archived and dead. excelize is pure Go (no CGO), actively maintained by xuri, supports reading cell styles/fills for color bucketing, and has streaming row iteration. Requires Go 1.25+ for latest v2.10.x; use v2.9.x if pinned to Go 1.24. |
| Plain HTML/CSS/JS | N/A | Frontend table with faceted sortable view | Project constraint: zero build step, no npm, no CDN deps. With ~940 rows and 51 columns, plain DOM manipulation is entirely sufficient. No framework overhead needed. |
| GitHub Actions | N/A | CI/CD: weekly data refresh + deploy | Native to GitHub, free for public repos, integrates with Pages natively via `actions/deploy-pages@v4`. Handles schedule + workflow_dispatch + commit + deploy in one file. |
| GitHub Pages | N/A | Static hosting | Free, serves from repo branch/root, no server config, handles HTTPS and custom domains. Only viable free option for static hosting with Google-indexed content. |
### Go CLI Dependencies
| Library | Import Path | Purpose | Why |
|---------|-------------|---------|-----|
| excelize | `github.com/xuri/excelize/v2` | Open xlsx, read rows, read cell fill colors | The canonical xlsx library. `GetCellStyle()` + `GetStyle()` returns fill info including ARGB color strings for cell background. |
| Go stdlib `net/http` | `net/http` | Download xlsx from Google Sheets export URL | Standard library, no external dep needed. Must check response status 200 and validate magic bytes. |
| Go stdlib `encoding/json` | `encoding/json` | Marshal data.json output | Standard library, produces clean JSON from structs. |
| Go stdlib `os/exec` | `os/exec` | (If needed) validate xlsx file | Standard library. git commit/push from CI is done by shell commands, not Go. |
### Development Tools
| Tool | Purpose | Notes |
|------|---------|-------|
| `go vet` | Static analysis of CLI code | Run in CI before build step. |
| `staticcheck` | Linter | `go install honnef.co/go/tools/cmd/staticcheck@latest` — catches unused code, style issues. Optional but recommended. |
| `gh` CLI | Validate GitHub Pages deploy | Useful during setup to configure Pages source and verify deployment. |
## Installation
# Initialize Go module
# Add excelize (latest stable as of June 2026)
# Verify
## Alternatives Considered
| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| excelize/v2 | tealeg/xlsx (archived) | Never — tealeg/xlsx is archived on GitHub (Aug 2025), unmaintained, high memory usage, no cell fill/color reading support. The maintainer himself recommends excelize. |
| excelize/v2 | qax-os/excelize (fork) | Never — this is an outdated fork/mirror. The canonical repo is `xuri/excelize`. The qax-os fork shows old releases and stale code. |
| Plain JS table | simple-datatables (npm) | Not applicable — project bans npm/CDN deps. simple-datatables is a good library (6KB gzipped, zero deps), but even a script-tag include violates the "zero external runtime dependencies" constraint. |
| Plain JS table | List.js | Not applicable — same dependency issue. List.js is 10KB and provides sort + search + filtering, but requires a script tag or npm. |
| GitHub Actions + `actions/deploy-pages` | Deploy from gh-pages branch (branch-based) | Branch-based is simpler to set up (no workflow needed) but less secure and lacks atomic deploys. For this project, either works since the site is static and the CI already runs weekly. Use deploy-pages if Pages source is set to "GitHub Actions" in repo settings. |
| GitHub Actions + `actions/deploy-pages` | peaceiris/actions-gh-pages | Third-party action that pushes to gh-pages branch. Works, but official `actions/deploy-pages` is now the recommended path. peaceiris is still viable if you need PR previews (which this project doesn't). |
## What NOT to Use
| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `tealeg/xlsx` | **Archived.** Maintainer explicitly says "no further support." No cell fill color API for reading background RGB. High memory usage (2.4GB for 100K rows). GitHub archived Aug 2025. | `github.com/xuri/excelize/v2` |
| `qax-os/excelize` | Outdated fork. Stale releases, points to xuri docs, confusing import path. Uses the same code but is not the canonical source. | `github.com/xuri/excelize/v2` |
| Any npm table library (DataTables, AG Grid, Tabulator) | Violates the project constraint of "no build step, no CDN deps." These are powerful but heavy, and you'd need to vendor them or use a CDN. 940 rows is trivially small for vanilla DOM. | Hand-rolled HTML table with `querySelectorAll`, `Array.sort()`, and CSS classes. |
| Virtual scrolling / windowing (TanStack Virtual, Clusterize) | Not needed for 940 rows. The overhead of virtual scrolling (measuring row heights, managing scroll position, DOM recycling) exceeds the rendering cost of a 940-row table. Browsers handle 1000 rows easily with standard `<table>` rendering. | Standard `<table>` element with `tbody`. |
| React / Vue / Svelte | Massive overkill for a single-page table browser. The build step requirement alone disqualifies them. | Plain JS DOM manipulation. |
| jQuery | 40KB of library to provide `$()` and `.on()` which native `querySelectorAll` and `addEventListener` already do. | Native DOM API. |
## Stack Patterns by Variant
- GitHub Pages source = `Deploy from branch` → `main` → `/` (root)
- Place `index.html` at repo root alongside `data.json`
- JS/CSS in `/site/` subfolder or flat at root
- CI commits `data.json` to main; Pages picks up changes on next deploy cycle
- Drawback: Pages might show a slight staleness window between commit and Pages rebuild
- GitHub Pages source = `GitHub Actions`
- CI workflow generates `data.json`, then uses `actions/upload-pages-artifact@v4` + `actions/deploy-pages@v4`
- No need to commit `data.json` to the repo at all — it's uploaded as a deploy artifact
- `index.html`, `app.js`, `style.css` are all uploaded together in the same artifact
- Benefit: atomic deploys, no garbage commits in repo history, cleaner git log
- Tradeoff: slightly more complex workflow (but only by a few lines)
## Version Compatibility
| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `github.com/xuri/excelize/v2@v2.10.1` | Go 1.25+ | Min Go version bumped to 1.25 in v2.10.x |
| `github.com/xuri/excelize/v2@v2.9.1` | Go 1.23+ | Use this if targeting ubuntu-latest with Go 1.23-1.24 |
| `actions/checkout@v4` | All | v4 uses Node 20. v5+ may require Node 24+ or ESM. Pin to v4 for stability. |
| `actions/upload-pages-artifact@v3` | All | v3 is stable and widely documented. v4/v5 exist but add no material benefit for this project. |
| `actions/deploy-pages@v4` | All | v4 is current recommended version in GitHub docs. v5 exists but is new. |
| `actions/configure-pages@v5` | All | Needed only if using `upload-pages-artifact` + `deploy-pages` chain. |
## Sources
- **Context7 /xuri/excelize-doc** — excelize API for reading cell values, styles, and fill colors. GetCellStyle + GetStyle returns structured fill data.
- **GitHub xuri/excelize** — v2.10.1 confirmed as latest (Feb 2026). Import path: `github.com/xuri/excelize/v2`. Requires Go 1.25+.
- **GitHub tealeg/xlsx** — Archived Aug 2025, maintainer recommends excelize. [HIGH confidence — verified via GitHub archive status + community reports]
- **WebSearch: Go xlsx benchmark comparison** — excelize dominates throughput (42K rows/sec), memory (312MB), and GC pauses (1.8%). tealeg shows 12K rows/sec, 862MB memory, 12.9% GC. [MEDIUM confidence — single source (datasea.cn) but consistent with community knowledge]
- **GitHub Docs: Using custom workflows with GitHub Pages** — Confirms `actions/configure-pages@v5`, `actions/upload-pages-artifact@v4`, `actions/deploy-pages@v4`. Required permissions: `pages: write`, `id-token: write`. [HIGH confidence — verified via WebFetch of official docs]
- **GitHub releases** — `actions/upload-pages-artifact@v5.0.0` (Apr 2026), `actions/deploy-pages@v5.0.0` (Mar 2026), `actions/checkout@v7.0.0` (Jun 2026). [HIGH confidence — verified via WebFetch of release pages]
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
