package main

import (
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const defaultExportURL = "https://docs.google.com/spreadsheets/d/1JB1xLWaXLOCWfANM1O_2Vgg_KKbl0wTQCi409aIV6Jg/export?format=xlsx"

// fetchError is an error that carries an exit code for the fetch subcommand.
type fetchError struct {
	Code int
	Msg  string
}

func (e *fetchError) Error() string {
	return e.Msg
}

// fetchCmd parses fetch subcommand flags and runs the fetch.
func fetchCmd(args []string) {
	fs := flag.NewFlagSet("fetch", flag.ContinueOnError)
	url := fs.String("url", defaultExportURL, "Google Sheets export URL")
	verbose := fs.Bool("verbose", false, "verbose output")
	fs.BoolVar(verbose, "v", false, "verbose output (shorthand)")

	if err := fs.Parse(args); err != nil {
		os.Exit(2)
	}

	if err := runFetch(*url, *verbose); err != nil {
		var fe *fetchError
		if errors.As(err, &fe) {
			fmt.Fprintln(os.Stderr, err.Error())
			os.Exit(fe.Code)
		}
		fmt.Fprintf(os.Stderr, "FETCH_FAILED: %v\n", err)
		os.Exit(1)
	}
}

// runFetch downloads the xlsx from url, validates it, and writes to meters.xlsx.
func runFetch(url string, verbose bool) error {
	client := &http.Client{Timeout: 30 * time.Second}

	resp, err := client.Get(url)
	if err != nil {
		errMsg := strings.ToLower(err.Error())
		if os.IsTimeout(err) || strings.Contains(errMsg, "timeout") {
			return &fetchError{Code: 3, Msg: "FETCH_TIMEOUT: request timed out after 30s"}
		}
		if strings.Contains(errMsg, "no such host") || strings.Contains(errMsg, "dns") {
			return &fetchError{Code: 3, Msg: "FETCH_DNS_FAILURE: could not resolve hostname"}
		}
		return &fetchError{Code: 1, Msg: fmt.Sprintf("FETCH_FAILED: %v", err)}
	}
	defer resp.Body.Close()

	switch {
	case resp.StatusCode == http.StatusNotFound:
		return &fetchError{Code: 3, Msg: fmt.Sprintf("FETCH_404: URL returned 404 - export may have moved: %s", url)}
	case resp.StatusCode >= 500:
		return &fetchError{Code: 3, Msg: fmt.Sprintf("FETCH_5xx: server error %d", resp.StatusCode)}
	case resp.StatusCode != http.StatusOK:
		return &fetchError{Code: 3, Msg: fmt.Sprintf("FETCH_HTTP_%d: unexpected status: %s", resp.StatusCode, resp.Status)}
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return &fetchError{Code: 1, Msg: fmt.Sprintf("FETCH_FAILED: reading response body: %v", err)}
	}

	if len(data) < 2 || data[0] != 'P' || data[1] != 'K' {
		return &fetchError{Code: 3, Msg: fmt.Sprintf("FETCH_BAD_MAGIC: response is not a valid xlsx file (expected PK magic bytes, got %q)", string(data[:min(len(data), 4)]))}
	}

	if len(data) < 10240 {
		return &fetchError{Code: 3, Msg: fmt.Sprintf("FETCH_TOO_SMALL: file size %d bytes is below minimum 10240 bytes", len(data))}
	}

	outPath := "meters.xlsx"
	if err := os.WriteFile(outPath, data, 0644); err != nil {
		return &fetchError{Code: 1, Msg: fmt.Sprintf("FETCH_FAILED: writing %s: %v", filepath.Base(outPath), err)}
	}

	if verbose {
		fmt.Fprintf(os.Stderr, "downloaded %d bytes from %s\n", len(data), url)
	}

	return nil
}
