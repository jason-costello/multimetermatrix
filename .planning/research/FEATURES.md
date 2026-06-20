# Feature Research

**Domain:** Static spec-comparison / data-browser for handheld multimeters (940+ models, 51 spec columns)
**Researched:** 2026-06-20
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete for any spec-browser tool.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Sortable columns (click header, toggle asc/desc) | Every data table supports this. Users will click headers instinctively on first use. | LOW | Three-way cycle preferred: asc / desc / none (reset to original order). Arrow indicator via CSS `::after` on `<th>`. |
| Free-text search across all columns | GSMArena, Newegg, B&H Photo all have a "search within results" box. Users need to type "60000 count" or "Fluke" to narrow down. | LOW | Simple inline filter: `row.cells.some(cell => cell.textContent.includes(query))`. No index needed at 940 rows. |
| Filter by brand / model (text match) | Most spec browsers have brand dropdown or type-ahead. Users know which brands they trust. | LOW | Text input + substring match on Brand + Model columns. Easy to implement alongside free-text search. |
| Responsive horizontal scroll on mobile | 51 columns cannot fit on any phone screen. Users expect they can swipe horizontally through all columns. | LOW | `overflow-x: auto` wrapper with `-webkit-overflow-scrolling: touch`. This is the baseline — users understand horizontal scroll on data tables. |
| Column headers persist (sticky header) | Long tables lose context without visible headers. Users get lost after scrolling past row 20. | LOW | `position: sticky; top: 0` on `<thead>`. Polyfill-free in modern browsers. |
| Legend / key for color-coded cells | Color bands (V High..V Low) and categorical markers (x, O, ?) have no meaning without a legend. Users cannot interpret the table without it. | LOW | Extract from `data.json` `metadata.legend`, render as a small key panel above or below the table. |
| Count of visible / total results | "42 of 940 meters shown" gives users feedback on filter effectiveness. | LOW | Compute `filteredRows.length` vs `totalRows.length`, update in a status bar. |
| No layout shift during filtering | Filtering that causes visible jank or table reflow degrades trust. | LOW | Use `visibility: hidden` on hidden rows or detach/re-attach `<tbody>` to batch DOM writes. |
| Loading / empty / zero-results states | Empty state when no meters match. Users need to know the filter is working, not broken. | LOW | Show "No meters match your filters. Try fewer filters." message + reset link. |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required for a basic table, but valuable for a spec-browser tool.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Per-column band faceting (checkbox lists for V High..V Low) | Unique to this dataset. No other multimeter browser lets you filter by score band per spec. GSMArena doesn't offer this level of granularity. | MEDIUM | Each numeric/gradient column has 5 bands. Render a collapsible checkbox group per column. OR-within-band, AND-across-columns logic. |
| Categorical flag faceting (checkbox lists for x, O, ?) | Users can filter "show only meters where True RMS is not missing" or "where PC connectivity is optional." | MEDIUM | Same facet UI as bands, but for flag columns. Show category label + count per option. |
| Per-column range filter (numeric min/max) | GSMArena lets you filter "resolution > X" — users expect to set numeric thresholds on spec columns. | MEDIUM | Two `<input type="number">` per numeric column (min, max). Debounce input. Apply alongside other facets. |
| URL-encoded filter state (shareable links / deep linking) | Users can bookmark a specific filter combination, share a comparison link. Common in advanced tools (Algolia, GSMArena lacks this). | MEDIUM | Serialize active filters + sort column + direction to URL query params. `history.replaceState()` on filter change. `URLSearchParams` to restore on load. `popstate` handler for back/forward. |
| Color-coded cell rendering from band data | The score-band colors are the primary visual language of the source spreadsheet. Rendering them in the table makes patterns jump out — "many green cells = strong meter." | LOW | Set `style.background-color` on `<td>` from `row.bands[col]` or `row.flags[col]` data. Ensure text contrast for accessibility. |
| Row + column cross-highlight on hover | With 51 columns, users lose their place. Hovering a cell highlights both the entire row AND column (via CSS `:has()` or pseudo-element trick). | LOW | CSS-only solution: `td:hover::after` for column, `tr:hover` for row. No JS needed. This is a power-user feature for dense tables. |
| Column visibility toggle (pick which of 51 columns to show) | No user needs all 51 columns at once. Letting users choose which specs to show reduces cognitive load dramatically. | MEDIUM | Popover or sidebar with checkbox list of column names. Persist choice to `localStorage` so it survives page reloads. |
| "Differences only" toggle for selected products | Baymard research shows this tests best for comparison UX. Hide rows where all selected meters have the same value. | HIGH | Requires compare mode (select N products). Compare each row's values across selected products, hide identical rows. |
| Footer: edition date + last refreshed timestamp | Establishes data freshness credibility. Users trust stale data less. | LOW | Render `data_json.metadata.edition_date` and `data_json.metadata.fetched_at` in a subtle footer bar. |
| Weekly auto-refresh via CI/CD | Data stays current without manual effort. Users always see latest specs from the source sheet. | LOW | GitHub Actions scheduled + `workflow_dispatch`. Commit `data.json` if changed. Already in scope. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems for this project's constraints.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Backend search API (Lunr.js, algolia, Meilisearch) | "Search should be faster" | Static site constraint. At 940 rows x 51 cols (~48k cells), plain JS filter completes in <5ms. No backend needed. | Vanilla JS `Array.filter()` + `String.includes()` — instant at this scale. |
| Server-side rendering / build-time page generation | "SEO for each meter page" | Product pages for each meter require a separate HTML file per meter. Adds significant build complexity for questionable value since the data is already browsable. | Single-page table with deep-linkable filter state (URL params). Users find what they need via filters, not search engine landing pages. |
| User accounts / saved comparisons | "Let users save their favorite meters" | Requires backend, auth, database. Out of scope. | URL sharing of filter state achieves the same goal (send someone a link to your filtered view). |
| Image / photo gallery per meter | "Show pictures of each meter" | Source data has no images. Would require a separate data pipeline to scrape/crawl images. Massively increases scope. | No images needed — this is a spec comparison tool, not a shopping catalog. |
| Export to CSV / PDF | "I want to take this data offline" | Adds significant UI surface area (export button, format selector, download handler). Low usage for a tool that refreshes weekly. | Users can copy-paste from the table, or use browser print-to-PDF. If requested later, "Copy as CSV" is a smaller feature. |
| Virtual scrolling / windowing library | "940 rows is a lot" | The entire dataset is ~48k DOM cells. Modern browsers render this without issue. Virtualization adds complexity (dynamic row heights, scroll sync with sticky headers). | Plain DOM rendering. If performance issues emerge (unlikely), add incremental rendering: render first 100 rows, rest on `requestIdleCallback`. |
| AI-powered recommendations | "Which meter should I buy?" | Requires ML model, training data, or LLM API calls. Overkill for a spec browser. | Users can filter by band scores (V High on all specs) to find top-rated meters themselves. |
| Price alert / price history graph | "Track price changes" | No backend for persistent jobs. Source data only has current price, not history. | Display current Price column. Let users sort by price to find best value. |
| Drag-to-compare (drag-and-drop meters into compare view) | "Faster than checkboxes" | Drag-and-drop on mobile is unreliable. Adds unnecessary complexity over checkbox selection. | Simple checkbox per row ("Add to compare") with persistent compare bar at bottom. |
| Real-time collaborative filtering | "Compare with a friend" | Requires WebSocket/server infrastructure. Completely out of scope. | Share a URL with your current filter state. |

