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

