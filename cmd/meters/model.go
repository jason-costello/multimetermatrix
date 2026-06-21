package main

// DataJSON is the top-level schema for data.json output.
type DataJSON struct {
	EditionDate string `json:"edition_date"`
	FetchedAt   string `json:"fetched_at"`
	Columns     []string `json:"columns"`
	Rows        []Row    `json:"rows"`
}

// Row represents a single row of meter data.
type Row struct {
	Values map[string]string `json:"values"`
	Bands  map[string]string `json:"bands"`
	Flags  map[string]string `json:"flags"`
}
