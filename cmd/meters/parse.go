package main

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/xuri/excelize/v2"
)

// expectedHeaders is the canonical list of 51 column headers that the xlsx
// sheet "6000+ count" is expected to contain in row 2. Derived from the
// reference fixture testdata/meters.xlsx via excelize GetRows.
var expectedHeaders = []string{
	"Model", "Brand", "Count", "AC+", "BW", "DUT", "uV", "V Accuracy", "A", "uA",
	"I Accuracy", "bw", "uΩ", "nS/MΩ", "Cn", "pF", "mF", "Dio", "□Hz", "%", "W",
	"T°", "PC", "Kit", "Int Log", "Clk", "Dsp", "Light", "'I'''I'", "M/m", "Peak",
	"Hld", "dB", "LoZ", "VFD", "Evt", "Batt", "Life", "F G", "E Pwr", "Jack", "Fuse",
	"CAT", "UL", "EMC", "IP", "P/F", "4-20", "NCV", "Price", "Yr",
}

// openXLSX opens an xlsx file at the given path and returns the excelize File handle.
func openXLSX(path string) (*excelize.File, error) {
	f, err := excelize.OpenFile(path)
	if err != nil {
		return nil, fmt.Errorf("open meters.xlsx: %w", err)
	}
	return f, nil
}

// findSheet locates the sheet named "6000+ count" in the workbook. It first
// tries an exact match, then a case-insensitive match. Returns
// SHEET_NOT_FOUND error if the sheet is not found at all.
func findSheet(f *excelize.File) (string, error) {
	sheets := f.GetSheetList()
	for _, s := range sheets {
		if s == "6000+ count" {
			return s, nil
		}
	}
	for _, s := range sheets {
		if strings.EqualFold(s, "6000+ count") {
			return s, nil
		}
	}
	return "", fmt.Errorf("SHEET_NOT_FOUND: expected sheet '6000+ count' but found: %s",
		strings.Join(sheets, ", "))
}

// parseLegend reads the legend row (row 1) and extracts score band and
// categorical marker entries. Bands and markers are identified by their cell
// value and fill color. Sub-header cells ("Legend:", "Score:", "Edition:")
// and description cells (starting with ":") are skipped.
func parseLegend(f *excelize.File, sheet string) (bands []legendEntry, markers []legendEntry, err error) {
	rows, err := f.GetRows(sheet)
	if err != nil {
		return nil, nil, fmt.Errorf("read sheet: %w", err)
	}
	if len(rows) < 1 {
		return nil, nil, nil
	}

	// Collect all row-1 cells with their column index, value, and fill color.
	type cellInfo struct {
		col   int
		value string
		fill  string
	}
	var cells []cellInfo

	for colIdx, val := range rows[0] {
		if val == "" {
			continue
		}
		cell, _ := excelize.CoordinatesToCellName(colIdx+1, 1)
		styleID, styleErr := f.GetCellStyle(sheet, cell)
		if styleErr != nil {
			continue
		}
		style, styleErr := f.GetStyle(styleID)
		if styleErr != nil {
			continue
		}
		fill := ""
		if len(style.Fill.Color) > 0 {
			fill = style.Fill.Color[0]
		}
		if fill == "" || fill == "FFFFFFFF" || fill == "FF000000" {
			continue
		}
		cells = append(cells, cellInfo{col: colIdx, value: val, fill: fill})
	}

	// Build a map from column index to cell value for adjacent-lookup.
	colValues := make(map[int]string)
	for _, c := range cells {
		colValues[c.col] = c.value
	}

	// Skip sub-header / description cells and classify the rest.
skipLabel := func(v string) bool {
		v = strings.TrimSpace(v)
		if v == "" {
			return true
		}
		lower := strings.ToLower(v)
		if lower == "legend:" || lower == "score:" || lower == "edition:" {
			return true
		}
		if strings.HasPrefix(v, ":") {
			return true
		}
		// Exclude date-like cell values (e.g., edition date stamp from
		// row 1 col ~47-48) so they do not leak into bands or markers.
		if looksLikeDate(v) {
			return true
		}
		return false
	}

	for _, c := range cells {
		val := strings.TrimSpace(c.value)
		if skipLabel(val) {
			continue
		}

		hex := stripAlpha(c.fill)

		// Determine if this is a categorical marker.
		if isSingleChar(val) {
			// Look ahead for a description cell to derive the label.
			label := deriveMarkerLabel(c.col, colValues)
			if label != "" {
				markers = append(markers, legendEntry{hex: hex, label: label})
				continue
			}
		}

		if containsMarkerKeyword(val) {
			label := extractMarkerLabel(val)
			if label != "" {
				markers = append(markers, legendEntry{hex: hex, label: label})
				continue
			}
		}

		// Otherwise it is a score band.
		bands = append(bands, legendEntry{hex: hex, label: val})
	}

	return bands, markers, nil
}

