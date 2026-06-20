# Stack Research

**Domain:** Static multimeter spec browser (Go CLI + vanilla JS frontend, GitHub Pages)
**Researched:** 2026-06-20
**Confidence:** HIGH

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

```bash
# Initialize Go module
go mod init github.com/<user>/multimeters

# Add excelize (latest stable as of June 2026)
go get github.com/xuri/excelize/v2@v2.10.1

# Verify
go mod tidy
```

No npm/node install needed. No frontend dependencies.

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

**If deploying from repo root (simplest approach):**
- GitHub Pages source = `Deploy from branch` → `main` → `/` (root)
- Place `index.html` at repo root alongside `data.json`
- JS/CSS in `/site/` subfolder or flat at root
- CI commits `data.json` to main; Pages picks up changes on next deploy cycle
- Drawback: Pages might show a slight staleness window between commit and Pages rebuild

**If using GitHub Actions artifact deployment (modern approach, preferred):**
- GitHub Pages source = `GitHub Actions`
- CI workflow generates `data.json`, then uses `actions/upload-pages-artifact@v4` + `actions/deploy-pages@v4`
- No need to commit `data.json` to the repo at all — it's uploaded as a deploy artifact
- `index.html`, `app.js`, `style.css` are all uploaded together in the same artifact
- Benefit: atomic deploys, no garbage commits in repo history, cleaner git log
- Tradeoff: slightly more complex workflow (but only by a few lines)

**Recommendation for this project:** Use the **artifact deployment** approach. The CI already exists (weekly refresh + push), and the extra 3 YAML lines for `upload-pages-artifact` + `deploy-pages` are negligible. The benefit of not committing generated `data.json` to git history is real: weekly commits of the same file create noise, and diffs of a 6MB JSON file are unwieldy.

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

---
*Stack research for: Handheld Meters Browser (Go CLI + static HTML/JS data browser)*
*Researched: 2026-06-20*