## Feature Dependencies

```
data.json (parsed + committed)
    └──required──> Table Rendering (render 940 rows x 51 cols)
                       ├──required──> Column Sorting (click header toggle)
                       │                  └──required──> Sort Direction Indicator (arrows on th)
                       │
                       ├──required──> Free-Text Search (global text filter)
                       │
                       ├──required──> Facet Filter Panel
                       │                  ├──required──> Band Checkbox Controls (per gradient column)
                       │                  ├──required──> Flag Checkbox Controls (per categorical column)
                       │                  ├──required──> Numeric Range Inputs (per numeric column)
                       │                  └──required──> Combined Filter Logic (AND across facets, OR within)
                       │
                       ├──enhances──> Color-Coded Cells (from bands + flags data)
                       │                  ├──enhances──> Legend Display (color key above table)
                       │                  └──enhances──> Row/Column Hover Cross-Highlight
                       │
                       ├──enhances──> URL State Serialization
                       │                  ├──requires──> Filter + Sort + Pagination State Extraction
                       │                  └──requires──> `history.replaceState` on change + `popstate` listener
                       │
                       ├──enhances──> Column Visibility Toggle
                       │                  └──enhances──> `localStorage` persistence of visibility prefs
                       │
                       └──requires──> Results Count (visible / total)

                         ──future──> Compare Mode (checkbox per row, compare bar)
                         ──future──> "Differences Only" Toggle
                         ──future──> Column Reorder (drag headers)
```

