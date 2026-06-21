package main

import (
	"testing"
)

func TestColorLinearizeSRGB(t *testing.T) {
	// Edge cases
	if got := linearizeSRGB(0.0); got != 0.0 {
		t.Errorf("linearizeSRGB(0) = %f, want 0.0", got)
	}
	if got := linearizeSRGB(1.0); got != 1.0 {
		t.Errorf("linearizeSRGB(1) = %f, want 1.0", got)
	}

	// Piecewise boundary: c <= 0.04045 uses decimal branch (c / 12.92)
	boundary := 0.04045
	expected := boundary / 12.92
	if got := linearizeSRGB(boundary); got != expected {
		t.Errorf("linearizeSRGB(%f) = %f, want %f", boundary, got, expected)
	}

	// Gamma branch: c > 0.04045 linearizes to a LOWER value in linear space
	// (sRGB gamma compression makes midtones brighter, linearization reverses this)
	gamma5 := linearizeSRGB(0.5)
	if gamma5 >= 0.5 {
		t.Errorf("linearizeSRGB(0.5) = %f, expected < 0.5 (linearization darkens midtones)", gamma5)
	}

	// Midrange check: 0.5 -> known value
	// (0.5 + 0.055) / 1.055 = 0.526... ^ 2.4 ≈ 0.214...
	if gamma5 > 0.25 {
		t.Errorf("linearizeSRGB(0.5) = %f, expected < 0.25", gamma5)
	}
}

func TestHexToLinearRGB(t *testing.T) {
	// Black
	rgb, err := hexToLinearRGB("000000")
	if err != nil {
		t.Fatalf("hexToLinearRGB(000000) error: %v", err)
	}
	if rgb.R != 0 || rgb.G != 0 || rgb.B != 0 {
		t.Errorf("000000 = %+v, want {0 0 0}", rgb)
	}

	// White
	rgb, err = hexToLinearRGB("FFFFFF")
	if err != nil {
		t.Fatalf("hexToLinearRGB(FFFFFF) error: %v", err)
	}
	if rgb.R != 1 || rgb.G != 1 || rgb.B != 1 {
		t.Errorf("FFFFFF = %+v, want {1 1 1}", rgb)
	}

	// V High (76923C) - known linearized value
	rgb, err = hexToLinearRGB("76923C")
	if err != nil {
		t.Fatalf("hexToLinearRGB(76923C) error: %v", err)
	}
	// 0x76 = 118/255 = 0.4627 -> linearize
	// 0x92 = 146/255 = 0.5725 -> linearize
	// 0x3C = 60/255  = 0.2353 -> linearize
	if rgb.R <= 0 || rgb.G <= 0 || rgb.B <= 0 {
		t.Errorf("76923C has zero component: %+v", rgb)
	}
	// Green should be the dominant component
	if rgb.G <= rgb.R || rgb.G <= rgb.B {
		t.Errorf("76923C expected G dominant, got %+v", rgb)
	}

	// Invalid hex returns error
	_, err = hexToLinearRGB("")
	if err == nil {
		t.Error("expected error for empty string")
	}
	_, err = hexToLinearRGB("FFFFF") // 5 chars
	if err == nil {
		t.Error("expected error for 5-char hex")
	}
	_, err = hexToLinearRGB("GGGGGG")
	if err == nil {
		t.Error("expected error for invalid hex chars")
	}
}

func TestEuclideanDistance(t *testing.T) {
	a := sRGB{R: 0.5, G: 0.5, B: 0.5}
	b := sRGB{R: 0.5, G: 0.5, B: 0.5}

	// Same color -> 0
	if d := euclideanDistance(a, b); d != 0 {
		t.Errorf("same color distance = %f, want 0", d)
	}

	// Different colors -> > 0
	c := sRGB{R: 1.0, G: 0.0, B: 0.0}
	if d := euclideanDistance(a, c); d <= 0 {
		t.Errorf("different color distance = %f, want > 0", d)
	}

	// Symmetry
	dAB := euclideanDistance(a, c)
	dBA := euclideanDistance(c, a)
	if dAB != dBA {
		t.Errorf("distance not symmetric: %f != %f", dAB, dBA)
	}

	// Specific known distance
	// (0.5, 0.5, 0.5) to (1.0, 0.0, 0.0): dr=0.5, dg=-0.5, db=-0.5
	// 0.25 + 0.25 + 0.25 = 0.75
	expected := 0.75
	if d := euclideanDistance(a, c); d != expected {
		t.Errorf("distance = %f, want %f", d, expected)
	}
}

