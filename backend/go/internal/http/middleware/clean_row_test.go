package middleware

import (
	"encoding/json"
	"reflect"
	"testing"

	"github.com/itemplus/backend/internal/testdb"
)

// openSchema loads the real schema so CleanRow knows which columns are text.
func openSchema(t *testing.T) {
	t.Helper()
	testdb.Use(t)
}

func TestCleanRowKeepsTextColumnsAsText(t *testing.T) {
	openSchema(t)
	// Values as MySQL delivers them (bytes) and as SQLite does (strings).
	for _, value := range []string{"1942", "007", "0012345", "1e5", "12.50", "NaN", "Infinity", "[1,2]", "{}", "true"} {
		row := map[string]interface{}{
			"name":              []byte(value),
			"description":       value,
			"notes":             value,
			"phone":             []byte(value),
			"found_code":        value,
			"category_name":     value,
			"manufacturer_name": []byte(value), // alias, not a schema column
		}
		CleanRow(row)
		for key, got := range row {
			if got != value {
				t.Errorf("%s: %q became %#v, want the unchanged text", key, value, got)
			}
		}
		if _, err := json.Marshal(row); err != nil {
			t.Errorf("row with %q cannot be encoded as JSON: %v", value, err)
		}
	}
}

func TestCleanRowStillConvertsNumbersAndJSON(t *testing.T) {
	openSchema(t)
	row := map[string]interface{}{
		// Numeric columns arrive as bytes from MySQL.
		"id":             []byte("42"),
		"quantity":       []byte("3"),
		"purchase_price": []byte("9.99"),
		"is_bundle":      []byte("0"),
		"total_value":    []byte("120.5"), // computed column, unknown to the schema
		"item_count":     []byte("7"),
		// Text columns that hold serialized JSON.
		"permissions":        `["items.read","print"]`,
		"options":            []byte(`{"choices":["a","b"]}`),
		"component_item_ids": "[1,2]",
		// Already typed values are left alone.
		"capacity": int64(5),
		"gallery":  true,
		"location": nil,
	}
	CleanRow(row)

	want := map[string]interface{}{
		"id": int64(42), "quantity": int64(3), "purchase_price": 9.99, "is_bundle": int64(0),
		"total_value": 120.5, "item_count": int64(7),
		"permissions":        []interface{}{"items.read", "print"},
		"options":            map[string]interface{}{"choices": []interface{}{"a", "b"}},
		"component_item_ids": []interface{}{float64(1), float64(2)},
		"capacity":           int64(5), "gallery": true, "location": nil,
	}
	if !reflect.DeepEqual(row, want) {
		t.Fatalf("got  %#v\nwant %#v", row, want)
	}
}

func TestCleanRowNeverProducesUnencodableNumbers(t *testing.T) {
	openSchema(t)
	// Unknown keys are judged by content; these must stay text instead of
	// becoming NaN or infinity, which would break the whole response.
	row := map[string]interface{}{"computed": "NaN", "other": []byte("Infinity"), "third": "-inf", "hex": "0x1p-2", "value": "NaN"}
	CleanRow(row)
	for key, got := range row {
		if _, isString := got.(string); !isString {
			t.Errorf("%s became %#v, want text", key, got)
		}
	}
	if _, err := json.Marshal(row); err != nil {
		t.Fatalf("row cannot be encoded as JSON: %v", err)
	}
}

func TestCleanRowJSONColumnsDoNotBecomeNumbers(t *testing.T) {
	openSchema(t)
	// "options" holds JSON; a stray plain value is not JSON and stays text.
	// "value" is the one mixed column where numbers are expected.
	row := map[string]interface{}{"options": "12", "permissions": "", "value": "12"}
	CleanRow(row)
	if row["options"] != "12" || row["permissions"] != "" || row["value"] != int64(12) {
		t.Fatalf("got %#v", row)
	}
}
