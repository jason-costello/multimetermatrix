package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

var update = flag.Bool("update", false, "update golden files")

func TestBuildGoldenFile(t *testing.T) {
	// Find the test fixture
	fixturePath := ""
	candidates := []string{
		"../../testdata/meters.xlsx",
		"testdata/meters.xlsx",
		"../testdata/meters.xlsx",
	}
	for _, p := range candidates {
		if _, err := os.Stat(p); err == nil {
			fixturePath = p
			break
		}
	}
	if fixturePath == "" {
		t.Fatal("could not find testdata/meters.xlsx")
	}

	// Resolve to absolute path before Chdir changes the working directory.
	absFixture, err := filepath.Abs(fixturePath)
	if err != nil {
		t.Fatalf("resolve fixture path: %v", err)
	}
	goldenDir := filepath.Dir(absFixture)
	goldenPath := filepath.Join(goldenDir, "data.golden")

	// Create temp directory and copy fixture
	tmpDir := t.TempDir()
	srcData, err := os.ReadFile(absFixture)
	if err != nil {
		t.Fatalf("read fixture: %v", err)
	}
	if err := os.WriteFile(filepath.Join(tmpDir, "meters.xlsx"), srcData, 0644); err != nil {
		t.Fatalf("copy fixture: %v", err)
	}

	origDir, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Chdir(tmpDir); err != nil {
		t.Fatal(err)
	}
	defer os.Chdir(origDir)

	// Run build
	if err := runBuild(false); err != nil {
		t.Fatalf("runBuild failed: %v", err)
	}

	// Verify data.json exists
	if _, err := os.Stat("data.json"); os.IsNotExist(err) {
		t.Fatal("data.json was not created")
	}

	got, err := os.ReadFile("data.json")
	if err != nil {
		t.Fatalf("read data.json: %v", err)
	}

	if *update {
		if err := os.WriteFile(goldenPath, got, 0644); err != nil {
			t.Fatalf("write golden: %v", err)
		}
		// Note: we don't fail here - the caller reruns without -update to verify
		return
	}

	want, err := os.ReadFile(goldenPath)
	if err != nil {
		if os.IsNotExist(err) {
			t.Skipf("golden file %s does not exist; run with -update to create it", goldenPath)
			return
		}
		t.Fatalf("read golden: %v", err)
	}

	// Compare output (strip fetched_at which varies by run)
	gotStr := string(got)
	wantStr := string(want)

	// Compare line by line, ignoring the fetched_at line
	gotLines := strings.Split(gotStr, "\n")
	wantLines := strings.Split(wantStr, "\n")

	if len(gotLines) != len(wantLines) {
		t.Fatalf("output line count mismatch: got %d, want %d\nFirst difference:\n  got:  %s\n  want: %s",
			len(gotLines), len(wantLines),
			safeLine(gotLines, 0), safeLine(wantLines, 0))
	}

	differences := 0
	for i := 0; i < len(gotLines); i++ {
		// Skip fetched_at line (always different due to timestamp)
		if strings.Contains(gotLines[i], `"fetched_at":`) {
			continue
		}
		if gotLines[i] != wantLines[i] {
			if differences < 10 {
				t.Errorf("line %d:\n  got:  %s\n  want: %s", i+1, gotLines[i], wantLines[i])
			}
			differences++
		}
	}
	if differences > 0 {
		t.Fatalf("output differs in %d lines (excluding fetched_at)", differences)
	}
}

// setupBuildTest copies the meters.xlsx fixture into a temp directory and
// changes to that directory. Returns a cleanup function that restores the
// original working directory. The meter fixture must be resolvable via the
// candidates list in TestBuildGoldenFile.
func setupBuildTest(t *testing.T) (tmpDir string, cleanup func()) {
	t.Helper()

	fixturePath := ""
	for _, p := range []string{
		"../../testdata/meters.xlsx",
		"testdata/meters.xlsx",
		"../testdata/meters.xlsx",
	} {
		if _, err := os.Stat(p); err == nil {
			fixturePath = p
			break
		}
	}
	if fixturePath == "" {
		t.Fatal("could not find testdata/meters.xlsx")
	}

	absFixture, err := filepath.Abs(fixturePath)
	if err != nil {
		t.Fatalf("resolve fixture path: %v", err)
	}

	tmpDir = t.TempDir()
	srcData, err := os.ReadFile(absFixture)
	if err != nil {
		t.Fatalf("read fixture: %v", err)
	}
	if err := os.WriteFile(filepath.Join(tmpDir, "meters.xlsx"), srcData, 0644); err != nil {
		t.Fatalf("copy fixture: %v", err)
	}

	origDir, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Chdir(tmpDir); err != nil {
		t.Fatal(err)
	}

	cleanup = func() {
		os.Chdir(origDir)
	}
	return tmpDir, cleanup
}

