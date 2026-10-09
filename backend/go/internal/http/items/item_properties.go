package items

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/jmoiron/sqlx"
)

// resolvePropertyID accepts a property id or, for clients that send names,
// the property's name. The lookup runs on exec, the same transaction the
// caller is writing in: on SQLite a query on another connection would wait
// for that transaction forever.
func resolvePropertyID(exec sqlx.Ext, realm string, key string) (int, bool) {
	if id, err := strconv.Atoi(key); err == nil {
		return id, true
	}
	var id int
	err := sqlx.Get(exec, &id, fmt.Sprintf("SELECT id FROM %s_properties WHERE name = ?", realm), key)
	return id, err == nil
}

// savePropertiesTx writes the given property values of an item. A nil value
// removes the property; keys that name no property are ignored. Any database
// error is returned so the caller can roll back instead of reporting an item
// as saved whose properties were not.
func savePropertiesTx(exec sqlx.Ext, realm string, itemID int, properties map[string]interface{}) error {
	propsTable := realm + "_item_properties"

	for key, val := range properties {
		propID, ok := resolvePropertyID(exec, realm, key)
		if !ok {
			continue
		}
		if val == nil {
			if _, err := exec.Exec(fmt.Sprintf("DELETE FROM %s WHERE item_id = ? AND property_id = ?", propsTable), itemID, propID); err != nil {
				return err
			}
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

		valJSON, err := json.Marshal(val)
		if err != nil {
			return err
		}

		var existingID int
		existErr := sqlx.Get(exec, &existingID,
			fmt.Sprintf("SELECT id FROM %s WHERE item_id = ? AND property_id = ?", propsTable), itemID, propID)
		if existErr == nil {
			_, err = exec.Exec(fmt.Sprintf("UPDATE %s SET value = ? WHERE id = ?", propsTable), string(valJSON), existingID)
		} else {
			_, err = exec.Exec(fmt.Sprintf("INSERT INTO %s (item_id, property_id, value) VALUES (?, ?, ?)", propsTable), itemID, propID, string(valJSON))
		}
		if err != nil {
			return err
		}
	}
	return nil
}
