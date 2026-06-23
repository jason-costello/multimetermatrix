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
    buildFiltersUI(data);
    buildColumnVisibilityMenu(data);
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

  // -- Measure legend bar height for sticky header offset --
  updateStickyOffsets();

  // -- Initialize collapsible filter sections --
  initCollapsibleSections();

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
    var sortDir = state.sortColumn === col ? state.sortDirection : 'none';
    html += '<th scope="col" data-col="' + escapeHtml(col) + '" aria-sort="' + sortDir + '">'
      + escapeHtml(col)
      + '<span class="sort-indicator"></span>'
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

  // Re-render header and body
  renderTableHeader();
  renderTableBody(result);
  updateSortIndicators();

  // Update sticky brand offset after layout
  updateStickyBrandOffset();

  // Results count
  el.resultsCount.textContent = result.length + ' of ' + state.allRows.length + ' results';

  // Toggle empty state
  el.emptyState.hidden = result.length !== 0;

  // Update active filter count badge
  updateFilterCount();
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
// Sticky Legend/Header Offset
// ===========================================================================

/**
 * Measure the legend bar height and set --legend-bar-height CSS custom property
 * on the #table-header element for correct sticky positioning.
 */
function updateStickyOffsets() {
  var legendBar = document.getElementById('legend-bar');
  var tableHeader = document.getElementById('table-header');
  if (legendBar && tableHeader) {
    var h = legendBar.offsetHeight;
    tableHeader.style.setProperty('--legend-bar-height', h + 'px');
  }
}

// ===========================================================================
// Clear All Filters
// ===========================================================================

/**
 * Reset all filter state: search, band checkboxes, flag checkboxes, numeric inputs.
 * Unchecks all sidebar checkboxes and clears range inputs.
 */
function clearAllFilters() {
  state.searchQuery = '';
  state.activeFilters = { band: {}, flag: {}, numeric: {} };
  el.searchInput.value = '';
  // Uncheck all checkboxes and clear all range inputs in sidebar
  el.sidebar.querySelectorAll('input[type="checkbox"]').forEach(function (cb) { cb.checked = false; });
  el.sidebar.querySelectorAll('input[type="number"]').forEach(function (inp) { inp.value = ''; });
  applyAndRender();
}

// ===========================================================================
// Search
// ===========================================================================

/**
 * Handle search input after debounce fires.
 * @param {string} value - trimmed search text
 */
function handleSearchInput(value) {
  state.searchQuery = value;
  applyAndRender();
}

// ===========================================================================
// Sort Indicators
// ===========================================================================

/**
 * Update sort indicator spans in table header based on current sort state.
 * Removes all indicators first, then adds ▲/▼ to active column.
 */
function updateSortIndicators() {
  var ths = el.tableHeader.querySelectorAll('th');
  for (var i = 0; i < ths.length; i++) {
    var th = ths[i];
    var span = th.querySelector('.sort-indicator');
    if (!span) continue;
    var col = th.dataset.col;
    if (state.sortColumn === col && state.sortDirection !== 'none') {
      span.textContent = state.sortDirection === 'asc' ? ' ▲' : ' ▼';
      th.setAttribute('aria-sort', state.sortDirection);
    } else {
      span.textContent = '';
      th.setAttribute('aria-sort', 'none');
    }
  }
}

// ===========================================================================
// Sidebar Filter UI
// ===========================================================================

/**
 * Build sidebar filter controls from data.json structure.
 * Creates band checkboxes, flag checkboxes, and numeric range inputs.
 * @param {Object} data - the full data.json object
 */
