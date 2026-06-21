---
phase: 02
slug: frontend-table-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-21
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual browser verification + DevTools inspection |
| **Config file** | None — zero-dep vanilla JS frontend, no test framework |
| **Quick run command** | `python3 -m http.server 8080` then open browser |
| **Full suite command** | Manual: walk through all 14 acceptance criteria in browser |
| **Estimated runtime** | ~120 seconds (manual visual inspection) |

---

## Sampling Rate

- **After every task commit:** Open in browser, verify table renders and affected feature works
- **After every plan wave:** Walk through all acceptance criteria for wave's requirements
- **Before `/gsd:verify-work`:** Full manual checklist pass must be green
- **Max feedback latency:** 30 seconds (browser refresh)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | UI-01 | N/A | N/A | visual | `open site/index.html` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | UI-02 | N/A | N/A | visual | `open site/index.html` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | UI-03 | N/A | N/A | manual | `open site/index.html` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | UI-04 | N/A | N/A | manual | `open site/index.html` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | UI-05 | N/A | N/A | manual | `open site/index.html` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | UI-06 | N/A | N/A | manual | `open site/index.html` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | UI-07 | N/A | N/A | visual | `open site/index.html` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | UI-08 | N/A | N/A | visual | `open site/index.html` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | UI-09 | N/A | N/A | visual | `open site/index.html` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | UI-10 | N/A | N/A | manual | `open site/index.html` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | UI-11 | N/A | N/A | visual | `open site/index.html` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | POL-01 | N/A | N/A | visual | `open site/index.html` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | POL-02 | N/A | N/A | visual | `open site/index.html` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | POL-03 | N/A | N/A | code_review | grep for appendChild | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `site/index.html` — basic HTML scaffold with table container, sidebar, legend, footer
- [ ] `site/app.js` — JavaScript module for data loading, rendering, sort, filter, search
- [ ] `site/style.css` — stylesheet for table, sidebar, responsive layout, color bands

*Existing infrastructure covers all phase requirements once created.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Table renders 940+ rows | UI-01 | Visual inspection of DOM completeness | Count rows in browser DevTools, verify all columns present |
| Sort direction indicator | UI-02 | CSS arrow rendering | Click column header, verify ▲/▼ arrow appears/disappears |
| Search result count | UI-03 | Dynamic text update | Type search term, verify "N of M results" text updates |
| Band facet filtering | UI-04 | Visual confirmation of filtered set | Toggle band checkbox, verify row count decreases correctly |
| Flag facet filtering | UI-05 | Visual confirmation of filtered set | Toggle flag checkbox, verify matching rows remain |
| Numeric range filtering | UI-06 | Input value validation | Enter Price min/max, verify rows in range |
| Color-coded cells | UI-07 | Visual color accuracy | Compare cell colors against legend swatches |
| Legend display | UI-08 | Visual completeness | Verify all 5 score bands + 4 categorical markers shown |
| Sticky header | UI-09 | Scroll behavior | Scroll table vertically, verify header stays visible |
| Empty state | UI-10 | Conditional UI state | Apply contradictory filters, verify empty state message |
| Footer timestamps | UI-11 | Dynamic data display | Verify edition_date and fetched_at render correctly |
| Mobile responsive | POL-01 | Viewport behavior | Resize to <768px, verify horizontal scroll + sidebar drawer |
| Row hover highlight | POL-02 | CSS transition | Hover over row, verify background color changes |
| Batch DOM insertion | POL-03 | Code review | grep source for `appendChild` — should be 0 in table render path |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
