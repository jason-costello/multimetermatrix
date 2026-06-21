// Data Processing Engine — Test Suite
// Zero npm dependencies. Run with: node test/engine.test.mjs

import {
  escapeHtml,
  highlightMatch,
  parseNumericValue,
  getCellColors,
  filterRows,
  sortRows,
  searchRows,
  getBandColumns,
  getFlagColumns,
  getNumericColumns,
} from "../site/engine.js";

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    passed++;
  } else {
    console.error(`  FAIL: ${msg}`);
    failed++;
  }
}

function assertEqual(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
  } else {
    console.error(`  FAIL: ${msg} - got ${a}, expected ${e}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Test fixture — 5 realistic rows based on data.json schema
// ---------------------------------------------------------------------------
const testRows = [
  {
    values: { Model: "A", Price: "$100", Count: "60000" },
    bands: { Count: "V High", Price: "Average" },
    flags: { DUT: "missing" },
  },
  {
    values: { Model: "B", Price: "$200", Count: "12000" },
    bands: { Count: "High", Price: "Low" },
    flags: { DUT: "" },
  },
  {
    values: { Model: "C", Price: "$50", Count: "6000" },
    bands: { Count: "Average", Price: "High" },
    flags: { DUT: "missing" },
  },
  {
    values: { Model: "D", Price: "$500", Count: "30000" },
    bands: { Count: "V Low", Price: "V High" },
    flags: { DUT: "optional" },
  },
  {
    values: { Model: "E", Price: "N/A", Count: "" },
    bands: { Count: "", Price: "" },
    flags: { DUT: "" },
  },
];

// ---------------------------------------------------------------------------
// 1. escapeHtml tests
// ---------------------------------------------------------------------------
console.log("\n=== escapeHtml ===");

// normal text unchanged
assertEqual(escapeHtml("normal text"), "normal text", "normal text unchanged");

// < replaced
assertEqual(escapeHtml("<script>"), "&lt;script&gt;", "< replaced");

// > replaced
assertEqual(escapeHtml("a > b"), "a &gt; b", "> replaced");

// & replaced
assertEqual(escapeHtml("AT&T"), "AT&amp;T", "& replaced");

// " replaced
assertEqual(escapeHtml('"quoted"'), "&quot;quoted&quot;", '\'"\' replaced');

// empty string
assertEqual(escapeHtml(""), "", "empty string returns empty");

// null -> ""
assertEqual(escapeHtml(null), "", "null returns empty");

// undefined -> ""
assertEqual(escapeHtml(undefined), "", "undefined returns empty");

// mixed special chars
assertEqual(
  escapeHtml('<a href="test&co">'),
  "&lt;a href=&quot;test&amp;co&quot;&gt;",
  "mixed special chars all escaped"
);

// no double-escaping
const once = escapeHtml("AT&T");
assertEqual(escapeHtml(once), "AT&amp;amp;T", "double escaping adds extra entities");

// ---------------------------------------------------------------------------
// 2. highlightMatch tests
// ---------------------------------------------------------------------------
console.log("\n=== highlightMatch ===");

// simple match wraps in mark
assertEqual(
  highlightMatch("Hello World", "world"),
  'Hello <mark class="search-match">World</mark>',
  "simple case-insensitive match"
);

// no match returns original
assertEqual(
  highlightMatch("Hello World", "xyz"),
  "Hello World",
  "no match returns original unchanged"
);

// multiple matches all wrapped
assertEqual(
  highlightMatch("Hello Hello", "hello"),
  '<mark class="search-match">Hello</mark> <mark class="search-match">Hello</mark>',
  "multiple matches all wrapped"
);

// empty query = original
assertEqual(
  highlightMatch("Test", ""),
  "Test",
  "empty query returns original"
);

// HTML chars escaped before highlight
assertEqual(
  highlightMatch("AT&T", "t"),
  'A<mark class="search-match">T</mark>&amp;<mark class="search-match">T</mark>',
  "HTML chars escaped before wrapping highlight"
);

// null value -> ""
assertEqual(highlightMatch(null, "test"), "", "null value returns empty");

// special chars in query are escaped
assertEqual(
  highlightMatch("Price: $100", "$100"),
  'Price: <mark class="search-match">$100</mark>',
  "special regex chars in query escaped before building regex"
);

// leading/trailing whitespace in query - verify whitespace handling
assertEqual(
  highlightMatch("Hello World", " Hello "),
  "Hello World",
  "whitespace in query treated as literal (no match due to leading space)"
);

// ---------------------------------------------------------------------------
// 3. parseNumericValue tests
// ---------------------------------------------------------------------------
console.log("\n=== parseNumericValue ===");

// "$910" -> 910
assertEqual(parseNumericValue("$910"), 910, "$910 -> 910");

// "$1,500" -> 1500
assertEqual(parseNumericValue("$1,500"), 1500, "$1,500 -> 1500");

// "60000" -> 60000
assertEqual(parseNumericValue("60000"), 60000, "60000 -> 60000");

// "100K" -> 100000
assertEqual(parseNumericValue("100K"), 100000, "100K -> 100000 (kilo multiplier)");

// "10nA" -> 0.00000001
assertEqual(parseNumericValue("10nA"), 0.00000001, "10nA -> 1e-8 (nano multiplier)");

// "0.1uV" -> 0.0000001
assertEqual(parseNumericValue("0.1uV"), 0.0000001, "0.1uV -> 1e-7 (micro multiplier)");

// "10mA" -> 0.01
assertEqual(parseNumericValue("10mA"), 0.01, "10mA -> 0.01 (milli multiplier)");

// "" -> null
assertEqual(parseNumericValue(""), null, 'empty string -> null');

// "N/A" -> null
assertEqual(parseNumericValue("N/A"), null, "N/A -> null");

// null -> null
assertEqual(parseNumericValue(null), null, "null -> null");

// "III 600>" -> null
assertEqual(parseNumericValue("III 600>"), null, '"III 600>" -> null');

// "v" -> null
assertEqual(parseNumericValue("v"), null, '"v" -> null');

// "x" -> null
assertEqual(parseNumericValue("x"), null, '"x" -> null');

// "10MΩ" -> 10 (M=mega not in multipliers, Ω stripped by regex)
assertEqual(parseNumericValue("10MΩ"), 10, '"10MΩ" -> 10 (mega not in multiplier table)');

// "2.5K" -> 2500 (decimal * 1000)
assertEqual(parseNumericValue("2.5K"), 2500, '"2.5K" -> 2500 (decimal kilo multiplier)');

// ---------------------------------------------------------------------------
// 4. getCellColors tests
// ---------------------------------------------------------------------------
console.log("\n=== getCellColors ===");

const editionDate = "1/24/2026";

// band colors
assertEqual(
  getCellColors("V High", "", editionDate),
  { bg: "#1b7a3d", text: "#ffffff" },
  "V High band -> green bg, white text"
);
assertEqual(
  getCellColors("High", "", editionDate),
  { bg: "#5ba86c", text: "#ffffff" },
  "High band -> lighter green bg, white text"
);
assertEqual(
  getCellColors("Average", "", editionDate),
  { bg: "#f5c842", text: "#1a1a2e" },
  "Average band -> amber bg, dark text"
);
assertEqual(
  getCellColors("Low", "", editionDate),
  { bg: "#e8833a", text: "#ffffff" },
  "Low band -> orange bg, white text"
);
assertEqual(
  getCellColors("V Low", "", editionDate),
  { bg: "#c4403a", text: "#ffffff" },
  "V Low band -> red bg, white text"
);

// flag colors
assertEqual(
  getCellColors("", "missing", editionDate),
  { bg: "#b0b0b0", text: "#ffffff" },
  "missing flag -> grey bg, white text"
);
assertEqual(
  getCellColors("", "important_missing", editionDate),
  { bg: "#d45050", text: "#ffffff" },
  "important_missing flag -> red bg, white text"
);
assertEqual(
  getCellColors("", "optional", editionDate),
  { bg: "#5d9ed7", text: "#ffffff" },
  "optional flag -> blue bg, white text"
);
assertEqual(
  getCellColors("", "no_info", editionDate),
  { bg: "#939393", text: "#ffffff" },
  "no_info flag -> dark grey bg, white text"
);

// no band or flag
assertEqual(
  getCellColors("", "", editionDate),
  { bg: "", text: "#333333" },
  "empty band and flag -> transparent bg, body text"
);

// edition date leak treated as none (band equals edition date)
assertEqual(
  getCellColors(editionDate, "", editionDate),
  { bg: "", text: "#333333" },
  "edition date leak treated as no color"
);

// both band and flag present — band takes priority
assertEqual(
  getCellColors("V High", "missing", editionDate),
  { bg: "#1b7a3d", text: "#ffffff" },
  "band takes priority over flag when both present"
);

// ---------------------------------------------------------------------------
// 5. filterRows tests
// ---------------------------------------------------------------------------
console.log("\n=== filterRows ===");

// empty filters returns all rows
assertEqual(
  filterRows(testRows, {}).length,
  5,
  "empty filters returns all rows"
);

// single band filter
assertEqual(
  filterRows(testRows, { band: { Count: new Set(["V High"]) } }).length,
  1,
  "single band filter returns matching rows"
);

// union within column (V High or High)
assertEqual(
  filterRows(testRows, { band: { Count: new Set(["V High", "High"]) } }).length,
  2,
  "union within column returns both V High and High rows"
);

// AND across columns
const andFiltered = filterRows(testRows, {
  band: { Count: new Set(["V High"]), Price: new Set(["Average"]) },
});
assertEqual(andFiltered.length, 1, "AND across columns returns only rows matching all bands");
assertEqual(andFiltered[0].values.Model, "A", "AND across columns: correct row A");

// flag filter
assertEqual(
  filterRows(testRows, { flag: { DUT: new Set(["missing"]) } }).length,
  2,
  "flag filter returns rows with matching flag"
);

// numeric range (min/max)
assertEqual(
  filterRows(testRows, { numeric: { Price: { min: 100, max: 1000 } } }).length,
  3,
  "numeric range filter returns rows with price between 100 and 1000 inclusive (A=$100, B=$200, D=$500)"
);

// combined band + flag + numeric
assertEqual(
  filterRows(testRows, {
    band: { Count: new Set(["V High", "High"]) },
    flag: { DUT: new Set(["missing"]) },
    numeric: { Price: { min: 50, max: 200 } },
  }).length,
  1,
  "combined band + flag + numeric filter returns only rows matching all conditions"
);

// numeric range with unparseable values (row E has Price "N/A")
assertEqual(
  filterRows(testRows, { numeric: { Price: { min: null, max: 500 } } }).length,
  4,
  "numeric filter excludes rows with unparseable values (E excluded, 4 remain)"
);

// ---------------------------------------------------------------------------
// 6. sortRows tests
// ---------------------------------------------------------------------------
console.log("\n=== sortRows ===");

// none = original order
assertEqual(
  sortRows(testRows, null, "none").length,
  5,
  "sortRows with direction 'none' returns all rows"
);
assertEqual(
  sortRows(testRows, null, "none")[0].values.Model,
  "A",
  "sortRows none preserves original order (first = A)"
);

// ascending numeric (Count)
const ascCount = sortRows(testRows, "Count", "asc");
assertEqual(ascCount[0].values.Model, "E", "Count asc: first = E (empty sorts low)");
assertEqual(ascCount[ascCount.length - 1].values.Model, "A", "Count asc: last = A (60000)");

// descending numeric (Count)
const descCount = sortRows(testRows, "Count", "desc");
assertEqual(descCount[0].values.Model, "A", "Count desc: first = A (60000)");

// ascending text (Model)
const ascModel = sortRows(testRows, "Model", "asc");
assertEqual(ascModel[0].values.Model, "A", "Model asc: first = A");
assertEqual(ascModel[ascModel.length - 1].values.Model, "E", "Model asc: last = E");

// descending text (Model)
const descModel = sortRows(testRows, "Model", "desc");
assertEqual(descModel[0].values.Model, "E", "Model desc: first = E");

// stable sort — equal values preserve original order
const stableRows = [
  { values: { Model: "X", Count: "100" } },
  { values: { Model: "Y", Count: "100" } },
];
const stableSorted = sortRows(stableRows, "Count", "asc");
assertEqual(stableSorted[0].values.Model, "X", "stable sort: equal values preserve original index order (X before Y)");

// Price sort (with $ stripping)
const ascPrice = sortRows(testRows, "Price", "asc");
assertEqual(ascPrice[0].values.Model, "C", "Price asc: first = C ($50)");
assertEqual(ascPrice[ascPrice.length - 1].values.Model, "E", "Price asc: last = E (N/A unparseable sorts after numbers)");

// does not mutate input array
const rowsCopy = [...testRows];
sortRows(testRows, "Count", "asc");
assertEqual(
  testRows[0].values.Model,
  rowsCopy[0].values.Model,
  "sortRows does not mutate input array"
);

// ---------------------------------------------------------------------------
// 7. searchRows tests
// ---------------------------------------------------------------------------
console.log("\n=== searchRows ===");

// empty query returns all
assertEqual(searchRows(testRows, "").length, 5, "empty query returns all rows");

// text match finds rows — "N/A" also matches so expect 2
assertEqual(searchRows(testRows, "A").length, 2, "text match finds rows with Model=A and N/A price");
assertEqual(searchRows(testRows, "A")[0].values.Model, "A", "first result is row A");

// case insensitive
assertEqual(searchRows(testRows, "a").length, 2, "case insensitive match same as uppercase");

// matches across any column
const allN = searchRows(testRows, "N/A");
assertEqual(allN.length, 1, 'matches rows with value "N/A" in Price column');

// no match returns empty array
assertEqual(searchRows(testRows, "zzzzz").length, 0, "no match returns empty array");

// does not mutate input array
const searchCopy = [...testRows];
searchRows(testRows, "A");
assertEqual(
  testRows[0].values.Model,
  searchCopy[0].values.Model,
  "searchRows does not mutate input array"
);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log("\n================================");
console.log(`  Passed: ${passed}  Failed: ${failed}`);
console.log("================================");

if (failed > 0) {
  process.exit(1);
}