function buildFiltersUI(data) {
  // Band score checkboxes
  var bandCols = getBandColumns();
  for (var bi = 0; bi < bandCols.length; bi++) {
    var col = bandCols[bi];
    var groupHtml = '<div class="filter-group-item">';
    groupHtml += '<label class="filter-group-label">' + escapeHtml(col) + '</label>';
    groupHtml += '<div class="filter-checkboxes">';
    var bandOptions = ['V High', 'High', 'Average', 'Low', 'V Low'];
    for (var oi = 0; oi < bandOptions.length; oi++) {
      var opt = bandOptions[oi];
      groupHtml += '<label><input type="checkbox" data-filter-type="band" data-column="' + escapeHtml(col) + '" data-value="' + opt + '"> ' + opt + '</label>';
    }
    groupHtml += '</div></div>';
    el.bandFilters.insertAdjacentHTML('beforeend', groupHtml);
  }

  // Flag checkboxes
  var flagCols = getFlagColumns(data);
  for (var fi = 0; fi < flagCols.length; fi++) {
    var fcol = flagCols[fi];
    var fHtml = '<div class="filter-group-item">';
    fHtml += '<label class="filter-group-label">' + escapeHtml(fcol) + '</label>';
    fHtml += '<div class="filter-checkboxes">';
    var flagOptions = ['missing', 'important_missing', 'optional', 'no_info'];
    for (var foi = 0; foi < flagOptions.length; foi++) {
      var fopt = flagOptions[foi];
      fHtml += '<label><input type="checkbox" data-filter-type="flag" data-column="' + escapeHtml(fcol) + '" data-value="' + fopt + '"> ' + fopt + '</label>';
    }
    fHtml += '</div></div>';
    el.flagFilters.insertAdjacentHTML('beforeend', fHtml);
  }

  // Numeric range inputs
  var numCols = getNumericColumns();
  for (var ni = 0; ni < numCols.length; ni++) {
    var ncol = numCols[ni];
    var nHtml = '<div class="filter-group-item">';
    nHtml += '<label class="filter-group-label">' + escapeHtml(ncol) + '</label>';
    nHtml += '<div class="numeric-filter">';
    nHtml += '<label>Min</label><input type="number" data-filter-type="numeric" data-column="' + escapeHtml(ncol) + '" data-bound="min" step="any">';
    nHtml += '</div>';
    nHtml += '<div class="numeric-filter">';
    nHtml += '<label>Max</label><input type="number" data-filter-type="numeric" data-column="' + escapeHtml(ncol) + '" data-bound="max" step="any">';
    nHtml += '</div></div>';
    el.numFilters.insertAdjacentHTML('beforeend', nHtml);
  }
}

// ===========================================================================
// Init
// ===========================================================================

document.addEventListener('DOMContentLoaded', function () {
  loadData();

  // -- Search debounce --
  var searchTimer = null;
  el.searchInput.addEventListener('input', function (e) {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () { handleSearchInput(e.target.value); }, 250);
  });

  // -- Column sort (event delegation on header row) --
  el.tableHeader.addEventListener('click', function (e) {
    var th = e.target.closest('th');
    if (!th || !th.dataset.col) return;
    var col = th.dataset.col;
    if (state.sortColumn === col) {
      // Cycle: asc -> desc -> none
      state.sortDirection = state.sortDirection === 'asc' ? 'desc' : state.sortDirection === 'desc' ? 'none' : 'asc';
    } else {
      state.sortColumn = col;
      state.sortDirection = 'asc';
    }
    if (state.sortDirection === 'none') {
      state.sortColumn = null;
    }
    applyAndRender();
  });

  // -- Filter sidebar event delegation --
  // Band / flag checkbox changes
  el.sidebar.addEventListener('change', function (e) {
    if (e.target.type !== 'checkbox') return;
    var type = e.target.dataset.filterType;
    if (!type) return;
    var col = e.target.dataset.column;
    var val = e.target.dataset.value;
    if (!state.activeFilters[type][col]) {
      state.activeFilters[type][col] = new Set();
    }
    if (e.target.checked) {
      state.activeFilters[type][col].add(val);
    } else {
      state.activeFilters[type][col].delete(val);
    }
    // Clean up empty sets
    if (state.activeFilters[type][col].size === 0) {
      delete state.activeFilters[type][col];
    }
    applyAndRender();
  });

  // Numeric range inputs
  el.sidebar.addEventListener('input', function (e) {
    if (e.target.dataset.filterType !== 'numeric') return;
    var col = e.target.dataset.column;
    var bound = e.target.dataset.bound;
    if (!state.activeFilters.numeric[col]) {
      state.activeFilters.numeric[col] = { min: null, max: null };
    }
    var val = e.target.value;
    state.activeFilters.numeric[col][bound] = val !== '' ? parseFloat(val) : null;
    // Clean up empty entries
    if (state.activeFilters.numeric[col].min === null && state.activeFilters.numeric[col].max === null) {
      delete state.activeFilters.numeric[col];
    }
    applyAndRender();
  });
});

