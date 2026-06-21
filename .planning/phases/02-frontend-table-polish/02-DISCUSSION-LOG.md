# Phase 02: frontend-table-polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-21
**Phase:** 02-frontend-table-polish
**Areas discussed:** Filter widget placement, Table layout & column density, Search scope & trigger, Visual design direction

---

## Filter widget placement

| Option | Description | Selected |
|--------|-------------|----------|
| Per-column dropdown panels | Each header has a ▼ icon. Click opens dropdown beneath header with checkboxes/range inputs | |
| Sidebar filter panel | All filters live in a left sidebar (collapsible). Table takes remaining space | ✓ |
| Filter bar above table | Compact horizontal strip of filter inputs above the table | |

**User's choice:** Sidebar filter panel

---

| Option | Description | Selected |
|--------|-------------|----------|
| Grouped by filter type | Sidebar sections: Numeric Filters, Band Filters, Flag Filters | ✓ |
| Flat list by column | Every column that has filterable data gets a sidebar entry | |
| Hybrid — type sections with column subsections | Three expandable sections, each with expandable column subsections | |

**User's choice:** Grouped by filter type

---

| Option | Description | Selected |
|--------|-------------|----------|
| Sidebar collapsible, filters expanded | Sidebar toggle on/off. All sections and controls always visible when sidebar open | ✓ |
| Sections collapsible, sidebar always visible | Sidebar never hides. Each section has expand/collapse toggle | |
| Both sidebar and sections collapsible | Sidebar toggles on/off plus per-section collapse | |

**User's choice:** Sidebar collapsible, filters expanded

---

| Option | Description | Selected |
|--------|-------------|----------|
| Overlay drawer | Sidebar becomes full-height overlay drawer on mobile, slides in from left | ✓ |
| Collapse to top bar | Filters become horizontal scrollable chip/tag bar above table on mobile | |
| Bottom sheet only | Filter button opens bottom sheet on all screen sizes | |

**User's choice:** Overlay drawer

---

## Table layout & column density

| Option | Description | Selected |
|--------|-------------|----------|
| Horizontal scroll, all columns visible | Table overflows horizontally with scrollbar | |
| Column visibility toggles | Curated default set (~15 cols), users toggle additional columns on/off | |
| Both — toggle + scroll | Column visibility toggle menu + horizontal scroll for overflow | ✓ |

**User's choice:** Both — column visibility toggles + horizontal scroll

---

| Option | Description | Selected |
|--------|-------------|----------|
| Sticky Model column only | First column fixed during horizontal scroll | |
| Sticky Model + Brand (first 2 columns) | First two columns fixed during horizontal scroll | ✓ |
| No sticky columns | Everything scrolls together | |

**User's choice:** Sticky Model + Brand

---

| Option | Description | Selected |
|--------|-------------|----------|
| Curated essential set | Hand-pick ~12-15 columns that matter most to shoppers | |
| First N columns from data.json | Take first 15 columns from column order | |
| All visible by default | Start with all 51 columns visible, users hide what they don't want | ✓ |

**User's choice:** All visible by default

---

| Option | Description | Selected |
|--------|-------------|----------|
| Compact (spreadsheet-like) | Narrow rows, small font, maximize visible rows | |
| Comfortable (modern table) | Moderate padding, 15-16px font, ~20-25 rows visible | |
| User-toggleable density | Density toggle (Compact / Comfortable / Spacious), localStorage persistence | ✓ |

**User's choice:** User-toggleable density

---

## Search scope & trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Search all columns | Single search box matches against every cell value | ✓ |
| Search all columns + column selector | Search box with optional dropdown to scope to a specific column | |
| Search Model + Brand only | Search only Model and Brand columns | |

**User's choice:** Search all columns

---

| Option | Description | Selected |
|--------|-------------|----------|
| Debounced live filtering | Filter as user types with ~250ms debounce | ✓ |
| Explicit submit (Enter or button) | User presses Enter or clicks search button to trigger filter | |
| Hybrid — debounced with minimum char threshold | Live filter after 3+ characters typed, below 3 chars wait for Enter | |

**User's choice:** Debounced live filtering

---

| Option | Description | Selected |
|--------|-------------|----------|
| AND logic — search narrows filtered results | Search and sidebar filters combine, narrowing results | ✓ |
| OR logic — search expands, filters narrow | Search matches independently from sidebar filters | |
| Search is independent, clears filters | Typing in search auto-clears all sidebar filters | |

**User's choice:** AND logic

---

| Option | Description | Selected |
|--------|-------------|----------|
| Highlight matching text in cells | Matching substring gets yellow marker-style background highlight | ✓ |
| Row-level highlight only | Matching rows get subtle background emphasis | |
| No highlighting | Just filter and show results count, no visual markup | |

**User's choice:** Highlight matching text in cells

---

## Visual design direction

| Option | Description | Selected |
|--------|-------------|----------|
| Data-dense industrial | Dark header, monochrome body, band color accents, minimal chrome | ✓ |
| Clean modern minimal | White background, subtle shadows, rounded corners, soft cell tints | |
| You decide | Claude picks aesthetic direction | |

**User's choice:** Data-dense industrial

---

| Option | Description | Selected |
|--------|-------------|----------|
| Full cell background fill | Cell background uses exact band color, text color adjusts for contrast | ✓ |
| Left-border accent + subtle cell tint | Colored left border (4px) + faint background tint (~10% opacity) | |
| Text color + badge/dot indicator | Colored dot next to value, or colored text, no cell fill | |

**User's choice:** Full cell background fill

---

| Option | Description | Selected |
|--------|-------------|----------|
| Above table, horizontal bar | Horizontal legend bar between page header and table | ✓ |
| Collapsible above table | Legend shown by default with collapse toggle | |
| Footer only | Legend lives in page footer alongside timestamps | |

**User's choice:** Above table, horizontal bar

---

| Option | Description | Selected |
|--------|-------------|----------|
| System font stack, light theme | Native system fonts, light background (#fff/#f8f9fa), dark text | ✓ |
| Monospace data cells, sans-serif headers | Monospace for aligned number reading, sans-serif for headers | |
| You decide | Claude picks typography and color scheme | |

**User's choice:** System font stack, light theme

---

### Extra design questions

| Question | Answer |
|----------|--------|
| Empty state when filters match zero results? | Centered message with reset button |
| Loading state while data.json is fetched? | Minimal CSS-only spinner |
| Sort column visual indicator? | Arrow indicators (▲/▼) |
| Sticky header scroll indicator? | Drop shadow on scroll |

---

## Claude's Discretion

Areas where implementation details are left to Claude/researcher/planner:
- Exact debounce timing (200-300ms range)
- Column visibility menu design
- Density toggle UI placement and styling
- Sort stability behavior
- Case sensitivity in search
- Exact hex values for band score colors
- Scrollbar styling
- Footer layout
- Responsive breakpoints beyond mobile (<768px)
- Filter active-state indicators
- "Clear all filters" button placement

## Deferred Ideas

None — discussion stayed within Phase 2 scope.