### Dependency Notes

- **All features require `data.json`:** Without parsed data, nothing renders. This is the single binary artifact the Go CLI produces.
- **Column Sorting requires Table Rendering:** You cannot sort columns until rows are in the DOM. Sort manipulates `<tbody>` child order.
- **Facet Filters require Table Rendering + Sorting:** Filters operate on the parsed `rows` array, not the DOM. They produce a filtered array that then re-renders the table body.
- **Combined Filter Logic is the hardest part:** Multiple facet types (band checkboxes, flag checkboxes, numeric ranges, free-text) must combine correctly. AND across different columns, OR within a single column's checkboxes.
- **URL State Serialization depends on Filter + Sort:** It serializes the current filter/sort state. Must be added AFTER filters and sort are working, but before public launch (history matters from day 1).
- **Compare Mode depends on row-level data access:** Each row needs a checkbox. The compare bar needs to track selected model indices. Adds a new view mode (side-by-side) on top of the filtered table.

## MVP Definition

### Launch With (v1)

Minimum viable product -- what's needed to validate the concept.

- [x] Table rendering of all 940 rows x 51 columns from `data.json` (core existence proof)
- [x] Column header click sort with asc/desc toggle (users expect this from first interaction)
- [x] Free-text search box filtering across all columns (the quick way to find a model)
- [x] Band-based facet checkboxes for gradient score columns (the unique value prop)
- [x] Flag-based facet checkboxes for categorical markers (x, O, ? per column)
- [x] Numeric range filter (min/max) on key numeric spec columns (Price, Count, BW, etc.)
- [x] Legend display showing color key for bands + flag markers
- [x] Sticky table header so column names stay visible while scrolling
- [x] Results count indicator (visible / total meters)
- [x] Footer with edition date + last refreshed timestamp
- [x] Mobile responsive horizontal scroll wrapper
- [x] Row hover highlight for readability
- [x] Zero-results empty state with reset link
- [x] Fast initial load (no network requests beyond `data.json`)

### Add After Validation (v1.x)

Features to add once core filtering is working and the project is deployed.