// ===========================================================================
// Column Visibility
// ===========================================================================

/**
 * Build column visibility checkbox menu from data columns.
 * Called once after initUI.
 * @param {Object} data - the full data.json object
 */
function buildColumnVisibilityMenu(data) {
  var html = '';
  for (var i = 0; i < data.columns.length; i++) {
    var col = data.columns[i];
    html += '<label><input type="checkbox" data-col="' + escapeHtml(col) + '" checked> ' + escapeHtml(col) + '</label>';
  }
  el.colChecklist.insertAdjacentHTML('beforeend', html);
}

// ===========================================================================
// Row Density
// ===========================================================================

/**
 * Restore density preference from localStorage and apply it.
 */
function restoreDensity() {
  var mode = localStorage.getItem('rowDensity') || 'comfortable';
  state.density = mode;
  applyDensity(mode);
}

/**
 * Apply density mode to the table and toggle active button state.
 * @param {string} mode - 'compact', 'comfortable', or 'spacious'
 */
function applyDensity(mode) {
  el.densityToggle.querySelectorAll('.density-btn').forEach(function (btn) {
    btn.classList.toggle('active', btn.dataset.density === mode);
  });
  var table = document.getElementById('meters-table');
  if (table) table.className = 'density-' + mode;
  localStorage.setItem('rowDensity', mode);
  state.density = mode;
}

// ===========================================================================
// Mobile Drawer
// ===========================================================================

/**
 * Close the mobile sidebar drawer and hide backdrop + close button.
 */
function closeMobileDrawer() {
  el.sidebar.classList.remove('open');
  el.sidebarBackdrop.hidden = true;
  el.sidebarClose.hidden = true;
}

// ===========================================================================
// Filter Count Badge
// ===========================================================================

/**
 * Count active filters and update the badge on the sidebar toggle button.
 */
function updateFilterCount() {
  var count = 0;
  // Count band checkboxes checked
  var bandValues = Object.values(state.activeFilters.band);
  for (var bi = 0; bi < bandValues.length; bi++) {
    count += bandValues[bi].size;
  }
  // Count flag checkboxes checked
  var flagValues = Object.values(state.activeFilters.flag);
  for (var fi = 0; fi < flagValues.length; fi++) {
    count += flagValues[fi].size;
  }
  // Count numeric ranges with values
  var numValues = Object.values(state.activeFilters.numeric);
  for (var ni = 0; ni < numValues.length; ni++) {
    var r = numValues[ni];
    if (r.min !== null || r.max !== null) count++;
  }
  // Add search if non-empty
  if (state.searchQuery) count++;
  if (count > 0) {
    el.filterCountBadge.textContent = count;
    el.filterCountBadge.hidden = false;
  } else {
    el.filterCountBadge.hidden = true;
  }
}

// ===========================================================================
// Collapsible Filter Sections
// ===========================================================================

/**
 * Initialize collapsible filter sections in the sidebar.
 * Each section h3 is clickable — toggles .collapsed class on parent section.
 * Default: Numeric open, Band Scores + Flags collapsed.
 */
function initCollapsibleSections() {
  var sections = document.querySelectorAll('#sidebar .sidebar-section');
  // Close Band Scores and Flags by default
  var bandSection = document.getElementById('band-filters');
  var flagSection = document.getElementById('flag-filters');
  if (bandSection) bandSection.classList.add('collapsed');
  if (flagSection) flagSection.classList.add('collapsed');

  // Add click handler on each h3 within a sidebar section
  for (var i = 0; i < sections.length; i++) {
    var h3 = sections[i].querySelector('h3');
    if (!h3) continue;
    (function(section) {
      h3.addEventListener('click', function() {
        section.classList.toggle('collapsed');
      });
    })(sections[i]);
  }
}

