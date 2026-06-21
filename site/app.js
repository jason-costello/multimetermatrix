// Application controller -- fetches data.json, manages state, wires UI interactions
// ES module that imports pure functions from engine.js

import {
  escapeHtml, highlightMatch, parseNumericValue, getCellColors,
  filterRows, sortRows, searchRows,
  getBandColumns, getFlagColumns, getNumericColumns
} from './engine.js';

// ---------------------------------------------------------------------------
// Legend color maps (parity with internal engine constants)
// ---------------------------------------------------------------------------

const LEGEND_BAND_COLORS = {
  'V High': { bg: '#1b7a3d', text: '#ffffff' },
  'High': { bg: '#5ba86c', text: '#ffffff' },
  'Average': { bg: '#f5c842', text: '#1a1a2e' },
  'Low': { bg: '#e8833a', text: '#ffffff' },
  'V Low': { bg: '#c4403a', text: '#ffffff' },
};

const LEGEND_FLAG_COLORS = {
  'missing': { bg: '#b0b0b0', text: '#ffffff', label: 'x missing' },
  'important_missing': { bg: '#d45050', text: '#ffffff', label: 'x important' },
  'optional': { bg: '#5d9ed7', text: '#ffffff', label: 'O optional' },
  'no_info': { bg: '#939393', text: '#ffffff', label: '? no info' },
};

// ---------------------------------------------------------------------------
// Application state (immutable patterns: allRows read-only after init)
// ---------------------------------------------------------------------------

const state = {
  allRows: [],              // full row data from data.json (immutable after load)
  filteredRows: [],         // current filtered/sorted rows for rendering
  columns: [],              // column names array
  editionDate: '',          // from data.json
  fetchedAt: '',            // from data.json
  sortColumn: null,         // column key string or null
  sortDirection: 'none',    // 'asc' | 'desc' | 'none'
  searchQuery: '',          // current search text
  activeFilters: {          // filter state
    band: {},               // { columnKey: Set(['V High', 'High']) }
    flag: {},               // { columnKey: Set(['missing']) }
    numeric: {}             // { columnKey: { min: number|null, max: number|null } }
  },
  visibleColumns: null,     // Set of visible column keys (null = all visible)
  density: 'comfortable'    // 'compact' | 'comfortable' | 'spacious'
};

// ---------------------------------------------------------------------------
// DOM references (queried once at init)
// ---------------------------------------------------------------------------

const $ = (id) => document.getElementById(id);

const el = {
  searchInput: $('search-input'),
  resultsCount: $('results-count'),
  densityToggle: $('density-toggle'),
  colVisBtn: $('column-visibility-btn'),
  colVisMenu: $('column-visibility-menu'),
  colChecklist: $('column-checklist'),
  sidebarToggle: $('sidebar-toggle'),
  filterCountBadge: $('filter-count-badge'),
  sidebar: $('sidebar'),
  clearFilters: $('clear-filters'),
  sidebarClose: $('sidebar-close'),
  sidebarBackdrop: $('sidebar-backdrop'),
  numFilters: $('numeric-filters-container'),
  bandFilters: $('band-filters-container'),
  flagFilters: $('flag-filters-container'),
  legendBands: $('legend-bands'),
  legendMarkers: $('legend-markers'),
  tableWrapper: $('table-wrapper'),
  loadingState: $('loading-state'),
  errorState: $('error-state'),
  emptyState: $('empty-state'),
  tableHeader: $('header-row'),
  tableBody: $('table-body'),
  editionDate: $('edition-date'),
  fetchedAt: $('fetched-at')
};

// ===========================================================================
// Data Loading
// ===========================================================================

/**
 * Fetch data.json, parse it, initialize UI, and render the table.
 * Shows loading spinner during fetch, error state on failure.
 */
async function loadData() {
  // Show loading state
  el.loadingState.hidden = false;
  el.errorState.hidden = true;
  el.emptyState.hidden = true;
  el.tableBody.innerHTML = '';

  try {
    const response = await fetch('./data.json');
    if (!response.ok) {
      throw new Error('HTTP ' + response.status + ': ' + response.statusText);
    }
    const data = await response.json();

    // Guard against empty or malformed data
    if (!data || !Array.isArray(data.rows) || !Array.isArray(data.columns)) {
      throw new Error('Invalid data format');
    }

    state.allRows = data.rows;
    state.columns = data.columns;
    state.editionDate = data.edition_date || '';
    state.fetchedAt = data.fetched_at || '';
    state.visibleColumns = new Set(data.columns);

    el.loadingState.hidden = true;

    if (data.rows.length === 0) {
      el.emptyState.hidden = false;
      return;
    }

    initUI(data);
    applyAndRender();
  } catch (err) {
    el.loadingState.hidden = true;
    el.errorState.hidden = false;
    const errorMsg = el.errorState.querySelector('p');
    if (errorMsg) {
      errorMsg.textContent = 'The data file could not be loaded. (' + err.message + ')';
    }
  }
}

// ===========================================================================
// UI Initialization (legend, footer, density, header, layout)
// ===========================================================================

/**
 * Initialize static UI elements that don't change with filter/sort state.
 * Called once after data.json loads successfully.
 */
