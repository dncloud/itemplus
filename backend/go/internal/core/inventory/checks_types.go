package inventory

type Session struct {
	ID           int     `db:"id" json:"id"`
	Realm        string  `db:"realm" json:"realm"`
	ScopeType    string  `db:"scope_type" json:"scope_type"`
	LocationID   *int    `db:"location_id" json:"location_id,omitempty"`
	LocationName *string `db:"location_name" json:"location_name,omitempty"`
	Title        *string `db:"title" json:"title,omitempty"`
	Status       string  `db:"status" json:"status"`
	StartedBy    *int    `db:"started_by" json:"started_by,omitempty"`
	CompletedAt  *string `db:"completed_at" json:"completed_at,omitempty"`
	CreatedAt    *string `db:"created_at" json:"created_at,omitempty"`
	UpdatedAt    *string `db:"updated_at" json:"updated_at,omitempty"`
}

type SessionEntry struct {
	ID                    int     `db:"id" json:"id"`
	SessionID             int     `db:"session_id" json:"session_id"`
	ItemID                *int    `db:"item_id" json:"item_id,omitempty"`
	ItemName              string  `db:"item_name" json:"item_name"`
	CategoryID            *int    `db:"category_id" json:"category_id,omitempty"`
	CategoryName          *string `db:"category_name" json:"category_name,omitempty"`
	CategoryColor         *string `db:"category_color" json:"category_color,omitempty"`
	LocationID            *int    `db:"location_id" json:"location_id,omitempty"`
	LocationName          *string `db:"location_name" json:"location_name,omitempty"`
	LocationColor         *string `db:"location_color" json:"location_color,omitempty"`
	CurrentLocationID     *int    `db:"current_location_id" json:"current_location_id,omitempty"`
	CurrentLocationName   *string `db:"current_location_name" json:"current_location_name,omitempty"`
	CurrentLocationColor  *string `db:"current_location_color" json:"current_location_color,omitempty"`
	ExpectedInScope       bool    `db:"expected_in_scope" json:"expected_in_scope"`
	Status                string  `db:"status" json:"status"`
	FoundVia              *string `db:"found_via" json:"found_via,omitempty"`
	FoundCode             *string `db:"found_code" json:"found_code,omitempty"`
	LocationCorrected     bool    `db:"location_corrected" json:"location_corrected"`
	CorrectedLocationID   *int    `db:"corrected_location_id" json:"corrected_location_id,omitempty"`
	CorrectedLocationName *string `db:"corrected_location_name" json:"corrected_location_name,omitempty"`
	Notes                 *string `db:"notes" json:"notes,omitempty"`
	FoundAt               *string `db:"found_at" json:"found_at,omitempty"`
	CreatedAt             *string `db:"created_at" json:"created_at,omitempty"`
	UpdatedAt             *string `db:"updated_at" json:"updated_at,omitempty"`
}

type SessionCounts struct {
	Expected         int `json:"expected"`
	Pending          int `json:"pending"`
	Found            int `json:"found"`
	Missing          int `json:"missing"`
	Unexpected       int `json:"unexpected"`
	LocationMismatch int `json:"location_mismatch"`
	Corrected        int `json:"corrected"`
}

type SessionDetail struct {
	Session Session        `json:"session"`
	Counts  SessionCounts  `json:"counts"`
	Entries []SessionEntry `json:"entries"`
}

type SessionSummary struct {
	Session Session       `json:"session"`
	Counts  SessionCounts `json:"counts"`
}

type StartSessionInput struct {
	Realm      string
	LocationID *int
	Title      string
	StartedBy  int
}

type ScanInput struct {
	ItemID    *int
	Code      string
	Symbology string
	FoundVia  string
}

type ScanResult struct {
	Entry     SessionEntry `json:"entry"`
	Duplicate bool         `json:"duplicate"`
}