- [ ] URL-encoded filter/sort state (deep linking, shareable URLs, browser back/forward support)
- [ ] Column visibility toggle (pick which of 51 columns to show; persist to localStorage)
- [ ] Row + column cross-highlight on hover (CSS `:has()` or pseudo-element trick)
- [ ] "Sticky" first column (Model name always visible during horizontal scroll)
- [ ] Per-column sort reset (third click = unsorted, return to original order)

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Compare mode (checkbox per row, persistent bar, side-by-side table view)
- [ ] "Show differences only" toggle in compare mode
- [ ] Column reorder (drag-and-drop column headers)
- [ ] Column resize (drag column borders to adjust width)
- [ ] Dark mode toggle
- [ ] Keyboard navigation (arrow keys between cells, Enter to sort)
- [ ] Print-optimized stylesheet (for printing comparison results)
- [ ] CSV clipboard copy ("Copy visible table as CSV")

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Table rendering | CRITICAL | LOW | P1 |
| Column sort toggle | HIGH | LOW | P1 |
| Free-text search all columns | HIGH | LOW | P1 |
| Band facet checkboxes | HIGH | MEDIUM | P1 |
| Flag facet checkboxes | MEDIUM | MEDIUM | P1 |
| Numeric range filter | HIGH | MEDIUM | P1 |
| Legend display | HIGH | LOW | P1 |
| Sticky column headers | MEDIUM | LOW | P1 |
| Results count | MEDIUM | LOW | P1 |
| Footer (dates) | LOW | LOW | P1 |
| Mobile horizontal scroll | HIGH | LOW | P1 |
| Row hover highlight | MEDIUM | LOW | P1 |
| Empty / zero-results state | HIGH | LOW | P1 |
| Color-coded cell rendering | MEDIUM | LOW | P1 |
| URL state serialization | HIGH | MEDIUM | P2 |
| Column visibility toggle | HIGH | MEDIUM | P2 |
| Row + column cross-highlight | MEDIUM | LOW | P2 |
| Sticky first column | MEDIUM | LOW | P2 |
| Compare mode | HIGH | HIGH | P3 |
| "Differences only" toggle | MEDIUM | HIGH | P3 |
| Column reorder (drag) | LOW | HIGH | P3 |
| Dark mode | LOW | MEDIUM | P3 |
| Keyboard navigation | MEDIUM | MEDIUM | P3 |
| Print stylesheet | LOW | LOW | P3 |
| CSV clipboard copy | LOW | LOW | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible (after initial validation)
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | GSMArena Phone Finder | Newegg Spec Compare | SPEC CHECK Equipment | Our Approach |
|---------|----------------------|---------------------|---------------------|--------------|
| **Faceted filters by spec** | Brand, OS, RAM, Camera, Price dropdowns | Category, Brand, Price range, rating | Category filters + keyword search | Per-column band checkboxes + numeric range + flag checkboxes |
| **Free-text search** | Yes (keyword search) | Yes (search bar) | Yes | Global text search filtering all 51 columns |
| **Column sort** | By popularity, price, weight, camera, battery | By price, rating, name | By spec field values | Click any column header to toggle asc/desc |
| **Side-by-side compare** | Up to 3 phones, dedicated compare page | Up to 4 products, checkbox + compare page | Compare engine with spec sheets | Future: checkbox + inline comparison table |
| **Band/score filtering** | No (binary spec presence only) | No (binary has/has not) | No | Per-column V High..V Low checkbox facets (unique) |
| **Color-coded cells** | No (plain text table) | No | No | Background color from band data + flag markers |
| **URL filter state** | No (filters reset on navigation) | No (session only) | No | URL query params for deep linking (P2 -- unique) |
| **Column visibility control** | No | No | No | Column toggle + localStorage persistence (P2 -- unique) |
| **Mobile experience** | Responsive site, separate app | Responsive site | Native mobile apps | Horizontal scroll wrapper + sticky header |
| **Data freshness** | Crowd-sourced, manual updates | Product listings from sellers | Daily updates (paid service) | Weekly auto-refresh via CI/CD |
| **Price integration** | Not a shopping site | Real prices + stock | B2B, no consumer pricing | Price column from sheet -- no shopping cart |
| **Export** | No | Print page | Excel export | Future: "Copy visible as CSV" (P3) |

### Key Differentiators vs Competitors

1. **Per-column band faceting** -- No competitor offers score-band filtering on individual specs. This is the single strongest differentiator and maps directly to the unique data format (Google Sheets conditional formatting colors).
2. **Color-coded cell rendering** -- Competitors show plain text tables. Color encoding makes spec strengths/weaknesses visually scannable at a glance.
3. **URL shareable filter state** -- A static site that supports deep linking is unusual and valuable.
4. **Column visibility control** -- At 51 columns, this becomes table-stakes for the domain. Competitors don't offer this at all.
5. **Zero-dependency / instant load** -- Competitors are JS-heavy e-commerce sites. A pure HTML/CSS/JS page that loads in one network request is a speed differentiator.

## Mobile UX Considerations

