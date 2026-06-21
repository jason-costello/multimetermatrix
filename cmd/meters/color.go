package main

import (
	"fmt"
	"math"
	"strconv"
	"strings"
)

// legendEntry carries a legend cell's fill color and label.
type legendEntry struct {
	hex   string
	label string
}

// sRGB represents a linearized sRGB color with components in [0.0, 1.0].
type sRGB struct {
	R, G, B float64
}

// hexToLinearRGB converts a 6-hex-char RGB string (no alpha prefix) to
// linearized sRGB values. Expects exactly 6 hex characters.
func hexToLinearRGB(hex string) (sRGB, error) {
	if len(hex) != 6 {
		return sRGB{}, fmt.Errorf("invalid hex color: %q", hex)
	}
	r, err := strconv.ParseUint(hex[0:2], 16, 8)
	if err != nil {
		return sRGB{}, fmt.Errorf("invalid hex color: %q", hex)
	}
	g, err := strconv.ParseUint(hex[2:4], 16, 8)
	if err != nil {
		return sRGB{}, fmt.Errorf("invalid hex color: %q", hex)
	}
	b, err := strconv.ParseUint(hex[4:6], 16, 8)
	if err != nil {
		return sRGB{}, fmt.Errorf("invalid hex color: %q", hex)
	}
	return sRGB{
		R: linearizeSRGB(float64(r) / 255.0),
		G: linearizeSRGB(float64(g) / 255.0),
		B: linearizeSRGB(float64(b) / 255.0),
	}, nil
}

// linearizeSRGB applies the IEC 61966-2-1 piecewise sRGB linearization.
// Input c is a component value in [0.0, 1.0].
func linearizeSRGB(c float64) float64 {
	if c <= 0.04045 {
		return c / 12.92
	}
	return math.Pow((c+0.055)/1.055, 2.4)
}

// euclideanDistance returns the squared Euclidean distance between two sRGB
// colors. No sqrt is used since squared distance is sufficient for comparison.
func euclideanDistance(a, b sRGB) float64 {
	dr := a.R - b.R
	dg := a.G - b.G
	db := a.B - b.B
	return dr*dr + dg*dg + db*db
}

// nearestBand finds the closest score band to the given hex color using
// squared Euclidean distance in linearized sRGB space. If multiple bands tie
// for the minimum distance, tied is true and the band with the higher score
// (lower slice index) is returned per D-07.
func nearestBand(hex string, bands []legendEntry) (bestLabel string, tied bool) {
	if hex == "" {
		return "", false
	}

	target, err := hexToLinearRGB(hex)
	if err != nil {
		return "", false
	}

	bestLabel = ""
	var bestDist float64 = -1
	tied = false

	for i, band := range bands {
		entry, err := hexToLinearRGB(band.hex)
		if err != nil {
			continue
		}
		dist := euclideanDistance(target, entry)

		if bestDist < 0 || dist < bestDist {
			bestDist = dist
			bestLabel = band.label
			tied = false
		} else if dist == bestDist {
			// Tie: keep the higher band (lower slice index) per D-07.
			// Since we iterate in slice order, the first band seen with
			// this distance was at a lower index (higher band). On a tie
			// only the first occurrence matters — set tied=true and keep
			// the existing bestLabel (which has lower index = higher band).
			// Find the index of the current bestLabel in the bands slice.
			bestIdx := indexOfLabel(bands, bestLabel)
			if i < bestIdx {
				bestLabel = band.label
			}
			tied = true
		}
	}

	return bestLabel, tied
}

// indexOfLabel returns the slice index of the legendEntry with the given label.
// Returns -1 if not found.
func indexOfLabel(entries []legendEntry, label string) int {
	for i, e := range entries {
		if e.label == label {
			return i
		}
	}
	return -1
}

// isCategoricalMarker checks whether hex exactly matches one of the marker
// fill colors. Comparison is case-insensitive. The alpha "FF" prefix is
// stripped from both hex and marker hex before comparison.
func isCategoricalMarker(hex string, markers []legendEntry) (label string, exact bool) {
	if hex == "" {
		return "", false
	}
	clean := stripAlpha(hex)
	for _, m := range markers {
		if stripAlpha(m.hex) == clean {
			return m.label, true
		}
	}
	return "", false
}

// stripAlpha removes the leading "FF" alpha prefix from an 8-character ARGB
// hex string. If the string is not 8 chars or does not start with "FF", it is
// returned as-is.
func stripAlpha(hex string) string {
	if len(hex) == 8 && strings.HasPrefix(hex, "FF") {
		return hex[2:]
	}
	return hex
}
