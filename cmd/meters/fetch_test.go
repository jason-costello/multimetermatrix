package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
)

func TestFetchSuccess(t *testing.T) {
	// Create a response large enough to pass magic byte and size checks
	data := make([]byte, 10240)
	data[0] = 'P'
	data[1] = 'K'

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/octet-stream")
		w.Write(data)
	}))
	defer server.Close()

	origDir, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	tmpDir := t.TempDir()
	if err := os.Chdir(tmpDir); err != nil {
		t.Fatal(err)
	}
	defer os.Chdir(origDir)

	if err := runFetch(server.URL, false); err != nil {
		t.Fatalf("runFetch returned error: %v", err)
	}

	if _, err := os.Stat("meters.xlsx"); os.IsNotExist(err) {
		t.Fatal("meters.xlsx was not created")
	}
}

func TestFetchHTTPErrors(t *testing.T) {
	t.Run("404", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusNotFound)
		}))
		defer server.Close()

		err := runFetch(server.URL, false)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if !strings.Contains(err.Error(), "FETCH_404") {
			t.Fatalf("expected FETCH_404, got: %v", err)
		}
	})

	t.Run("500", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		}))
		defer server.Close()

		err := runFetch(server.URL, false)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if !strings.Contains(err.Error(), "FETCH_5xx") {
			t.Fatalf("expected FETCH_5xx, got: %v", err)
		}
	})

	t.Run("redirect_to_error", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/" {
				http.Redirect(w, r, "/forbidden", http.StatusFound)
			} else {
				w.WriteHeader(http.StatusForbidden)
			}
		}))
		defer server.Close()

		err := runFetch(server.URL, false)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if !strings.Contains(err.Error(), "FETCH_HTTP_") {
			t.Fatalf("expected FETCH_HTTP_ prefix, got: %v", err)
		}
	})
}

func TestFetchMagicBytes(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		w.Write([]byte("not-PK content here"))
	}))
	defer server.Close()

	origDir, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	tmpDir := t.TempDir()
	if err := os.Chdir(tmpDir); err != nil {
		t.Fatal(err)
	}
	defer os.Chdir(origDir)

	err = runFetch(server.URL, false)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if !strings.Contains(err.Error(), "FETCH_BAD_MAGIC") {
		t.Fatalf("expected FETCH_BAD_MAGIC, got: %v", err)
	}
}

func TestFetchTooSmall(t *testing.T) {
	// 200-byte response starting with PK magic bytes but under 10KB
	data := make([]byte, 200)
	data[0] = 'P'
	data[1] = 'K'

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/octet-stream")
		w.Write(data)
	}))
	defer server.Close()

	origDir, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	tmpDir := t.TempDir()
	if err := os.Chdir(tmpDir); err != nil {
		t.Fatal(err)
	}
	defer os.Chdir(origDir)

	err = runFetch(server.URL, false)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if !strings.Contains(err.Error(), "FETCH_TOO_SMALL") {
		t.Fatalf("expected FETCH_TOO_SMALL, got: %v", err)
	}
}
