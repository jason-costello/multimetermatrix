package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// fixturePath resolves the path to testdata/meters.xlsx by trying a few
// common locations relative to the test runner's working directory.
func fixturePath(t *testing.T) string {
	t.Helper()
	candidates := []string{
		"../../testdata/meters.xlsx",
	}
	// Also check if we're running from the repo root (go run)
	for _, p := range []string{"testdata/meters.xlsx", "../testdata/meters.xlsx", "./testdata/meters.xlsx"} {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	// Check absolute path
	wd, _ := os.Getwd()
	for _, rel := range candidates {
		abs := filepath.Join(wd, rel)
		if _, err := os.Stat(abs); err == nil {
			return abs
		}
	}
	t.Fatal("could not find testdata/meters.xlsx - try running from repo root")
	return ""
}

func TestOpenXLSX(t *testing.T) {
	f, err := openXLSX(fixturePath(t))
	if err != nil {
		t.Fatalf("openXLSX failed: %v", err)
	}
	defer f.Close()

	// Test error on nonexistent file
	_, err = openXLSX("nonexistent.xlsx")
	if err == nil {
		t.Fatal("expected error for nonexistent file")
	}
}

func TestFindSheet(t *testing.T) {
	f, err := openXLSX(fixturePath(t))
	if err != nil {
		t.Fatalf("openXLSX failed: %v", err)
	}
	defer f.Close()

	sheet, err := findSheet(f)
	if err != nil {
		t.Fatalf("findSheet failed: %v", err)
	}
	if sheet != "6000+ count" && !strings.EqualFold(sheet, "6000+ count") {
		t.Fatalf("findSheet returned %q, expected '6000+ count'", sheet)
	}
}

func TestParseLegend(t *testing.T) {
	f, err := openXLSX(fixturePath(t))
	if err != nil {
		t.Fatalf("openXLSX failed: %v", err)
	}
	defer f.Close()

	sheet, err := findSheet(f)
	if err != nil {
		t.Fatalf("findSheet failed: %v", err)
	}

	bands, markers, err := parseLegend(f, sheet)
	if err != nil {
		t.Fatalf("parseLegend failed: %v", err)
	}

	// Should have at least 5 score bands
	if len(bands) < 5 {
		t.Errorf("bands: got %d, want >= 5", len(bands))
	}
	// Should have at least 4 categorical markers
	if len(markers) < 4 {
		t.Errorf("markers: got %d, want >= 4", len(markers))
	}

	// Verify each entry has non-empty hex and label
	for _, entry := range bands {
		if entry.hex == "" {
			t.Error("band with empty hex found")
		}
		if entry.label == "" {
			t.Errorf("band with empty label (hex=%q)", entry.hex)
		}
	}
	for _, entry := range markers {
		if entry.hex == "" {
			t.Error("marker with empty hex found")
		}
		if entry.label == "" {
			t.Errorf("marker with empty label (hex=%q)", entry.hex)
		}
	}

	// Check that V High through V Low are present
	bandLabels := make(map[string]bool)
	for _, b := range bands {
		bandLabels[b.label] = true
	}
	for _, lbl := range []string{"V High", "High", "Average", "Low", "V Low"} {
		if !bandLabels[lbl] {
			t.Errorf("missing band label %q", lbl)
		}
	}

	// Check marker labels
	markerLabels := make(map[string]bool)
	for _, m := range markers {
		markerLabels[m.label] = true
	}
	for _, lbl := range []string{"missing", "important_missing", "optional", "no_info"} {
		if !markerLabels[lbl] {
			t.Errorf("missing marker label %q", lbl)
		}
	}
}

func TestParseDataRowsPadding(t *testing.T) {
	f, err := openXLSX(fixturePath(t))
	if err != nil {
		t.Fatalf("openXLSX failed: %v", err)
	}
	defer f.Close()

	sheet, err := findSheet(f)
	if err != nil {
		t.Fatalf("findSheet failed: %v", err)
	}

	headers, err := parseHeaders(f, sheet)
	if err != nil {
		t.Fatalf("parseHeaders failed: %v", err)
	}

	rows, err := parseDataRows(f, sheet, headers)
	if err != nil {
		t.Fatalf("parseDataRows failed: %v", err)
	}

	if len(rows) < 400 {
		t.Errorf("rows: got %d, want >= 400", len(rows))
	}

	// Verify each row has exactly len(headers) values
	for i, row := range rows {
		if len(row.Values) != len(headers) {
			t.Errorf("row %d: got %d values, want %d", i, len(row.Values), len(headers))
		}
		// Verify all header keys are present
		for _, h := range headers {
			if _, ok := row.Values[h]; !ok {
				t.Errorf("row %d: missing header %q in values", i, h)
			}
		}
	}

	// Check first row model
	if len(rows) > 0 {
		model, ok := rows[0].Values["Model"]
		if !ok || model == "" {
			t.Errorf("row 0 Model: got %q, want non-empty", model)
		}
	}
}

func TestParseHeaders(t *testing.T) {
	f, err := openXLSX(fixturePath(t))
	if err != nil {
		t.Fatalf("openXLSX failed: %v", err)
	}
	defer f.Close()

	sheet, err := findSheet(f)
	if err != nil {
		t.Fatalf("findSheet failed: %v", err)
	}

	// Test correct headers
	headers, err := parseHeaders(f, sheet)
	if err != nil {
		t.Fatalf("parseHeaders failed: %v", err)
	}
	if len(headers) != 51 {
		t.Fatalf("expected 51 headers, got %d", len(headers))
	}
	if headers[0] != "Model" {
		t.Errorf("header[0] = %q, want 'Model'", headers[0])
	}
	if headers[50] != "Yr" {
		t.Errorf("header[50] = %q, want 'Yr'", headers[50])
	}
}

func TestScanEditionDate(t *testing.T) {
	f, err := openXLSX(fixturePath(t))
	if err != nil {
		t.Fatalf("openXLSX failed: %v", err)
	}
	defer f.Close()

	sheet, err := findSheet(f)
	if err != nil {
		t.Fatalf("findSheet failed: %v", err)
	}

	date := scanEditionDate(f, sheet)
	if date == "" {
		t.Fatal("scanEditionDate returned empty string")
	}
	if !hasDigit(date) {
		t.Errorf("scanEditionDate returned %q, expected a date string with digits", date)
	}
}
