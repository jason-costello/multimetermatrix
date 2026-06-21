package main

import (
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// TestCLIExitCodes verifies that the compiled meters binary exits with the
// correct exit codes for various subcommand states. It builds the binary
// from source and runs it as a subprocess so os.Exit calls are captured.
func TestCLIExitCodes(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping binary execution test in short mode")
	}

	repoRoot := "../../" // relative to cmd/meters/ test runner working directory
	tmpDir := t.TempDir()
	binary := filepath.Join(tmpDir, "meters")

	// Build the binary using the repo root as the working directory.
	buildCmd := exec.Command("go", "build", "-o", binary, "./cmd/meters")
	buildCmd.Dir = repoRoot
	buildOut, err := buildCmd.CombinedOutput()
	if err != nil {
		t.Fatalf("go build failed: %v\n%s", err, buildOut)
	}

	tests := []struct {
		name       string
		args       []string
		runDir     string // empty string means use tmpDir (clean, no meters.xlsx)
		wantCode   int
		wantStderr string // substring expected in stderr
	}{
		{
			name:       "no_args",
			args:       []string{},
			runDir:     tmpDir,
			wantCode:   2,
			wantStderr: "Usage:",
		},
		{
			name:       "unknown_subcommand",
			args:       []string{"unknown"},
			runDir:     tmpDir,
			wantCode:   2,
			wantStderr: "unknown subcommand",
		},
		{
			name:       "build_no_file",
			args:       []string{"build"},
			runDir:     tmpDir,
			wantCode:   4,
			wantStderr: "open meters.xlsx",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			cmd := exec.Command(binary, tc.args...)
			if tc.runDir != "" {
				cmd.Dir = tc.runDir
			} else {
				cmd.Dir = tmpDir
			}

			// Capture stderr
			stderr, err := cmd.CombinedOutput()
			stderrStr := string(stderr)

			if exitErr, ok := err.(*exec.ExitError); ok {
				if exitErr.ExitCode() != tc.wantCode {
					t.Errorf("exit code: got %d, want %d\nstderr:\n%s",
						exitErr.ExitCode(), tc.wantCode, stderrStr)
				}
			} else if err != nil {
				t.Fatalf("unexpected error running binary: %v\n%s", err, stderrStr)
			} else if tc.wantCode != 0 {
				t.Errorf("expected exit code %d, got 0\nstderr:\n%s",
					tc.wantCode, stderrStr)
			}

			if tc.wantStderr != "" && !strings.Contains(stderrStr, tc.wantStderr) {
				t.Errorf("expected stderr to contain %q, got:\n%s",
					tc.wantStderr, stderrStr)
			}
		})
	}
}
