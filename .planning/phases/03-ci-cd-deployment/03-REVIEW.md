---
phase: 03-ci-cd-deployment
reviewed: 2026-06-23T12:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - .github/workflows/refresh.yml
  - PROJECT.md
findings:
  critical: 2
  warning: 2
  info: 2
  total: 6
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-06-23T12:00:00Z
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Reviewed the CI/CD workflow (`.github/workflows/refresh.yml`) and project specification (`PROJECT.md`). The workflow has two critical issues that would cause every run to fail because it references frontend files (`index.html`, `site/`) that do not exist in the repository. The PROJECT.md spec contains minor documentation inconsistencies.

## Critical Issues

### CR-01: Artifact prep copies nonexistent `index.html` from repo root

**File:** `.github/workflows/refresh.yml:47`
**Issue:** Line 47 runs `cp index.html data.json _site/`, but `index.html` does not exist at the repository root. The project architecture (documented in both CLAUDE.md and PROJECT.md) places `index.html` inside `site/`. This command will fail with an error (`cp: index.html: No such file or directory`), causing the `build` job to exit non-zero. This cascades to the `deploy` job which is skipped due to `needs: build`, so the workflow never completes a deployment.

**Fix:** Copy `index.html` from its actual location. The correct approach is to copy all contents of `site/` (including `index.html`) into `_site/`:

```yaml
- name: Prepare deploy artifact
  run: |
    mkdir -p _site
    cp -r site/* data.json _site/
    touch _site/.nojekyll
```

This assumes `site/` contains `index.html`, `app.js`, and `style.css` as documented in the project architecture.

---

### CR-02: Artifact prep copies nonexistent `site/` directory, creating wrong structure

**File:** `.github/workflows/refresh.yml:48`
**Issue:** Line 48 runs `cp -r site _site/`, but the `site/` directory does not exist anywhere in the repository. This command will fail with `cp: site: No such file or directory`. Furthermore, even if `site/` existed, `cp -r site _site/` copies the `site/` directory *into* `_site/`, producing `_site/site/app.js` rather than `_site/app.js`. The HTML file (when it exists) would reference assets at root level (e.g., `<script src="app.js">`), resulting in 404s for all static assets.

**Fix:** Use the glob form to flatten the directory contents:

```yaml
- name: Prepare deploy artifact
  run: |
    mkdir -p _site
    cp -r site/* data.json _site/
    touch _site/.nojekyll
```

Note: This fix depends on the `site/` directory and its contents being created first (presumably by phase 02 frontend work).

## Warnings

### WR-01: `git push` without explicit refspec could race with concurrent runs

**File:** `.github/workflows/refresh.yml:41`
**Issue:** The `git push` on line 41 pushes to the default remote/branch without an explicit refspec or `--force-with-lease`. Because `concurrency.cancel-in-progress: false` allows overlapping runs, if a previous run commits `data.json` between this run's checkout and push, the push will fail with a non-fast-forward rejection. The conditional commit guard (`git diff --quiet data.json`) prevents no-op commits but does not prevent push conflicts from overlapping runs.

**Fix:** Push to an explicit branch with `--force-with-lease` to safely handle overlapping runs:

```yaml
git push --force-with-lease origin HEAD:main
```

Alternatively, consider changing `cancel-in-progress: false` to `true` so that overlapping runs cancel the earlier one:

```yaml
concurrency:
  group: refresh-data
  cancel-in-progress: true
```

---

### WR-02: PROJECT.md references nonexistent `engine.js`

**File:** `PROJECT.md:135`
**Issue:** The deploy artifact description lists `site/* (app.js, engine.js, style.css)`, but the project architecture diagram (lines 71-73) only shows `app.js`. The file `engine.js` is referenced nowhere else in the documentation and does not exist in the repository. This is a documentation inconsistency that will cause confusion during development and maintenance.

**Fix:** Remove `engine.js` from the description if it does not exist, or add it to the architecture diagram if it is intended to be created:

```markdown
3. Deploy artifact contains: `index.html`, `data.json`, `site/*` (app.js, style.css), `.nojekyll`
```

## Info

### IN-01: Generic concurrency group name could collide

**File:** `.github/workflows/refresh.yml:14`
**Issue:** The concurrency group is named `pages`, which is generic and could collide with other workflows in the same repository that also use `pages` as their concurrency group. This could cause unrelated workflow runs to cancel each other or block unexpectedly.

**Fix:** Use a more specific group name:

```yaml
concurrency:
  group: refresh-data
  cancel-in-progress: false
```

---

### IN-02: Symbol `x` used for two different categorical markers

**File:** `PROJECT.md:34-37`
**Issue:** The symbol `x` appears twice in the categorical markers table with different meanings ("Missing feature" at `DDD9C3` and "Important missing feature" at `7F7F7F`). While the implementation correctly distinguishes them by RGB color (not by symbol), the duplicated symbol in the documentation is potentially confusing for anyone reading the spec or debugging the color-matching logic.

**Fix:** Add a note clarifying that the marker symbol alone is ambiguous and that color matching (not symbol matching) is the correct approach:

```markdown
> **Note:** The symbol `x` is used for two distinct categories. The
> implementation must distinguish them by exact RGB color match, not by symbol.
```

---

_Reviewed: 2026-06-23T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