// isSingleChar returns true if s is a single visible character used as a
// categorical marker symbol.
func isSingleChar(s string) bool {
	s = strings.TrimSpace(s)
	if len(s) != 1 {
		return false
	}
	return s == "x" || s == "O" || s == "?"
}

// containsMarkerKeyword returns true if s contains a keyword identifying it
// as a categorical marker description.
func containsMarkerKeyword(s string) bool {
	lower := strings.ToLower(s)
	return strings.Contains(lower, "missing") ||
		strings.Contains(lower, "optional") ||
		strings.Contains(lower, "no_info") ||
		strings.Contains(lower, "no info")
}

// extractMarkerLabel derives a normalized marker label from a description
// string. Returns "missing", "important_missing", "optional", or "no_info".
// Returns "" if no known pattern is matched.
func extractMarkerLabel(s string) string {
	lower := strings.ToLower(s)
	if strings.Contains(lower, "important missing") || strings.Contains(lower, "important_missing") {
		return "important_missing"
	}
	if strings.Contains(lower, "missing") {
		return "missing"
	}
	if strings.Contains(lower, "optional") {
		return "optional"
	}
	if strings.Contains(lower, "no_info") || strings.Contains(lower, "no info") {
		return "no_info"
	}
	return ""
}

// deriveMarkerLabel attempts to find the label for a marker symbol cell by
// examining nearby cells. It looks at the next non-empty cell's value for
// description context.
func deriveMarkerLabel(col int, colValues map[int]string) string {
	// Look ahead at the immediate next column, then further ahead.
	for offset := 1; offset <= 5; offset++ {
		if v, ok := colValues[col+offset]; ok {
			if containsMarkerKeyword(v) {
				return extractMarkerLabel(v)
			}
		}
	}
	return ""
}

// parseHeaders reads row 2 (the header row) and returns the column headers.
// It validates that the header count matches the expected 51 columns and
// that each header name matches the expected list. On mismatch, it collects
// ALL differences before returning an error per D-13.
func parseHeaders(f *excelize.File, sheet string) ([]string, error) {
	rows, err := f.GetRows(sheet)
	if err != nil {
		return nil, fmt.Errorf("read sheet: %w", err)
	}
	if len(rows) < 2 {
		return nil, fmt.Errorf("HEADER_MISMATCH: expected 51 columns, got 0 (missing header row)")
	}

	headers := rows[1]
	if len(headers) != len(expectedHeaders) {
		// Collect differences
		var diffs []string
		diffs = append(diffs, fmt.Sprintf("HEADER_MISMATCH: expected %d columns, got %d",
			len(expectedHeaders), len(headers)))

		extra := len(headers) - len(expectedHeaders)
		if extra > 0 {
			diffs = append(diffs, fmt.Sprintf("  - Extra headers: %s",
				strings.Join(headers[len(expectedHeaders):], ", ")))
		} else {
			missing := expectedHeaders[len(headers):]
			diffs = append(diffs, fmt.Sprintf("  - Missing headers: %s",
				strings.Join(missing, ", ")))
		}
		return nil, fmt.Errorf("%s", strings.Join(diffs, "\n"))
	}

	var diffs []string
	for i, h := range headers {
		if h != expectedHeaders[i] {
			diffs = append(diffs, fmt.Sprintf("  - col %d: got %q, expected %q", i+1, h, expectedHeaders[i]))
		}
	}
	if len(diffs) > 0 {
		all := []string{fmt.Sprintf("HEADER_MISMATCH: expected %d columns, got %d",
			len(expectedHeaders), len(headers))}
		all = append(all, diffs...)
		return nil, fmt.Errorf("%s", strings.Join(all, "\n"))
	}

	return headers, nil
}

