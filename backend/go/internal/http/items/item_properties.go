package items

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/itemplus/backend/internal/database"
	"github.com/jmoiron/sqlx"
)

func resolvePropertyID(realm string, key string) (int, bool) {
	if id, err := strconv.Atoi(key); err == nil {
		return id, true
	}
	propDefsTable := realm + "_properties"
	var id int
	err := database.DB.Get(&id, fmt.Sprintf("SELECT id FROM %s WHERE name = ?", propDefsTable), key)
	return id, err == nil
}

func savePropertiesTx(exec sqlx.Ext, realm string, itemID int, properties map[string]interface{}) {
	propsTable := realm + "_item_properties"

	for key, val := range properties {
		propID, ok := resolvePropertyID(realm, key)
		if !ok {
			continue
		}

		if valMap, isMap := val.(map[string]interface{}); isMap {
			cleaned := map[string]interface{}{}
			for k, v := range valMap {
				if !strings.HasPrefix(k, "_") {
					cleaned[k] = v
				}
			}
			val = cleaned
		}

		valJSON, _ := json.Marshal(val)

		var existingID int
		existErr := sqlx.Get(exec, &existingID,
			fmt.Sprintf("SELECT id FROM %s WHERE item_id = ? AND property_id = ?", propsTable), itemID, propID)
		if existErr == nil {
			exec.Exec(
				fmt.Sprintf("UPDATE %s SET value = ? WHERE id = ?", propsTable),
				string(valJSON), existingID)
		} else {
			exec.Exec(
				fmt.Sprintf("INSERT INTO %s (item_id, property_id, value) VALUES (?, ?, ?)", propsTable),
				itemID, propID, string(valJSON))
		}
	}
}