// ===========================================================================
// Event Wiring (runs after DOM ready)
// ===========================================================================

document.addEventListener('DOMContentLoaded', function () {
  // -- Clear filters buttons --
  el.clearFilters.addEventListener('click', clearAllFilters);
  var emptyBtn = el.emptyState.querySelector('.clear-btn');
  if (emptyBtn) emptyBtn.addEventListener('click', clearAllFilters);

  // -- Column visibility dropdown --
  el.colVisBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    el.colVisMenu.hidden = !el.colVisMenu.hidden;
  });
  document.addEventListener('click', function (e) {
    if (!el.colVisMenu.contains(e.target) && e.target !== el.colVisBtn) {
      el.colVisMenu.hidden = true;
    }
  });

  // Column visibility checkbox changes
  el.colChecklist.addEventListener('change', function (e) {
    if (e.target.type !== 'checkbox') return;
    var col = e.target.dataset.col;
    if (!col) return;
    if (e.target.checked) {
      state.visibleColumns.add(col);
    } else {
      state.visibleColumns.delete(col);
    }
    applyAndRender();
  });

  // Show All / Hide All buttons
  var showAllBtn = document.getElementById('column-show-all');
  var hideAllBtn = document.getElementById('column-hide-all');
  if (showAllBtn) {
    showAllBtn.addEventListener('click', function () {
      el.colChecklist.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
        cb.checked = true;
        state.visibleColumns.add(cb.dataset.col);
      });
      applyAndRender();
    });
  }
  if (hideAllBtn) {
    hideAllBtn.addEventListener('click', function () {
      el.colChecklist.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
        cb.checked = false;
        state.visibleColumns.delete(cb.dataset.col);
      });
      applyAndRender();
    });
  }

  // -- Row density toggle --
  el.densityToggle.addEventListener('click', function (e) {
    var btn = e.target.closest('.density-btn');
    if (!btn) return;
    applyDensity(btn.dataset.density);
  });

  // -- Sidebar toggle --
  el.sidebarToggle.addEventListener('click', function () {
    document.body.classList.toggle('sidebar-collapsed');
    if (window.innerWidth < 768) {
      el.sidebar.classList.toggle('open');
      el.sidebarBackdrop.hidden = !el.sidebar.classList.contains('open');
      el.sidebarClose.hidden = !el.sidebar.classList.contains('open');
    }
  });

  // -- Mobile drawer close handlers --
  el.sidebarBackdrop.addEventListener('click', closeMobileDrawer);
  el.sidebarClose.addEventListener('click', closeMobileDrawer);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && el.sidebar.classList.contains('open')) {
      closeMobileDrawer();
    }
  });

  // -- Responsive: reset drawer on resize above 768px --
  var mediaQuery = window.matchMedia('(max-width: 767px)');
  mediaQuery.addEventListener('change', function (e) {
    if (!e.matches) {
      // Above mobile breakpoint -- ensure sidebar is in normal state
      el.sidebar.classList.remove('open');
      el.sidebarBackdrop.hidden = true;
      el.sidebarClose.hidden = true;
    }
  });

  // Set initial sidebar state for mobile
  if (window.innerWidth < 768) {
    document.body.classList.add('sidebar-collapsed');
  }

  // -- Sticky header shadow --
  var scrollRAF = null;
  el.tableWrapper.addEventListener('scroll', function () {
    if (scrollRAF) return;
    scrollRAF = requestAnimationFrame(function () {
      scrollRAF = null;
      var header = document.getElementById('table-header');
      if (header) {
        header.classList.toggle('header-shadow', el.tableWrapper.scrollTop > 0);
      }
    });
  });

  // -- Window resize: recalculate sticky brand offset --
  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      updateStickyOffsets();
      var modelWidth = (el.tableHeader.firstElementChild && el.tableHeader.firstElementChild.offsetWidth) || 150;
      var table = document.getElementById('meters-table');
      if (table) table.style.setProperty('--brand-sticky-left', modelWidth + 'px');
    }, 100);
  });
});
