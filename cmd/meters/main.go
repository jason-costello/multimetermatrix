package main

import (
	"fmt"
	"os"
)

// printUsage prints available subcommands to stderr.
func printUsage() {
	fmt.Fprintln(os.Stderr, "Usage:")
	fmt.Fprintln(os.Stderr, "  meters fetch [flags]    Download xlsx from Google Sheets export URL")
	fmt.Fprintln(os.Stderr, "  meters build [flags]    Parse meters.xlsx and emit data.json")
}

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(2)
	}

	switch os.Args[1] {
	case "fetch":
		fetchCmd(os.Args[2:])
	case "build":
		buildCmd(os.Args[2:])
	default:
		fmt.Fprintf(os.Stderr, "unknown subcommand: %s\n", os.Args[1])
		printUsage()
		os.Exit(2)
	}
}

// fetchCmd is the entry point for the fetch subcommand.
// It is implemented in fetch.go.
func fetchCmd(args []string) {
	// Implemented in fetch.go — stub for compilation.
}

// buildCmd is the entry point for the build subcommand.
// It is implemented in a later plan.
func buildCmd(args []string) {
	fmt.Fprintln(os.Stderr, "build: not yet implemented")
	os.Exit(1)
}