// captureStderr runs the given function and returns everything written to
// stderr during its execution.
func captureStderr(fn func()) string {
	r, w, _ := os.Pipe()
	origStderr := os.Stderr
	os.Stderr = w

	fn()

	w.Close()
	os.Stderr = origStderr

	var buf bytes.Buffer
	io.Copy(&buf, r)
	r.Close()
	return buf.String()
}

// TestBuildVerboseOutput verifies that running build with --verbose flag
// produces the expected progress messages on stderr.
func TestBuildVerboseOutput(t *testing.T) {
	tmpDir, cleanup := setupBuildTest(t)
	defer cleanup()
	_ = tmpDir

	stderrOutput := captureStderr(func() {
		if err := runBuild(true); err != nil {
			t.Fatalf("runBuild(true) failed: %v", err)
		}
	})

	// Must contain the expected progress messages from build.go
	checks := []string{
		"read ",
		"bucketed ",
		"wrote data.json",
	}
	for _, check := range checks {
		if !strings.Contains(stderrOutput, check) {
			t.Errorf("verbose output should contain %q, got:\n%s", check, stderrOutput)
		}
	}
}

// TestBuildNonVerboseOutput verifies that running build without --verbose
// produces no stderr output on success.
func TestBuildNonVerboseOutput(t *testing.T) {
	tmpDir, cleanup := setupBuildTest(t)
	defer cleanup()
	_ = tmpDir

	stderrOutput := captureStderr(func() {
		if err := runBuild(false); err != nil {
			t.Fatalf("runBuild(false) failed: %v", err)
		}
	})

	if stderrOutput != "" {
		t.Errorf("non-verbose build produced unexpected stderr output:\n%s", stderrOutput)
	}
}

// TestBuildBandLabelsValid verifies that all band labels in the data.json
// output are valid score band names (V High, High, Average, Low, V Low).
// This ensures no non-band cells (e.g., edition date) leak into band labels.
func TestBuildBandLabelsValid(t *testing.T) {
	tmpDir, cleanup := setupBuildTest(t)
	defer cleanup()
	_ = tmpDir

	if err := runBuild(false); err != nil {
		t.Fatalf("runBuild failed: %v", err)
	}

	raw, err := os.ReadFile("data.json")
	if err != nil {
		t.Fatalf("read data.json: %v", err)
	}

	var data DataJSON
	if err := json.Unmarshal(raw, &data); err != nil {
		t.Fatalf("parse data.json: %v", err)
	}

	validBands := map[string]bool{
		"V High": true,
		"High":   true,
		"Average": true,
		"Low":    true,
		"V Low":  true,
	}

	for ri, row := range data.Rows {
		for col, label := range row.Bands {
			if !validBands[label] {
				t.Errorf("row %d, column %q: invalid band label %q; expected one of V High/High/Average/Low/V Low",
					ri, col, label)
			}
		}
	}
}

func safeLine(lines []string, idx int) string {
	if idx < len(lines) {
		return lines[idx]
	}
	return "(end of file)"
}

func TestBuildErrors(t *testing.T) {
	// Test build on non-existent meters.xlsx
	origDir, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	tmpDir := t.TempDir()
	if err := os.Chdir(tmpDir); err != nil {
		t.Fatal(err)
	}
	defer os.Chdir(origDir)

	err = runBuild(false)
	if err == nil {
		t.Fatal("expected error on non-existent meters.xlsx")
	}
	if !strings.Contains(err.Error(), "open meters.xlsx") {
		t.Errorf("expected 'open meters.xlsx' in error, got: %v", err)
	}
}