function initUI(data) {
  // -- Content area layout --
  // style.css expects a .content-area flex wrapper but index.html (Plan 2)
  // does not include it. Create it here so sidebar + table-wrapper lay out
  // correctly side by side.
  const contentArea = document.createElement('div');
  contentArea.className = 'content-area';
  const sidebar = document.getElementById('sidebar');
  const tableWrapper = document.getElementById('table-wrapper');
  if (sidebar && tableWrapper) {
    const legendBar = document.getElementById('legend-bar');
    sidebar.parentNode.insertBefore(contentArea, sidebar);
    contentArea.appendChild(sidebar);
    contentArea.appendChild(tableWrapper);
    // Move legend bar inside table-wrapper (before the table)
    if (legendBar) {
      tableWrapper.insertBefore(legendBar, tableWrapper.firstChild);
    }
  }

  // -- Legend --
  let bandHtml = '';
  for (const [label, c] of Object.entries(LEGEND_BAND_COLORS)) {
    bandHtml += '<span class="legend-swatch" style="background:' + c.bg + ';color:' + c.text + '">' + label + '</span>';
  }
  el.legendBands.innerHTML = bandHtml;

  let flagHtml = '';
  for (const [, c] of Object.entries(LEGEND_FLAG_COLORS)) {
    flagHtml += '<span class="legend-swatch" style="background:' + c.bg + ';color:' + c.text + '">' + c.label + '</span>';
  }
  el.legendMarkers.innerHTML = flagHtml;

  // -- Footer --
  el.editionDate.textContent = data.edition_date || '';
  if (data.fetched_at) {
    try {
      el.fetchedAt.textContent = new Date(data.fetched_at).toLocaleString();
    } catch (e) {
      el.fetchedAt.textContent = data.fetched_at;
    }
  }

  // -- Density from localStorage --
  state.density = localStorage.getItem('rowDensity') || 'comfortable';
  const table = document.getElementById('meters-table');
  if (table) {
    table.className = 'density-' + state.density;
    // Sync active button class with stored density
    el.densityToggle.querySelectorAll('.density-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.density === state.density);
    });
  }

  // -- Render header row --
  renderTableHeader();

  // -- Sticky brand column offset (after layout) --
  requestAnimationFrame(function () { updateStickyBrandOffset(); });
}

// ===========================================================================
// Table Header Rendering
// ===========================================================================

/**
 * Render the table header row based on current visibleColumns and sort state.
 * Called on init and whenever sort or column visibility changes.
 */
function renderTableHeader() {
  const cols = state.visibleColumns || new Set(state.columns);
  let html = '';
  for (let i = 0; i < state.columns.length; i++) {
    const col = state.columns[i];
    if (!cols.has(col)) continue;
    const sortDir = state.sortColumn === col ? state.sortDirection : 'none';
    let indicator = '';
    if (state.sortColumn === col) {
      indicator = state.sortDirection === 'asc' ? ' ▲' : state.sortDirection === 'desc' ? ' ▼' : '';
    }
    html += '<th scope="col" data-col="' + escapeHtml(col) + '" aria-sort="' + sortDir + '">'
      + escapeHtml(col)
      + '<span class="sort-indicator">' + indicator + '</span>'
      + '</th>';
  }
  el.tableHeader.replaceChildren();
  el.tableHeader.insertAdjacentHTML('beforeend', html);
}

// ===========================================================================
// Table Body Rendering (POL-03: batch insertAdjacentHTML)
// ===========================================================================

/**
 * Render table body rows using batch insertAdjacentHTML (POL-03).
 * No per-row appendChild -- builds a single HTML string.
 * @param {Array} rows - sorted/filtered rows to render
 */
function renderTableBody(rows) {
  const cols = state.visibleColumns || new Set(state.columns);
  const query = state.searchQuery;
  let html = '';
  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    html += '<tr>';
    for (let ci = 0; ci < state.columns.length; ci++) {
      const col = state.columns[ci];
      if (!cols.has(col)) continue;
      const value = row.values[col] || '';
      const band = row.bands[col] || '';
      const flag = row.flags[col] || '';
      const cellColors = getCellColors(band, flag, state.editionDate);
      const displayValue = query ? highlightMatch(value, query) : escapeHtml(value);
      var style = cellColors.bg ? 'background:' + cellColors.bg + ';color:' + cellColors.text : '';
      html += '<td' + (style ? ' style="' + style + '"' : '') + '>' + displayValue + '</td>';
    }
    html += '</tr>';
  }
  el.tableBody.replaceChildren();
  el.tableBody.insertAdjacentHTML('beforeend', html);
}

// ===========================================================================
// Filter + Sort Pipeline
// ===========================================================================

/**
 * Re-run the full filter/sort pipeline and re-render the table.
 * Called on every state change (search, filter toggle, sort click).
 */
function applyAndRender() {
  // Start with immutable full dataset
  var result = state.allRows;

  // Apply search filter
  result = searchRows(result, state.searchQuery);

  // Apply sidebar filters (band, flag, numeric) -- AND logic
  result = filterRows(result, state.activeFilters);

  // Store filtered count for other operations
  state.filteredRows = result;

  // Apply sort
  result = sortRows(result, state.sortColumn, state.sortDirection);

  // Re-render header (to update sort indicators) and body
  renderTableHeader();
  renderTableBody(result);

  // Update sticky brand offset after layout
  updateStickyBrandOffset();

  // Results count
  el.resultsCount.textContent = result.length + ' of ' + state.allRows.length + ' results';

  // Toggle empty state
  el.emptyState.hidden = result.length !== 0;
}

// ===========================================================================
// Sticky Column Offset
// ===========================================================================

/**
 * Measure Model column width and set --brand-sticky-left CSS custom property
 * on the table element for Brand column sticky offset.
 */
function updateStickyBrandOffset() {
  var firstTh = el.tableHeader.firstElementChild;
  if (!firstTh) return;
  var modelWidth = firstTh.offsetWidth || 150;
  var table = document.getElementById('meters-table');
  if (table) {
    table.style.setProperty('--brand-sticky-left', modelWidth + 'px');
  }
}

// ===========================================================================
// Init
// ===========================================================================

document.addEventListener('DOMContentLoaded', function () {
  loadData();
});
