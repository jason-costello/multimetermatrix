// Data processing engine — pure functions for the multimeter browser
// All functions are pure: no mutation of inputs, no I/O, no DOM access.

// ---------------------------------------------------------------------------
// HTML escaping
// ---------------------------------------------------------------------------

/**
 * Escape HTML special characters in a string.
 * @param {string|null|undefined} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// Search highlighting
// ---------------------------------------------------------------------------

/**
 * Highlight occurrences of query in value by wrapping them in <mark> tags.
 * HTML-escaping is applied first, then matching.
 * @param {string|null|undefined} value
 * @param {string} query
 * @returns {string}
 */
export function highlightMatch(value, query) {
  if (value == null) return "";
  const escaped = escapeHtml(value);
  if (!query) return escaped;
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escapedQuery})`, "gi");
  return escaped.replace(regex, '<mark class="search-match">$1</mark>');
}

// ---------------------------------------------------------------------------
// Numeric parsing
// ---------------------------------------------------------------------------

/**
 * Parse a cell value to a numeric value, handling $, commas, and unit suffixes.
 * @param {string|null|undefined} value
 * @returns {number|null}
 */
export function parseNumericValue(value) {
  if (value == null) return null;
  const trimmed = String(value).trim().replace(/^\$/, "").replace(/,/g, "");
  if (trimmed === "") return null;
  const match = trimmed.match(/^([\d.]+)([a-zA-ZμΩ°]*)$/);
  if (!match) return null;
  const num = parseFloat(match[1]);
  if (isNaN(num)) return null;
  const unitChar = match[2].toLowerCase()[0] || "";
  const multipliers = { k: 1000, m: 0.001, u: 0.000001, n: 0.000000001, p: 0.000000000001 };
  const mult = multipliers[unitChar] || 1;
  return num * mult;
}

// ---------------------------------------------------------------------------
// Cell color helpers
// ---------------------------------------------------------------------------

const BAND_COLORS = {
  "V High": "#1b7a3d",
  High: "#5ba86c",
  Average: "#f5c842",
  Low: "#e8833a",
  "V Low": "#c4403a",
};

const FLAG_COLORS = {
  missing: "#b0b0b0",
  important_missing: "#d45050",
  optional: "#5d9ed7",
  no_info: "#939393",
};

/**
 * Convert a hex color string to relative luminance per WCAG.
 * @param {string} hex
 * @returns {number}
 */
export function hexToLuminance(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const toLin = (c) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}

/**
 * Get cell background and text color for a given band/flag combination.
 * @param {string} band - Score band label
 * @param {string} flag - Categorical flag label
 * @param {string} editionDate - Edition date string to detect leaks
 * @returns {{ bg: string, text: string }}
 */
export function getCellColors(band, flag, editionDate) {
  // Edition date leak: if band equals the edition date, treat as no color
  const effectiveBand = band === editionDate ? "" : band;

  if (effectiveBand && BAND_COLORS[effectiveBand]) {
    const bg = BAND_COLORS[effectiveBand];
    const lum = hexToLuminance(bg);
    const text = lum > 0.5 ? "#1a1a2e" : "#ffffff";
    return { bg, text };
  }

  if (flag && FLAG_COLORS[flag]) {
    const bg = FLAG_COLORS[flag];
    const lum = hexToLuminance(bg);
    const text = lum > 0.5 ? "#1a1a2e" : "#ffffff";
    return { bg, text };
  }

  return { bg: "", text: "#333333" };
}

// ---------------------------------------------------------------------------
// Row filtering
// ---------------------------------------------------------------------------

/**
 * Filter rows by band, flag, and numeric range filters.
 * All filter types are combined with AND logic.
 * @param {Array} rows
 * @param {Object} filters - { band: {col: Set}, flag: {col: Set}, numeric: {col: {min, max}} }
 * @returns {Array} New filtered array (does not mutate input)
 */
export function filterRows(rows, filters) {
  if (!filters || Object.keys(filters).length === 0) return [...rows];

  return rows.filter((row) => {
    // Band filters — AND across columns, OR within column set
    if (filters.band) {
      for (const [col, bandSet] of Object.entries(filters.band)) {
        if (bandSet.size > 0 && !bandSet.has(row.bands[col])) {
          return false;
        }
      }
    }

    // Flag filters — AND across columns, OR within column set
    if (filters.flag) {
      for (const [col, flagSet] of Object.entries(filters.flag)) {
        if (flagSet.size > 0 && !flagSet.has(row.flags[col])) {
          return false;
        }
      }
    }

    // Numeric range filters
    if (filters.numeric) {
      for (const [col, range] of Object.entries(filters.numeric)) {
        const val = parseNumericValue(row.values[col]);
        if (val === null) return false;
        if (range.min !== null && val < range.min) return false;
        if (range.max !== null && val > range.max) return false;
      }
    }

    return true;
  });
}

// ---------------------------------------------------------------------------
// Row sorting
// ---------------------------------------------------------------------------

/**
 * Sort rows by a column value with stable ordering.
 * @param {Array} rows
 * @param {string|null} columnKey
 * @param {string} direction - "asc", "desc", or "none"
 * @returns {Array} New sorted array (does not mutate input)
 */
export function sortRows(rows, columnKey, direction) {
  if (direction === "none" || !columnKey) return [...rows];

  const mult = direction === "desc" ? -1 : 1;

  return [...rows].sort((a, b) => {
    const aVal = a.values[columnKey];
    const bVal = b.values[columnKey];
    const aNum = parseNumericValue(aVal);
    const bNum = parseNumericValue(bVal);

    let cmp;
    if (aNum !== null && bNum !== null) {
      cmp = aNum - bNum;
    } else {
      cmp = String(aVal).localeCompare(String(bVal), undefined, {
        numeric: true,
        sensitivity: "base",
      });
    }

    // Stable sort tiebreaker: preserve original insertion order
    if (cmp === 0) {
      cmp = rows.indexOf(a) - rows.indexOf(b);
    }

    return cmp * mult;
  });
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Filter rows where any column value contains the query (case-insensitive).
 * @param {Array} rows
 * @param {string} query
 * @returns {Array} New filtered array (does not mutate input)
 */
export function searchRows(rows, query) {
  if (!query) return [...rows];
  const lowerQuery = String(query).toLowerCase();
  return rows.filter((row) =>
    Object.values(row.values).some(
      (v) => String(v).toLowerCase().includes(lowerQuery)
    )
  );
}

// ---------------------------------------------------------------------------
// Column classification helpers
// ---------------------------------------------------------------------------

/**
 * Get columns that have meaningful band data (3+ distinct values, excluding edition date).
 * @returns {string[]}
 */
export function getBandColumns() {
  return [
    "Count",
    "BW",
    "uV",
    "V Accuracy",
    "A",
    "uA",
    "I Accuracy",
    "bw",
    "uΩ",
    "nS/MΩ",
    "pF",
    "mF",
    "Dio",
    "□Hz",
    "T°",
    "PC",
    "Int Log",
    "Dsp",
    "Peak",
    "Hld",
    "LoZ",
    "VFD",
    "Life",
    "Fuse",
    "CAT",
    "IP",
    "Price",
    "Yr",
    "Model",
  ];
}

/**
 * Get columns that have flag data in at least one row.
 * @param {Object} data - Full dataset with columns and rows
 * @returns {string[]}
 */
export function getFlagColumns(data) {
  return data.columns.filter((col) =>
    data.rows.some((row) => row.flags[col] && row.flags[col] !== "")
  );
}

/**
 * Get columns that support numeric range filtering (v1 scope).
 * @returns {string[]}
 */
export function getNumericColumns() {
  return ["Price", "Count", "Yr"];
}