// parseDataRows reads data rows starting from row 3, pads trailing blanks
// for rows with fewer cells than the header count, and returns a slice of
// Row structs with Values maps populated.
func parseDataRows(f *excelize.File, sheet string, headers []string) ([]Row, error) {
	rows, err := f.GetRows(sheet)
	if err != nil {
		return nil, fmt.Errorf("read sheet: %w", err)
	}
	if len(rows) < 3 {
		return nil, nil
	}

	expectedCols := len(headers)
	dataRows := rows[2:]
	result := make([]Row, 0, len(dataRows))

	for _, row := range dataRows {
		// Pad trailing blanks
		var padded []string
		if len(row) < expectedCols {
			padded = make([]string, expectedCols)
			copy(padded, row)
		} else {
			padded = row
		}

		values := make(map[string]string, expectedCols)
		for i, h := range headers {
			if i < len(padded) {
				values[h] = padded[i]
			} else {
				values[h] = ""
			}
		}

		result = append(result, Row{Values: values})
	}

	return result, nil
}

// scanEditionDate scans row 1 for a date-like string, checking columns
// around col 47-48 (cells AU1, AV1). Returns the date string in ISO 8601
// format (YYYY-MM-DD) if found, or an empty string if no recognizable date
// is found.
func scanEditionDate(f *excelize.File, sheet string) string {
	// Check the known location first (AV1).
	for _, ref := range []string{"AV1", "AU1"} {
		val, err := f.GetCellValue(sheet, ref)
		if err != nil || val == "" {
			continue
		}
		// Check if it looks like a date: contains digits.
		if hasDigit(val) {
			return normalizeDate(val)
		}
	}

	// Fallback: scan row 1 by reading all cells.
	rows, err := f.GetRows(sheet)
	if err != nil || len(rows) < 1 {
		return ""
	}
	for _, val := range rows[0] {
		if val == "" {
			continue
		}
		if looksLikeDate(val) {
			return normalizeDate(val)
		}
	}

	return ""
}

// hasDigit checks if the string contains at least one digit character.
func hasDigit(s string) bool {
	for _, r := range s {
		if r >= '0' && r <= '9' {
			return true
		}
	}
	return false
}

// looksLikeDate checks if a string resembles a date format (contains digits
// and common date separators).
func looksLikeDate(s string) bool {
	if !hasDigit(s) {
		return false
	}
	// Check for common date patterns: slash-separated, hyphen-separated, ISO 8601.
	if strings.Contains(s, "/") || strings.Contains(s, "-") {
		return true
	}
	// Check for month names.
	lower := strings.ToLower(s)
	months := []string{"jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"}
	for _, m := range months {
		if strings.Contains(lower, m) {
			return true
		}
	}
	return false
}

// normalizeDate attempts to parse a date string in common formats (US
// M/D/YYYY, YYYY-MM-DD, etc.) and returns it in ISO 8601 format
// (YYYY-MM-DD). If the date cannot be parsed, the original string is
// returned unchanged.
func normalizeDate(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return s
	}

	// Already ISO 8601: YYYY-MM-DD.
	if len(s) == 10 && s[4] == '-' && s[7] == '-' {
		return s
	}

	// Try US format: M/D/YYYY or MM/DD/YYYY.
	if strings.Contains(s, "/") {
		parts := strings.Split(s, "/")
		if len(parts) == 3 {
			m := parts[0]
			d := parts[1]
			y := parts[2]
			// Pad month and day to 2 digits.
			if len(m) == 1 {
				m = "0" + m
			}
			if len(d) == 1 {
				d = "0" + d
			}
			if len(y) == 4 && len(m) == 2 && len(d) == 2 {
				return y + "-" + m + "-" + d
			}
		}
	}

	// If we cannot parse it, return the original value unchanged.
	return s
}

// getCellFillColor gets the fill color of a cell, stripped of alpha prefix.
// Returns empty string if the cell has no fill or a white/empty fill.
func getCellFillColor(f *excelize.File, sheet, cell string) string {
	styleID, err := f.GetCellStyle(sheet, cell)
	if err != nil {
		return ""
	}
	style, err := f.GetStyle(styleID)
	if err != nil {
		return ""
	}
	if len(style.Fill.Color) == 0 {
		return ""
	}
	fill := style.Fill.Color[0]
	if fill == "" || fill == "FFFFFFFF" || fill == "FF000000" {
		return ""
	}
	return stripAlpha(fill)
}

// parseNumber attempts to parse a string as an integer. Used for Excel serial
// date number conversion.
func parseNumber(s string) (int, bool) {
	// Strip decimal point and everything after for integer parsing.
	if idx := strings.Index(s, "."); idx >= 0 {
		s = s[:idx]
	}
	n, err := strconv.Atoi(s)
	if err != nil {
		return 0, false
	}
	return n, true
}