func TestNearestBand(t *testing.T) {
	// Define 5 score bands from PROJECT.md legend colors
	bands := []legendEntry{
		{hex: "76923C", label: "V High"},
		{hex: "99CC00", label: "High"},
		{hex: "D4CC00", label: "Average"},
		{hex: "FFCC00", label: "Low"},
		{hex: "FF5700", label: "V Low"},
	}

	// Exact match: band hex returns its label
	label, tied := nearestBand("76923C", bands)
	if label != "V High" || tied {
		t.Errorf("nearestBand(76923C) = (%q, %v), want (\"V High\", false)", label, tied)
	}

	// Interpolated color between V Low and Low
	// FF7A00 is between FF5700 (V Low) and FFCC00 (Low)
	label, tied = nearestBand("FF7A00", bands)
	if label == "" {
		t.Error("nearestBand(FF7A00) returned empty, expected a band label")
	}
	if tied {
		t.Logf("nearestBand(FF7A00) = (%q, tied=true)", label)
	}

	// Empty hex -> ("", false)
	label, tied = nearestBand("", bands)
	if label != "" || tied {
		t.Errorf("nearestBand('') = (%q, %v), want (\"\", false)", label, tied)
	}

	// Edge: hex exactly matches a band
	label, tied = nearestBand("99CC00", bands)
	if label != "High" || tied {
		t.Errorf("nearestBand(99CC00) = (%q, %v), want (\"High\", false)", label, tied)
	}
}

func TestIsCategoricalMarker(t *testing.T) {
	markers := []legendEntry{
		{hex: "DDD9C3", label: "missing"},
		{hex: "7F7F7F", label: "important_missing"},
		{hex: "8DB3E2", label: "optional"},
		{hex: "CCC0D9", label: "no_info"},
	}

	// Exact match
	label, ok := isCategoricalMarker("DDD9C3", markers)
	if !ok || label != "missing" {
		t.Errorf("isCategoricalMarker(DDD9C3) = (%q, %v), want (\"missing\", true)", label, ok)
	}

	label, ok = isCategoricalMarker("7F7F7F", markers)
	if !ok || label != "important_missing" {
		t.Errorf("isCategoricalMarker(7F7F7F) = (%q, %v), want (\"important_missing\", true)", label, ok)
	}

	// Non-marker color
	label, ok = isCategoricalMarker("76923C", markers)
	if ok {
		t.Errorf("isCategoricalMarker(76923C) = (%q, %v), want (\"\", false)", label, ok)
	}

	// Empty string
	label, ok = isCategoricalMarker("", markers)
	if ok {
		t.Errorf("isCategoricalMarker('') = (%q, %v), want (\"\", false)", label, ok)
	}

	// With FF prefix -> strips prefix, still matches
	label, ok = isCategoricalMarker("FFDDD9C3", markers)
	if !ok || label != "missing" {
		t.Errorf("isCategoricalMarker(FFDDD9C3) = (%q, %v), want (\"missing\", true)", label, ok)
	}
}

func TestStripAlpha(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"FFD966", "FFD966"}, // 6 chars starting with FF, not an ARGB prefix
		{"D966", "D966"},
		{"FF", "FF"},
		{"FFFFFFFF", "FFFFFF"}, // 8 chars with FF prefix
		{"", ""},
		{"76923C", "76923C"},
	}

	for _, tc := range tests {
		got := stripAlpha(tc.input)
		if got != tc.expected {
			t.Errorf("stripAlpha(%q) = %q, want %q", tc.input, got, tc.expected)
		}
	}
}
