# Roadmap: Handheld Meters Browser

## Overview

This project delivers a static, faceted/sortable browser for ~940 handheld multimeter specs. The journey starts with a Go CLI pipeline that fetches and parses a Google Sheets xlsx export into a structured data.json, continues with a zero-dependency HTML/JS frontend that renders a sortable, filterable table with per-column band faceting, and finishes with a CI/CD pipeline that auto-refreshes the data weekly via GitHub Pages. Three phases, each a complete vertical slice: data pipeline, user interface, deployment automation.

Granularity: Coarse (3 phases for 25 v1 requirements). Each phase delivers a coherent, independently verifiable capability.

## Phases

- [ ] **Phase 1: CLI Pipeline** - Go CLI that downloads xlsx, parses it, buckets colors, and emits validated data.json
- [ ] **Phase 2: Frontend Table + Polish** - Sortable, filterable HTML table with band faceting, legend, responsive design
- [ ] **Phase 3: CI/CD & Deployment** - Weekly auto-refresh and GitHub Pages deployment via GitHub Actions

## Phase Details

### Phase 1: CLI Pipeline
**Goal**: Developers can run `meters fetch && meters build` to produce a validated data.json from the Google Sheets xlsx export

**Depends on**: Nothing (first phase)

**Requirements**: PIPE-01, PIPE-02, PIPE-03, PIPE-04, PIPE-05, PIPE-06, PIPE-07, PIPE-08

**Success Criteria** (what must be TRUE):
1. Running `meters fetch` downloads the xlsx from the Google Sheets export URL, validates HTTP 200 + ZIP magic bytes (`PK`) + file size >= 10KB, and saves to disk
2. Running `meters build` opens the xlsx with excelize, reads only sheet "6000+ count" (ignoring "Outsiders"), extracts row 1 legend (fill RGB to label), row 2 headers (51 columns), rows 3+ data, and produces a valid `data.json` with `edition_date`, `fetched_at`, `columns[]`, and `rows[]`
3. Each row in `data.json` contains `values{}`, `bands{}`, `flags{}` -- score bands bucketed via nearest Euclidean distance (linearized sRGB or OKLab), categorical markers (x, O, ?) matched by exact RGB, white/no-fill cells left unlabeled
4. Running `meters build` on a structurally invalid or changed sheet exits non-zero with a clear error message listing expected vs actual structure (headers count, column names, legend format)
5. Running the full pipeline (`fetch` + `build`) on the reference `meters.xlsx` fixture produces deterministic, identical output across runs

**Plans**: 2 plans

Plans:
- [ ] 01-01-PLAN.md -- Foundation + fetch subcommand (wave 1)
- [ ] 01-02-PLAN.md -- Build subcommand with parse, color, and data.json emission (wave 2)

### Phase 2: Frontend Table + Polish
**Goal**: Users can browse, sort, and filter across all 940+ multimeter specs in a fast, zero-dependency HTML table with no build step

**Depends on**: Phase 1

**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07, UI-08, UI-09, UI-10, UI-11, POL-01, POL-02, POL-03

**Success Criteria** (what must be TRUE):
1. Page loads and renders all 940+ rows and 51 columns from `data.json` as an HTML table with color-coded cell backgrounds (score band gradients + categorical marker colors) and a legend above the table explaining both
2. Clicking any column header toggles sort direction (asc --> desc --> unsorted), and clicking a different column resorts by that column
3. Free-text search across all columns and numeric range (min/max) inputs on key spec columns filter rows in real time, displaying "N of M results" -- band facet checkboxes (V High / High / Average / Low / V Low) and flag facet checkboxes (x / O / ?) combine with text search for compound filtering
4. Table has a sticky header on vertical scroll, rows highlight on hover, and an empty state message appears when filters match zero results
5. Table is mobile-responsive with a horizontal scroll wrapper, and the footer shows the edition date + last refreshed timestamp from `data.json`

**Plans**: TBD
**UI hint**: yes

### Phase 3: CI/CD & Deployment
**Goal**: The site auto-refreshes weekly with up-to-date data from Google Sheets, deployed to GitHub Pages without committing data.json to git

**Depends on**: Phase 1, Phase 2

**Requirements**: CI-01, CI-02, CI-03, CI-04

**Success Criteria** (what must be TRUE):
1. GitHub Actions workflow runs on schedule (weekly Monday 06:00 UTC) and can be triggered manually via `workflow_dispatch`
2. Workflow executes checkout --> setup-go --> fetch --> build --> deploy end-to-end, producing a working GitHub Pages site with current data
3. Deployment uses artifact-based upload (`upload-pages-artifact` + `deploy-pages`) with explicit concurrency control and `cancel-in-progress: false` to prevent race conditions
4. `.nojekyll` file exists in the deployment root, ensuring Pages serves the static site correctly (no Jekyll processing)
5. If `meters build` exits non-zero (sheet structure changed), the workflow fails loudly with a clear error -- stale data is never deployed

**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 --> 2 --> 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. CLI Pipeline | 0/2 | Planning | - |
| 2. Frontend Table + Polish | 0/0 | Not started | - |
| 3. CI/CD & Deployment | 0/0 | Not started | - |
