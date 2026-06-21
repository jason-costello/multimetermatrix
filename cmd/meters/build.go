package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"time"

	"github.com/xuri/excelize/v2"
)

// buildCmd is the entry point for the build subcommand.
func buildCmd(args []string) {
	fs := flag.NewFlagSet("build", flag.ContinueOnError)
	verbose := fs.Bool("verbose", false, "verbose output")
	fs.BoolVar(verbose, "v", false, "verbose output (shorthand)")

	if err := fs.Parse(args); err != nil {
		os.Exit(2)
	}

	if err := runBuild(*verbose); err != nil {
		// Use exit code 4 for xlsx parse/validation errors per D-15.
		fmt.Fprintf(os.Stderr, "%s\n", err)
		os.Exit(4)
	}
}

// runBuild opens meters.xlsx, parses its structure, buckets cell fill colors,
// and writes data.json. Returns an error on any failure.
func runBuild(verbose bool) error {
	// Open the xlsx file.
	f, err := openXLSX("meters.xlsx")
	if err != nil {
		return err
	}
	defer f.Close()

	// Find the target sheet.
	sheet, err := findSheet(f)
	if err != nil {
		return err
	}

	// Parse legend row (score bands + categorical markers).
	bands, markers, err := parseLegend(f, sheet)
	if err != nil {
		return fmt.Errorf("parse legend: %w", err)
	}

	// Parse and validate headers.
	headers, err := parseHeaders(f, sheet)
	if err != nil {
		return err
	}

	// Parse data rows with trailing-blank padding.
	rows, err := parseDataRows(f, sheet, headers)
	if err != nil {
		return fmt.Errorf("parse data: %w", err)
	}

	if verbose {
		fmt.Fprintf(os.Stderr, "read %d rows from sheet '%s' (%d columns)\n",
			len(rows), sheet, len(headers))
	}

	// Scan edition date from row 1.
	editionDate := scanEditionDate(f, sheet)

	// Bucket cell fill colors for each data row.
	bucketed := 0
	markerHits := 0
	noneCount := 0

	for ri := range rows {
		bandsMap := make(map[string]string)
		flagsMap := make(map[string]string)

		for ci, header := range headers {
			cell, _ := excelize.CoordinatesToCellName(ci+1, ri+3) // +3 because data starts at row 3
			fillHex := getCellFillColor(f, sheet, cell)

			if fillHex == "" {
				noneCount++
				continue
			}

			// Check categorical markers first (exact match).
			if label, exact := isCategoricalMarker(fillHex, markers); exact {
				flagsMap[header] = label
				markerHits++
				continue
			}

			// Otherwise, find the nearest score band.
			if label, _ := nearestBand(fillHex, bands); label != "" {
				bandsMap[header] = label
				bucketed++
				continue
			}

			noneCount++
		}

		rows[ri].Bands = bandsMap
		rows[ri].Flags = flagsMap
	}

	if verbose {
		totalCells := len(rows) * len(headers)
		fmt.Fprintf(os.Stderr, "bucketed %d cells, %d markers, %d none (total %d cells)\n",
			bucketed, markerHits, noneCount, totalCells)
	}

	// Build the output data structure.
	data := DataJSON{
		EditionDate: editionDate,
		FetchedAt:   time.Now().UTC().Format(time.RFC3339),
		Columns:     headers,
		Rows:        rows,
	}

	// Marshal with 2-space indent.
	raw, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal data.json: %w", err)
	}

	// Write to file.
	if err := os.WriteFile("data.json", raw, 0644); err != nil {
		return fmt.Errorf("write data.json: %w", err)
	}

	if verbose {
		fmt.Fprintf(os.Stderr, "wrote data.json (%d bytes)\n", len(raw))
	}

	return nil
}
