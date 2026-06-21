package main

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestModelJSONSerialization(t *testing.T) {
	row := Row{
		Values: map[string]string{
			"Model": "S Energy",
			"Brand": "Gossen",
		},
		Bands: map[string]string{},
		Flags: map[string]string{},
	}

	dj := DataJSON{
		EditionDate: "2026-01-24",
		FetchedAt:   "2026-06-20T06:00:00Z",
		Columns:     []string{"Model", "Brand", "Count"},
		Rows:        []Row{row},
	}

	data, err := json.Marshal(dj)
	if err != nil {
		t.Fatalf("json.Marshal failed: %v", err)
	}

	jsonStr := string(data)

	// Verify expected fields are present
	checks := []string{
		`"edition_date":"2026-01-24"`,
		`"fetched_at":"2026-06-20T06:00:00Z"`,
		`"columns":["Model","Brand","Count"]`,
		`"Model":"S Energy"`,
		`"Brand":"Gossen"`,
		`"bands":{}`,
		`"flags":{}`,
	}
	for _, check := range checks {
		if !strings.Contains(jsonStr, check) {
			t.Errorf("expected JSON to contain %q", check)
		}
	}

	// Unmarshal back and verify round-trip
	var got DataJSON
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatalf("json.Unmarshal failed: %v", err)
	}

	if got.EditionDate != dj.EditionDate {
		t.Errorf("EditionDate round-trip: got %q, want %q", got.EditionDate, dj.EditionDate)
	}
	if got.FetchedAt != dj.FetchedAt {
		t.Errorf("FetchedAt round-trip: got %q, want %q", got.FetchedAt, dj.FetchedAt)
	}
	if len(got.Columns) != len(dj.Columns) {
		t.Errorf("Columns length: got %d, want %d", len(got.Columns), len(dj.Columns))
	}
	if len(got.Rows) != len(dj.Rows) {
		t.Errorf("Rows length: got %d, want %d", len(got.Rows), len(dj.Rows))
	}

	// Verify empty Bands/Flags are {} not null
	if got.Rows[0].Bands == nil {
		t.Error("Bands is nil (marshaled to null), expected empty map (marshaled to {})")
	}
	if got.Rows[0].Flags == nil {
		t.Error("Flags is nil (marshaled to null), expected empty map (marshaled to {})")
	}
}