Based on Baymard Institute research (2025-2026 benchmarks):

- **78% of mobile e-commerce sites** offer a poor-to-mediocre filtering experience. Doing this well is a competitive advantage.
- **61% of users abandon** if they can't find what they need within 5 seconds. Filters must feel instant.
- **Comparison features are far less used on mobile** (only 3 of 38 test participants used compare on mobile across Walgreens and B&H Photo). Invest in fast filtering + sort on mobile, defer compare mode.

### Mobile Feature Strategy

| Screen Size | Approach |
|-------------|----------|
| >1024px (desktop) | Full table with sidebar or inline facet panel. All 51 columns visible with horizontal scroll if needed. Compare mode useful here. |
| 768-1024px (tablet) | Full table, facet panel as collapsible sidebar or overlay. Horizontal scroll for wide columns. |
| <768px (phone) | Horizontal scroll table with sticky first column. Facet panel as full-screen overlay modal. Compare mode likely unused -- defer. |

- **Filter panel on mobile:** Full-screen overlay that opens on tap (like iOS Settings search). Shows facet groups as collapsible sections. "Apply" button closes overlay and updates results.
- **Sort on mobile:** Dropdown selector ("Sort by: Model, Price, Count...") rather than column header taps (too error-prone on small screens).

## Key UX Research Sources

1. **Baymard Institute** -- Product Comparison UX: "Always Provide Comparison Features for Spec-Driven Industries" (2025). Found 67% of test participants used comparison features, yet 17% of spec-driven sites don't offer them.
2. **Baymard** -- "4 Ways to Optimize the Comparison Feature for Scanning": Remove identical attributes toggle, group specs by category, persist column headings, use horizontal styling for rows.
3. **WarpDriven** -- "Facet Filter UX: Best Practices" (2025): 8 common friction patterns including ambiguous labels, missing product counts, zero-results dead ends, mobile discoverability.
4. **GSMArena** -- Industry-leading spec browser with side-by-side compare (3 devices). Faceted phone finder with brand, price, camera, battery filters. Lacks per-spec score bands and URL state.
5. **SPEC CHECK** -- B2B equipment comparison platform with daily data updates, API integration, and mobile apps. Enterprise-grade but similar spec-comparison domain.

## Sources

- UXPin -- Advanced Search UX Best Practices (2026): https://www.uxpin.com/studio/blog/advanced-search-ux/
- Baymard -- Product Comparison UX Research: https://baymard.com/blog/provide-comparison-features
- Baymard -- Optimize Comparison Feature for Scanning: https://baymard.com/blog/user-friendly-comparison-tools
- WarpDriven -- Facet Filter UX Playbook: https://warpdriven.ai/en/blog/industry-1/facet-filter-ux-best-practices-conversion-wins-91
- Doofinder -- Faceted Search Guide: https://www.doofinder.com/en/blog/faceted-search
- WISEPIM -- Fixing E-Commerce Filters (2026): https://wisepim.com/blog/ecommerce-product-filters-ux-best-practices
- GSMArena Phone Finder: https://www.gsmarena.com/finder.php3
- SPEC CHECK: https://www.speccheck.com/en/
- Speckyboy -- Responsive HTML Table Techniques: https://speckyboy.com/responsive-html-table-techniques/
- Elastic UI Framework Table Layout Guidelines: https://eui.elastic.co/v116.2.0/docs/components/tables/layout-guidelines/
- CSS Column Hover with :has(): https://codepen.io/netsi1964/details/dyaPrPK
- DevToolsDaily -- Save State in URL (static sites): https://www.devtoolsdaily.com/advent/16-dec-save-state-in-url/
- itemsjs -- Client-side faceted search (pattern inspo): https://github.com/itemsapi/itemsjs
- staticsearch -- Static site search pattern reference: https://github.com/craigbuckler/staticsearch
- table-sort-js -- Vanilla JS table sorting: https://github.com/kyle-wannacott/table-sort-js

---
*Feature research for: Handheld Meters Browser (spec comparison tool)*
*Researched: 2026-06-20*
